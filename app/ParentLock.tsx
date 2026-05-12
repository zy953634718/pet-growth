import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFamilyStore } from '@/stores/useFamilyStore';

import { Colors, Typography, Spacing, BorderRadius } from '@/theme';

export default function ParentLockScreen() {
  const params = useLocalSearchParams<{ target?: string | string[] }>();
  const router = useRouter();
  const currentFamily = useFamilyStore((s) => s.currentFamily);
  const authenticateParent = useFamilyStore((s) => s.authenticateParent);

  const targetParent = useMemo(() => {
    const t = params?.target;
    const v = Array.isArray(t) ? t[0] : t;
    return v === 'parent';
  }, [params?.target]);

  /** 与创建家庭时一致：仅当长度等于已存密码位数时才校验，避免 5～6 位密码在第 4 位被误提交 */
  const expectedLen = currentFamily?.parent_password?.length ?? 0;
  const dotCount = Math.min(6, Math.max(4, expectedLen || 6));

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const tryAuthenticate = async (password: string) => {
    setIsAuthenticating(true);
    try {
      const isValid = await authenticateParent(password);
      if (isValid) {
        setError('');
        setTimeout(() => {
          router.replace(targetParent ? '/(parent-tabs)' : '/RoleSelect');
        }, 200);
      } else {
        setError('密码错误，请重试');
        setInput('');
        setTimeout(() => setError(''), 2000);
      }
    } catch {
      setError('验证失败，请重试');
      setInput('');
      setTimeout(() => setError(''), 2000);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePress = (digit: string) => {
    if (isAuthenticating) return;
    if (!currentFamily || expectedLen < 4 || expectedLen > 6) {
      setError('未找到家庭或数据异常，请返回重试');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (input.length >= expectedLen) return;

    const newInput = input + digit;
    setInput(newInput);

    if (newInput.length === expectedLen) {
      void tryAuthenticate(newInput);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 家长验证</Text>
      <Text style={styles.hint}>请输入家长密码</Text>

      <View style={styles.dotsRow}>
        {Array.from({ length: dotCount }, (_, i) => (
          <View key={i} style={[styles.dot, i < input.length && styles.dotActive]} />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.placeholder}>输入 4~6 位数字</Text>}

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'].map((key, i) =>
          key === '' ? (
            <View key={`e-${i}`} style={styles.keyEmpty} />
          ) : (
            <TouchableOpacity
              key={key}
              style={styles.key}
              onPress={() => handlePress(key)}
              activeOpacity={0.6}
              disabled={isAuthenticating}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          )
        )}
        <TouchableOpacity
          style={styles.key}
          onPress={() => !isAuthenticating && setInput(input.slice(0, -1))}
          activeOpacity={0.6}
          disabled={isAuthenticating}
        >
          <Text style={styles.deleteKey}>⌫</Text>
        </TouchableOpacity>
      </View>

      {isAuthenticating ? (
        <View style={styles.authingRow}>
          <ActivityIndicator color="#FF6B6B" size="small" />
          <Text style={styles.authingText}>验证中…</Text>
        </View>
      ) : null}

      <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 12 }} disabled={isAuthenticating}>
        <Text style={styles.cancelText}>取消</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgCard, paddingHorizontal: 32, paddingTop: 60, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: Colors.neutral900, marginBottom: 10 },
  hint: { fontSize: 15, color: Colors.neutral400, marginBottom: 40 },
  dotsRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.neutral300 },
  dotActive: { backgroundColor: Colors.primary500, borderColor: Colors.primary500 },
  error: { color: Colors.error, fontSize: 14, fontWeight: '500', marginBottom: 30 },
  placeholder: { color: Colors.neutral300, fontSize: 14, marginBottom: 36 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%', gap: 12, marginBottom: 30 },
  key: { width: 80, height: 64, borderRadius: 18, backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { width: 80, height: 64 },
  keyText: { fontSize: 28, fontWeight: '500', color: Colors.neutral900 },
  deleteKey: { fontSize: 24, color: Colors.neutral400 },
  authingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  authingText: { fontSize: 14, color: Colors.neutral400 },
  cancelText: { color: Colors.neutral400, fontSize: 15 },
});
