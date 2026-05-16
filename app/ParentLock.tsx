import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

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

  const expectedLen = currentFamily?.parent_pin_length ?? 6;
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
      {/* 顶部 */}
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🔐</Text>
        </View>
        <Text style={styles.title}>家长验证</Text>
        <Text style={styles.subtitle}>请输入家长密码以继续</Text>
      </View>

      {/* 密码点阵 */}
      <View style={styles.dotsRow}>
        {Array.from({ length: dotCount }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < input.length && styles.dotActive,
              !!error && styles.dotError,
            ]}
          />
        ))}
      </View>

      {/* 状态提示（固定高度，避免抖动） */}
      <View style={styles.statusWrap}>
        {isAuthenticating ? (
          <View style={styles.authingRow}>
            <ActivityIndicator color={Colors.primary500} size="small" />
            <Text style={styles.authingText}>验证中…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <Text style={styles.placeholder}>输入 {dotCount} 位数字密码</Text>
        )}
      </View>

      {/* 键盘 */}
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <TouchableOpacity
            key={k}
            style={styles.key}
            onPress={() => handlePress(k)}
            activeOpacity={0.6}
            disabled={isAuthenticating}
          >
            <Text style={styles.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.keyEmpty} />
        <TouchableOpacity
          style={styles.key}
          onPress={() => handlePress('0')}
          activeOpacity={0.6}
          disabled={isAuthenticating}
        >
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.key, styles.keyMuted]}
          onPress={() => !isAuthenticating && setInput(input.slice(0, -1))}
          activeOpacity={0.6}
          disabled={isAuthenticating}
        >
          <Text style={styles.deleteKey}>⌫</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.cancelBtn}
        disabled={isAuthenticating}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelText}>取消</Text>
      </TouchableOpacity>
    </View>
  );
}

const KEY_SIZE = 68;
const KEY_GAP = 14;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[12],
    paddingBottom: Spacing[5],
    alignItems: 'center',
  },

  // ── 顶部 ──
  header: {
    alignItems: 'center',
    marginBottom: Spacing[6],
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primary50,
    borderWidth: 2,
    borderColor: Colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[3],
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: Typography['3xl'],
    fontWeight: 'bold',
    color: Colors.neutral900,
    marginBottom: Spacing[1],
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.neutral500,
  },

  // ── 点阵 ──
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.neutral300,
    backgroundColor: Colors.bgCard,
  },
  dotActive: {
    backgroundColor: Colors.primary500,
    borderColor: Colors.primary500,
  },
  dotError: {
    borderColor: Colors.error,
  },

  // ── 状态行（固定高度） ──
  statusWrap: {
    height: 22,
    justifyContent: 'center',
    marginBottom: Spacing[5],
  },
  authingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  authingText: {
    fontSize: Typography.sm + 1,
    color: Colors.primary500,
    fontWeight: '500',
  },
  error: {
    color: Colors.error,
    fontSize: Typography.sm + 1,
    fontWeight: '500',
  },
  placeholder: {
    color: Colors.neutral400,
    fontSize: Typography.sm + 1,
  },

  // ── 键盘 ──
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: KEY_SIZE * 3 + KEY_GAP * 2,
    gap: KEY_GAP,
    marginBottom: Spacing[5],
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderMuted,
    ...Shadows.xs,
  },
  keyMuted: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  keyEmpty: {
    width: KEY_SIZE,
    height: KEY_SIZE,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
    color: Colors.neutral900,
  },
  deleteKey: {
    fontSize: 24,
    color: Colors.neutral500,
  },

  // ── 取消 ──
  cancelBtn: {
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[6],
  },
  cancelText: {
    color: Colors.neutral500,
    fontSize: Typography.base,
    fontWeight: '500',
  },
});
