import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { ensureAIForFamily, importPresets } from '@/db/database';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import AppModal from '@/components/AppModal';
import { useModal } from '@/hooks/useModal';

const AGE_RANGES = ['6-8', '9-10', '11-12'];
const AGE_LABELS: Record<string, string> = { '6-8': '低年级', '9-10': '中年级', '11-12': '高年级' };
const AGE_SUB: Record<string, string> = { '6-8': '1-2年级', '9-10': '3-4年级', '11-12': '5-6年级' };

export default function SetupFamilyScreen() {
  const router = useRouter();
  const rawFresh = useLocalSearchParams<{ fresh?: string | string[] }>().fresh;
  const fresh = Array.isArray(rawFresh) ? rawFresh[0] : rawFresh;
  const { createFamily, addChild, purgeAllLocalData } = useFamilyStore();
  const [purgeReady, setPurgeReady] = useState(fresh !== '1');
  const [familyName, setFamilyName] = useState('');
  const [password, setPassword] = useState('');
  const [childName, setChildName] = useState('');
  const [ageRange, setAgeRange] = useState('6-8');
  const [isCreating, setIsCreating] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { modal, showModal, hideModal } = useModal();

  useEffect(() => {
    if (fresh !== '1') { setPurgeReady(true); return; }
    let cancelled = false;
    void purgeAllLocalData()
      .catch(() => {})
      .finally(() => { if (!cancelled) setPurgeReady(true); });
    return () => { cancelled = true; };
  }, [fresh, purgeAllLocalData]);

  const handleNext = async () => {
    if (!purgeReady) return showModal('提示', '正在清理本地数据，请稍候');
    if (!familyName.trim()) return showModal('提示', '请输入家庭名称');
    if (password.length < 4) return showModal('提示', '家长密码至少4位数字');
    if (!childName.trim()) return showModal('提示', '请输入孩子的昵称');

    setIsCreating(true);
    try {
      const family = await createFamily(familyName, password);
      await importPresets(family.id);
      await ensureAIForFamily(family.id);
      const child = await addChild(childName, ageRange);
      router.replace({ pathname: '/SetupPet', params: { childId: child.id } });
    } catch (error) {
      console.error('创建家庭失败 [详细]:', error);
      showModal('错误', `创建失败: ${error instanceof Error ? error.message : String(error)}`);
      setIsCreating(false);
    }
  };

  const isReady = purgeReady && !isCreating;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 顶部标题区 */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>步骤 1 / 2</Text>
        </View>
        <Text style={styles.emoji}>🏡</Text>
        <Text style={styles.title}>创建你的家庭</Text>
        <Text style={styles.subtitle}>填写信息，开启萌宠成长之旅</Text>
      </View>

      {/* 表单卡片（单卡 + 行内 label/input） */}
      <View style={styles.card}>

        {/* 家庭名称 */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldLabel}>
            <Text style={styles.fieldIcon}>🏠</Text>
            <Text style={styles.fieldName}>家庭名称</Text>
          </View>
          <TextInput
            style={[styles.fieldInput, focusedField === 'family' && styles.fieldInputFocused]}
            placeholder="例如：小明的家"
            placeholderTextColor={Colors.neutral400}
            value={familyName}
            onChangeText={setFamilyName}
            maxLength={20}
            onFocus={() => setFocusedField('family')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={styles.divider} />

        {/* 家长密码 */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldLabel}>
            <Text style={styles.fieldIcon}>🔐</Text>
            <Text style={styles.fieldName}>家长密码</Text>
          </View>
          <TextInput
            style={[styles.fieldInput, styles.passwordInput, focusedField === 'password' && styles.fieldInputFocused]}
            placeholder="4-6 位数字"
            placeholderTextColor={Colors.neutral400}
            value={password}
            onChangeText={(t) => setPassword(t.replace(/[^0-9]/g, '').slice(0, 6))}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
          />
        </View>
        <Text style={styles.hint}>💡 用于进入家长管理端，请牢记密码</Text>

        <View style={styles.divider} />

        {/* 孩子昵称 */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldLabel}>
            <Text style={styles.fieldIcon}>👶</Text>
            <Text style={styles.fieldName}>孩子昵称</Text>
          </View>
          <TextInput
            style={[styles.fieldInput, focusedField === 'child' && styles.fieldInputFocused]}
            placeholder="孩子的昵称"
            placeholderTextColor={Colors.neutral400}
            value={childName}
            onChangeText={setChildName}
            maxLength={10}
            onFocus={() => setFocusedField('child')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={styles.divider} />

        {/* 年龄段 */}
        <View style={styles.ageSection}>
          <Text style={styles.ageSectionLabel}>🎒 年龄段</Text>
          <View style={styles.ageRow}>
            {AGE_RANGES.map((r) => {
              const active = ageRange === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.ageChip, active && styles.ageChipActive]}
                  onPress={() => setAgeRange(r)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.ageChipText, active && styles.ageChipTextActive]}>
                    {AGE_LABELS[r]}
                  </Text>
                  <Text style={[styles.ageChipSub, active && styles.ageChipSubActive]}>
                    {AGE_SUB[r]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </View>

      {/* 下一步按钮 */}
      <TouchableOpacity
        style={[styles.nextBtn, !isReady && styles.nextBtnDisabled]}
        onPress={handleNext}
        activeOpacity={0.85}
        disabled={!isReady}
      >
        {!purgeReady || isCreating ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.bgCard} size="small" />
            <Text style={styles.nextBtnText}>{isCreating ? '创建中…' : '准备中…'}</Text>
          </View>
        ) : (
          <Text style={styles.nextBtnText}>下一步  →</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>🔒 数据仅存储在本设备，保护家庭隐私</Text>

      <AppModal state={modal} onClose={hideModal} />
    </KeyboardAvoidingView>
  );
}

const LABEL_WIDTH = 76;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[8],
    paddingBottom: Spacing[5],
  },

  // ── 顶部 ──
  header: {
    alignItems: 'center',
    marginBottom: Spacing[5],
  },
  stepBadge: {
    backgroundColor: Colors.primary100,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 3,
    marginBottom: Spacing[3],
  },
  stepText: {
    fontSize: Typography.xs,
    color: Colors.primary600,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emoji: {
    fontSize: 42,
    marginBottom: Spacing[2],
  },
  title: {
    fontSize: Typography['2xl'],
    fontWeight: 'bold',
    color: Colors.neutral900,
    marginBottom: Spacing[1],
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.neutral500,
  },

  // ── 表单卡片 ──
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[1],
    paddingBottom: Spacing[2],
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.borderMuted,
    marginBottom: Spacing[4],
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  fieldLabel: {
    width: LABEL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },
  fieldIcon: {
    fontSize: 15,
  },
  fieldName: {
    fontSize: Typography.sm + 1,
    fontWeight: '600',
    color: Colors.neutral700,
  },
  fieldInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.borderInput,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing[3],
    paddingVertical: Platform.OS === 'ios' ? Spacing[2] : Spacing['1.5'],
    fontSize: Typography.base,
    color: Colors.neutral900,
    backgroundColor: Colors.neutral50,
  },
  fieldInputFocused: {
    borderColor: Colors.primary400,
    backgroundColor: Colors.bgCard,
  },
  passwordInput: {
    letterSpacing: 5,
  },
  hint: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    marginLeft: LABEL_WIDTH + Spacing[3],
    marginBottom: Spacing[2],
    marginTop: -Spacing[2],
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDivider,
  },

  // ── 年龄段 ──
  ageSection: {
    paddingVertical: Spacing[3],
  },
  ageSectionLabel: {
    fontSize: Typography.sm + 1,
    fontWeight: '600',
    color: Colors.neutral700,
    marginBottom: Spacing[2],
  },
  ageRow: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  ageChip: {
    flex: 1,
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.button,
    borderWidth: 1.5,
    borderColor: Colors.borderInput,
    alignItems: 'center',
    backgroundColor: Colors.neutral50,
  },
  ageChipActive: {
    borderColor: Colors.primary500,
    backgroundColor: Colors.primary50,
    ...Shadows.xs,
  },
  ageChipText: {
    fontSize: Typography.sm,
    color: Colors.neutral600,
    fontWeight: '600',
  },
  ageChipTextActive: {
    color: Colors.primary600,
    fontWeight: '700',
  },
  ageChipSub: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    marginTop: 1,
  },
  ageChipSubActive: {
    color: Colors.primary400,
  },

  // ── 按钮 ──
  nextBtn: {
    backgroundColor: Colors.primary500,
    borderRadius: BorderRadius['2xl'],
    paddingVertical: Spacing['3.5'],
    alignItems: 'center',
    shadowColor: Colors.primary500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  nextBtnText: {
    color: Colors.bgCard,
    fontSize: Typography.lg,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // ── 底部 ──
  footer: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    textAlign: 'center',
    marginTop: Spacing[3],
  },
});
