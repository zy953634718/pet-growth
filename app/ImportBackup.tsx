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
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.fileBtnText}>📁 从文件选择</Text>}
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
  container: { flex: 1, backgroundColor: Colors.bgPrimary, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.neutral900, marginBottom: 8 },
  sub: { fontSize: 14, color: Colors.neutral500, marginBottom: 18, lineHeight: 20 },
  fileBtn: {
    backgroundColor: Colors.secondary300,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  fileBtnText: { color: Colors.bgCard, fontSize: 16, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: '600', color: Colors.neutral700, marginBottom: 8 },
  pwdInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.bgCard,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    backgroundColor: Colors.bgCard,
    marginBottom: 16,
  },
  primary: {
    backgroundColor: Colors.primary500,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryText: { color: Colors.bgCard, fontSize: 16, fontWeight: 'bold' },
  cancel: { marginTop: 16, alignItems: 'center', padding: 10 },
  cancelText: { color: Colors.neutral400, fontSize: 15 },
});
