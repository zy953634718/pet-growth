import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  RefreshControl,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { useAIStore } from '@/stores/useAIStore';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { exportDatabaseEncrypted } from '@/db/database';
import Modal, { ModalStyles } from '@/components/Modal';
import AppModal from '@/components/AppModal';
import { useModal } from '@/hooks/useModal';

import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

export default function ParentSettingsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [pwdModal, setPwdModal] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportPwd, setExportPwd] = useState('');
  const [exportPwd2, setExportPwd2] = useState('');
  const { modal, showModal, hideModal } = useModal();

  // Store hooks
  const { config, safetyConfig, loadConfig, updateConfig, loadSafetyConfig, updateSafetyConfig } = useAIStore();
  const { currentFamily, children, selectChild, updateParentPassword, purgeAllLocalData, setRole } = useFamilyStore();

  // Local form state - initialized from store when available
  const [apiKey, setApiKey] = useState('');
  const [modelProvider, setModelProvider] = useState('qwen');
  const [modelName, setModelName] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [filterLevel, setFilterLevel] = useState<'strict' | 'standard' | 'relaxed'>('standard');
  const [dailyLimit, setDailyLimit] = useState('50');
  const [sessionLimit, setSessionLimit] = useState('15');
  const [saveHistory, setSaveHistory] = useState(true);
  const [enableVoice, setEnableVoice] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load config when family changes
  useEffect(() => {
    if (currentFamily) {
      loadConfig(currentFamily.id);
      loadSafetyConfig(currentFamily.id);
    }
  }, [currentFamily, loadConfig, loadSafetyConfig]);

  // Sync local state from store when config loads
  useEffect(() => {
    if (config) {
      setApiKey(config.api_key_encrypted || '');
      setModelProvider(config.model_provider || 'qwen');
      setModelName(config.model_name || '');
      setTemperature(config.temperature ?? 0.7);
    }
  }, [config]);

  // Sync local state from safetyConfig when it loads
  useEffect(() => {
    if (safetyConfig) {
      setFilterLevel((safetyConfig.filter_level as 'strict' | 'standard' | 'relaxed') || 'standard');
      setDailyLimit(String(safetyConfig.daily_message_limit ?? 50));
      setSessionLimit(String(safetyConfig.session_duration_limit ?? 15));
      setSaveHistory(!!safetyConfig.save_history);
      setEnableVoice(!!safetyConfig.enable_voice);
    }
  }, [safetyConfig]);

  // Track changes
  const markChanged = () => setHasChanges(true);

  // Handle save
  const handleSave = async () => {
    if (!currentFamily) {
      showModal('提示', '未找到家庭信息');
      return;
    }

    try {
      await updateConfig(currentFamily.id, {
        model_provider: modelProvider,
        model_name: modelName.trim() || undefined,
        api_key_encrypted: apiKey || null,
        temperature,
      });
      await updateSafetyConfig(currentFamily.id, {
        filter_level: filterLevel,
        daily_message_limit: parseInt(dailyLimit, 10) || 50,
        session_duration_limit: parseInt(sessionLimit, 10) || 15,
        save_history: saveHistory ? 1 : 0,
        enable_voice: enableVoice ? 1 : 0,
      });
      setHasChanges(false);
      showModal('成功', '设置已保存');
    } catch (error) {
      console.error('Save settings error:', error);
      showModal('错误', '保存失败，请重试');
    }
  };

  // Refresh handler
  const onRefresh = async () => {
    if (!currentFamily) return;
    setRefreshing(true);
    await Promise.all([
      loadConfig(currentFamily.id),
      loadSafetyConfig(currentFamily.id),
    ]);
    setRefreshing(false);
  };

  // Provider labels
  const providerLabels: Record<string, string> = {
    qwen: '通义千问',
    glm: '智谱 GLM',
    openai: 'OpenAI',
    deepseek: 'DeepSeek',
  };

  const defaultModelNames: Record<string, string> = {
    qwen: 'qwen-turbo',
    glm: 'glm-4-flash',
    openai: 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
  };

  const modelNameHints: Record<string, string> = {
    qwen: '如 qwen-turbo · qwen-plus · qwen-max',
    glm: '如 glm-4-flash · glm-4 · glm-4-air',
    openai: '如 gpt-4o-mini · gpt-4o · gpt-3.5-turbo',
    deepseek: '如 deepseek-chat · deepseek-reasoner',
  };

  // Filter level labels
  const filterLabels: Record<string, string> = {
    strict: '严格',
    standard: '标准',
    relaxed: '宽松',
  };

  const openExportModal = useCallback(() => {
    if (!currentFamily) {
      showModal('提示', '未找到家庭信息');
      return;
    }
    setExportPwd('');
    setExportPwd2('');
    setExportModal(true);
  }, [currentFamily, showModal]);

  const performEncryptedExport = useCallback(async () => {
    if (exportPwd.length < 6) {
      showModal('提示', '备份密码至少 6 位');
      return;
    }
    if (exportPwd !== exportPwd2) {
      showModal('提示', '两次输入的密码不一致');
      return;
    }
    setExportModal(false);
    setExporting(true);
    try {
      const json = await exportDatabaseEncrypted(exportPwd);
      setExportPwd('');
      setExportPwd2('');
      const canShareFile = await Sharing.isAvailableAsync();
      if (canShareFile && cacheDirectory) {
        const name = `petgrowth-backup-${new Date().toISOString().slice(0, 10)}.petgrowth`;
        const path = `${cacheDirectory}${name}`;
        await writeAsStringAsync(path, json);
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: '导出萌宠成长记备份' });
      } else {
        await Share.share({ message: json, title: '萌宠成长记备份' });
      }
    } catch (e) {
      console.error(e);
      showModal('错误', '导出失败');
    } finally {
      setExporting(false);
    }
  }, [exportPwd, exportPwd2, showModal]);

  const handleImportData = useCallback(() => {
    router.push('/ImportBackup');
  }, [router]);

  const submitPasswordChange = useCallback(async () => {
    if (newPwd.length < 4 || newPwd.length > 6) {
      showModal('提示', '新密码需为 4～6 位数字');
      return;
    }
    if (newPwd !== confirmPwd) {
      showModal('提示', '两次输入的新密码不一致');
      return;
    }
    const ok = await updateParentPassword(oldPwd, newPwd);
    if (!ok) {
      showModal('错误', '原密码不正确');
      return;
    }
    setPwdModal(false);
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    showModal('成功', '家长密码已更新');
  }, [oldPwd, newPwd, confirmPwd, updateParentPassword, showModal]);

  const handleResetData = useCallback(() => {
    showModal('警告', '将删除本机全部家庭、任务与宠物数据且不可恢复。确定继续？', [
      { text: '取消' },
      {
        text: '确定清除',
        danger: true,
        onPress: () => {
          void (async () => {
            try {
              await purgeAllLocalData();
              showModal('完成', '已清除本地数据', [
                { text: '确定', primary: true, onPress: () => router.replace('/Welcome') },
              ]);
            } catch (e) {
              console.error(e);
              showModal('错误', '清除失败');
            }
          })();
        },
      },
    ]);
  }, [purgeAllLocalData, router, showModal]);

  const handleSwitchToChild = useCallback(() => {
    // 如果有孩子档案，自动选中第一个
    if (children.length > 0 && !useFamilyStore.getState().currentChild) {
      selectChild(children[0].id);
    }
    setRole('child');
    router.replace('/(child-tabs)');
  }, [children, selectChild, setRole, router]);

  const DATA_ACTIONS = [
    { icon: 'cloud-upload-outline' as const, label: '导出数据备份', desc: '导出为 .petgrowth 加密文件', onPress: openExportModal },
    { icon: 'cloud-download-outline' as const, label: '导入数据恢复', desc: '从备份文件恢复全部数据', onPress: handleImportData },
    { icon: 'key-outline' as const, label: '修改家长密码', desc: '更换进入家长端的密码', onPress: () => setPwdModal(true) },
    { icon: 'trash-outline' as const, label: '重置所有数据', desc: '谨慎操作，将清除所有本地数据', onPress: handleResetData, danger: true },
    { icon: 'people-outline' as const, label: '切换到孩子端', desc: '返回孩子的视角，查看任务和宠物', onPress: handleSwitchToChild },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary500]} />
        }
      >
        {/* AI 对话配置 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: Colors.primary50 }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary500} />
            </View>
            <Text style={styles.sectionTitle}>AI 对话配置</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>API Key</Text>
            <TextInput
              style={[styles.input, styles.secretInput]}
              placeholder="输入你的 API Key"
              value={apiKey}
              onChangeText={(t) => { setApiKey(t); markChanged(); }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>支持通义千问/智谱GLM/OpenAI/DeepSeek，Key 仅本地存储</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>模型提供商</Text>
            <View style={styles.rowBtns}>
              {(['qwen', 'glm', 'openai', 'deepseek'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.selectChip, modelProvider === m && styles.selected]}
                  onPress={() => {
                    setModelProvider(m);
                    setModelName('');
                    markChanged();
                  }}
                >
                  <Text style={[styles.selectText, modelProvider === m && styles.selectedText]}>
                    {providerLabels[m]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>模型名称</Text>
            <TextInput
              style={styles.input}
              placeholder={defaultModelNames[modelProvider] || 'qwen-turbo'}
              placeholderTextColor={Colors.neutral400}
              value={modelName}
              onChangeText={(t) => { setModelName(t); markChanged(); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>{modelNameHints[modelProvider] || '留空使用默认模型'}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>温度参数（创造性）: {temperature}</Text>
            <View style={styles.sliderRow}>
              {[0.3, 0.5, 0.7, 1.0].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.sliderDot, temperature === v && styles.sliderActive]}
                  onPress={() => { setTemperature(v); markChanged(); }}
                >
                  <Text style={[styles.sliderText, temperature === v && { color: Colors.bgCard }]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 安全设置 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: Colors.warningLight }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.warning} />
            </View>
            <Text style={styles.sectionTitle}>安全设置</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>内容过滤级别</Text>
            <View style={styles.rowBtns}>
              {(['strict', 'standard', 'relaxed'] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.selectChip, filterLevel === l && styles.selected]}
                  onPress={() => { setFilterLevel(l); markChanged(); }}
                >
                  <Text style={[styles.selectText, filterLevel === l && styles.selectedText]}>
                    {filterLabels[l]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>每日对话轮数限制</Text>
            <TextInput
              style={styles.input}
              value={dailyLimit}
              onChangeText={(t) => {
                const val = t.replace(/[^0-9]/g, '').slice(0, 4);
                setDailyLimit(val);
                markChanged();
              }}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>限制孩子每天与 AI 宠物对话的轮数</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>单次会话时长（分钟）</Text>
            <TextInput
              style={styles.input}
              value={sessionLimit}
              onChangeText={(t) => {
                const val = t.replace(/[^0-9]/g, '').slice(0, 3);
                setSessionLimit(val);
                markChanged();
              }}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>单次对话超过此时长将提示休息</Text>
          </View>

          <View style={styles.switchField}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>保存对话历史</Text>
              <Text style={styles.hint}>关闭后新对话不会被记录</Text>
            </View>
            <Switch
              value={saveHistory}
              onValueChange={(v) => { setSaveHistory(v); markChanged(); }}
              trackColor={{ false: Colors.neutral300, true: Colors.secondary300 }}
            />
          </View>

          <View style={[styles.switchField, { borderBottomWidth: 0, marginBottom: 0 }]}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>语音合成</Text>
              <Text style={styles.hint}>开启后 AI 回复将播放语音</Text>
            </View>
            <Switch
              value={enableVoice}
              onValueChange={(v) => { setEnableVoice(v); markChanged(); }}
              trackColor={{ false: Colors.neutral300, true: Colors.primary500 }}
            />
          </View>
        </View>

        {/* 保存按钮：移到安全设置 > 数据管理之间 */}
        {hasChanges && (
          <TouchableOpacity style={styles.saveBanner} onPress={handleSave} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.bgCard} />
            <Text style={styles.saveBannerText}>保存设置</Text>
          </TouchableOpacity>
        )}

        {/* 数据管理 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: Colors.infoLight }]}>
              <Ionicons name="server-outline" size={18} color={Colors.info} />
            </View>
            <Text style={styles.sectionTitle}>数据管理</Text>
          </View>

          {DATA_ACTIONS.map((action, idx) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.actionRow, idx === DATA_ACTIONS.length - 1 && { borderBottomWidth: 0 }]}
              activeOpacity={0.7}
              onPress={action.onPress}
            >
              <View style={[styles.actionIconWrap, action.danger && { backgroundColor: Colors.errorLight }]}>
                <Ionicons name={action.icon} size={18} color={action.danger ? Colors.error : Colors.neutral600} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, action.danger && { color: Colors.error }]}>{action.label}</Text>
                <Text style={styles.actionDesc}>{action.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.neutral300} />
            </TouchableOpacity>
          ))}
        </View>

        {/* 关于 */}
        <View style={styles.section}>
          <View style={styles.aboutBox}>
            <Text style={styles.aboutLogo}>🐾 萌宠成长记</Text>
            <Text style={styles.aboutVersion}>版本 1.0.0 (Build 001)</Text>
            <Text style={styles.aboutDesc}>
              一款面向家庭场景的亲子互动养成应用{'\n'}
              帮助孩子养成良好的学习与生活习惯
            </Text>
          </View>
        </View>

        <View style={{ height: Spacing[6] }} />
      </ScrollView>

      {/* 修改家长密码弹窗 */}
      <Modal
        visible={pwdModal}
        onClose={() => setPwdModal(false)}
        title="修改家长密码"
      >
        <View style={{ marginBottom: Spacing.md }}>
          <Text style={ModalStyles.fieldLabel}>原密码（4~6 位数字）</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="原密码"
            value={oldPwd}
            onChangeText={(t) => setOldPwd(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            secureTextEntry
          />
        </View>
        <View style={{ marginBottom: Spacing.md }}>
          <Text style={ModalStyles.fieldLabel}>新密码</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="新密码"
            value={newPwd}
            onChangeText={(t) => setNewPwd(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            secureTextEntry
          />
        </View>
        <View style={{ marginBottom: Spacing.md }}>
          <Text style={ModalStyles.fieldLabel}>确认新密码</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="确认新密码"
            value={confirmPwd}
            onChangeText={(t) => setConfirmPwd(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            secureTextEntry
          />
        </View>

        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setPwdModal(false)}>
            <Text style={ModalStyles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ModalStyles.confirmButton} onPress={() => void submitPasswordChange()}>
            <Text style={ModalStyles.confirmButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 导出加密备份弹窗 */}
      <Modal
        visible={exportModal}
        onClose={() => setExportModal(false)}
        title="导出加密备份"
      >
        <Text style={{ fontSize: Typography.sm + 1, color: Colors.neutral500, marginBottom: Spacing.md, lineHeight: Typography.base + 6 }}>
          请设置备份密码（至少 6 位），用于导入时解密。
        </Text>
        <View style={{ marginBottom: Spacing.md }}>
          <Text style={ModalStyles.fieldLabel}>备份密码</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="备份密码"
            value={exportPwd}
            onChangeText={setExportPwd}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>
        <View style={{ marginBottom: Spacing.md }}>
          <Text style={ModalStyles.fieldLabel}>确认备份密码</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="确认备份密码"
            value={exportPwd2}
            onChangeText={setExportPwd2}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setExportModal(false)}>
            <Text style={ModalStyles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ModalStyles.confirmButton} onPress={() => void performEncryptedExport()}>
            <Text style={ModalStyles.confirmButtonText}>导出</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {exporting ? (
        <View style={styles.exportOverlay}>
          <ActivityIndicator size="large" color={Colors.primary500} />
          <Text style={styles.exportText}>正在导出…</Text>
        </View>
      ) : null}

      {/* 通用提示弹窗 */}
      <AppModal state={modal} onClose={hideModal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { padding: Spacing[4], paddingTop: Spacing[3] },

  saveBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary500,
    padding: Spacing.md,
    borderRadius: BorderRadius['2xl'],
    marginBottom: Spacing[3],
    ...Shadows.sm,
  },
  saveBannerText: { color: Colors.bgCard, fontSize: Typography.base, fontWeight: '700' },

  section: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing[4],
    marginBottom: Spacing[3],
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing[4],
  },
  sectionIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: Typography.base + 1, fontWeight: '700', color: Colors.neutral900,
  },

  field: { marginBottom: Spacing[4] },
  label: {
    fontSize: Typography.sm + 1, fontWeight: '600', color: Colors.neutral700,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral200,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3,
    fontSize: Typography.base, color: Colors.neutral900,
    backgroundColor: Colors.neutral50,
  },
  secretInput: { letterSpacing: 2 },
  hint: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: Spacing.xs },

  rowBtns: { flexDirection: 'row', gap: Spacing.sm },
  selectChip: {
    flex: 1, paddingVertical: Spacing.sm + 1,
    borderRadius: BorderRadius.button, alignItems: 'center',
    backgroundColor: Colors.neutral100, borderWidth: 1, borderColor: Colors.neutral200,
  },
  selected: { borderColor: Colors.primary500, backgroundColor: Colors.primary50 },
  selectText: { fontSize: Typography.sm + 1, fontWeight: '500', color: Colors.neutral500 },
  selectedText: { color: Colors.primary500, fontWeight: '700' },

  sliderRow: { flexDirection: 'row', gap: Spacing.sm + 2, justifyContent: 'center' },
  sliderDot: {
    flex: 1, height: Spacing[8] + 2,
    borderRadius: BorderRadius.button,
    backgroundColor: Colors.neutral200,
    alignItems: 'center', justifyContent: 'center',
  },
  sliderActive: { backgroundColor: Colors.primary500 },
  sliderText: { fontSize: Typography.sm + 1, fontWeight: '600', color: Colors.neutral500 },

  switchField: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.neutral100,
    marginBottom: Spacing.sm,
  },
  switchLabel: { flex: 1, marginRight: Spacing.md },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.neutral100,
  },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: Typography.base, fontWeight: '600', color: Colors.neutral900 },
  actionDesc: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: 1 },

  aboutBox: { alignItems: 'center', paddingVertical: Spacing.sm },
  aboutLogo: { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.neutral900 },
  aboutVersion: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: Spacing.xs },
  aboutDesc: {
    fontSize: Typography.xs, color: Colors.neutral400,
    textAlign: 'center', lineHeight: Typography.base + 7, marginTop: Spacing.sm,
  },

  exportOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  exportText: { marginTop: Spacing.sm, color: Colors.neutral600, fontSize: Typography.sm + 1 },
});
