import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { getDatabase, importDatabase } from '@/db/database';
import { useFamilyStore } from '@/stores/useFamilyStore';

import { Colors, Typography, Spacing, BorderRadius, TouchTarget } from '@/theme';

export default function ImportBackupScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [backupPwd, setBackupPwd] = useState('');
  const [busy, setBusy] = useState(false);

  const applyImport = async (json: string, pwd?: string) => {
    setBusy(true);
    try {
      await importDatabase(json, pwd?.trim() || undefined);
      const db = getDatabase();
      const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM family LIMIT 1');
      if (!row?.id) {
        Alert.alert('错误', '备份中未找到家庭数据');
        return;
      }
      await useFamilyStore.getState().loadFamily(row.id);
      const kids = useFamilyStore.getState().children;
      if (kids.length > 0) {
        useFamilyStore.getState().selectChild(kids[0].id);
      }
      useFamilyStore.setState({ isSetupComplete: true, currentRole: 'child', isAuthenticated: false });
      Alert.alert('成功', '数据已恢复', [{ text: '确定', onPress: () => router.replace('/RoleSelect') }]);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('加密') || msg.includes('密码')) {
        Alert.alert('导入失败', msg || '请输入正确的备份密码');
      } else {
        Alert.alert('导入失败', msg || '文件格式不正确或数据损坏');
      }
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ['application/json', '*/*'],
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const uri = res.assets[0].uri;
      const json = uri.startsWith('file:') || uri.startsWith('content:')
        ? await readAsStringAsync(uri)
        : await (await fetch(uri)).text();
      await applyImport(json, backupPwd);
    } catch (e) {
      console.error(e);
      Alert.alert('错误', '无法读取所选文件');
    }
  };

  const pasteImport = () => {
    if (!text.trim()) {
      Alert.alert('提示', '请粘贴备份 JSON 或选择文件');
      return;
    }
    void applyImport(text.trim(), backupPwd);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>导入备份</Text>
      <Text style={styles.sub}>
        选择 .petgrowth 备份文件，或将导出/复制的全文粘贴到下方。若备份时设置了密码，请填写密码框。
      </Text>

      <Text style={styles.label}>备份密码（加密备份时必填）</Text>
      <TextInput
        style={styles.pwdInput}
        placeholder="未加密可留空"
        value={backupPwd}
        onChangeText={setBackupPwd}
        secureTextEntry
        editable={!busy}
      />

      <TouchableOpacity style={styles.fileBtn} onPress={pickFile} disabled={busy} activeOpacity={0.85}>
        {busy ? <ActivityIndicator color={Colors.bgCard} /> : <Text style={styles.fileBtnText}>📁 从文件选择</Text>}
      </TouchableOpacity>

      <Text style={styles.label}>或粘贴备份内容</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="{ ... }"
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
        editable={!busy}
      />

      <TouchableOpacity style={styles.primary} onPress={pasteImport} disabled={busy} activeOpacity={0.85}>
        <Text style={styles.primaryText}>导入</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancel} onPress={() => router.back()} disabled={busy}>
        <Text style={styles.cancelText}>取消</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, padding: Spacing[5] },
  title: { fontSize: Typography['2xl'], fontWeight: 'bold', color: Colors.neutral900, marginBottom: Spacing[2] },
  sub: { fontSize: Typography.base, color: Colors.neutral500, marginBottom: Spacing['4.5'], lineHeight: 20 },
  fileBtn: {
    backgroundColor: Colors.secondary300,
    paddingVertical: Spacing['3.5'],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing[5],
    minHeight: TouchTarget.minHeight,
    justifyContent: 'center',
  },
  fileBtnText: { color: Colors.bgCard, fontSize: Typography.lg, fontWeight: 'bold' },
  label: { fontSize: Typography.base, fontWeight: '600', color: Colors.neutral700, marginBottom: Spacing[2] },
  pwdInput: {
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing['3.5'],
    paddingVertical: Spacing[3],
    fontSize: Typography.lg,
    backgroundColor: Colors.bgCard,
    marginBottom: Spacing['3.5'],
  },
  input: {
    flex: 1,
    minHeight: 160,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: BorderRadius.button,
    padding: Spacing[3],
    fontSize: Typography.sm,
    backgroundColor: Colors.bgCard,
    marginBottom: Spacing[4],
  },
  primary: {
    backgroundColor: Colors.primary500,
    paddingVertical: Spacing['3.5'],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    minHeight: TouchTarget.minHeight,
    justifyContent: 'center',
  },
  primaryText: { color: Colors.bgCard, fontSize: Typography.lg, fontWeight: 'bold' },
  cancel: { marginTop: Spacing[4], alignItems: 'center', padding: Spacing['2.5'] },
  cancelText: { color: Colors.neutral400, fontSize: Typography.base + 1 },
});
