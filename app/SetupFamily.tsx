import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { ensureAIForFamily, importPresets } from '@/db/database';

import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

const AGE_RANGES = ['6-8', '9-10', '11-12'];
const AGE_LABELS: Record<string, string> = { '6-8': '低年级（1-2年级）', '9-10': '中年级（3-4年级）', '11-12': '高年级（5-6年级）' };

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

  useEffect(() => {
    if (fresh !== '1') {
      setPurgeReady(true);
      return;
    }
    let cancelled = false;
    void purgeAllLocalData()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPurgeReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fresh, purgeAllLocalData]);

  const handleNext = async () => {
    if (!purgeReady) return Alert.alert('提示', '正在清理本地数据，请稍候');
    if (!familyName.trim()) return Alert.alert('提示', '请输入家庭名称');
    if (password.length < 4) return Alert.alert('提示', '家长密码至少4位数字');
    if (!childName.trim()) return Alert.alert('提示', '请输入孩子的昵称');

    setIsCreating(true);
    try {
      // 创建家庭
      const family = await createFamily(familyName, password);
      await importPresets(family.id);
      await ensureAIForFamily(family.id);
      // 添加孩子（宠物在下一步 SetupPet 中创建）
      const child = await addChild(childName, ageRange);
      // 导航到宠物选择页面，传递孩子ID
      router.replace({
        pathname: '/SetupPet',
        params: { childId: child.id },
      });
    } catch (error) {
      console.error('创建家庭失败 [详细]:', error);
      Alert.alert('错误', `创建失败: ${error instanceof Error ? error.message : String(error)}`);
      setIsCreating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepIndicator}>第 1 步 / 共 2 步</Text>
      <Text style={styles.title}>创建你的家庭</Text>
      <Text style={styles.subtitle}>设置家庭信息，添加孩子档案</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>🏠 家庭名称</Text>
        <TextInput style={styles.input} placeholder="例如：小明家" value={familyName} onChangeText={setFamilyName} maxLength={20} />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>🔐 家长密码</Text>
        <TextInput style={[styles.input, styles.passwordInput]} placeholder="输入4-6位数字密码" value={password}
          onChangeText={(t) => setPassword(t.replace(/[^0-9]/g, '').slice(0, 6))} secureTextEntry keyboardType="number-pad" maxLength={6} />
        <Text style={styles.hint}>用于进入家长管理端，请记住密码</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>👶 孩子信息</Text>
        <TextInput style={styles.input} placeholder="孩子的昵称" value={childName} onChangeText={setChildName} maxLength={10} />
        <Text style={styles.label2}>年龄段</Text>
        <View style={styles.ageRow}>
          {AGE_RANGES.map((r) => (
            <TouchableOpacity key={r} style={[styles.ageBtn, ageRange === r && styles.ageBtnActive]} onPress={() => setAgeRange(r)}>
              <Text style={[styles.ageText, ageRange === r && styles.ageTextActive]}>{AGE_LABELS[r]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.nextBtn, (!purgeReady || isCreating) && styles.nextBtnDisabled]}
        onPress={handleNext}
        activeOpacity={0.85}
        disabled={!purgeReady || isCreating}
      >
        {!purgeReady ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : isCreating ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.nextBtnText}>下一步 →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 24, paddingTop: 20 },
  stepIndicator: { fontSize: 13, color: Colors.primary500, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.neutral900, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.neutral400, textAlign: 'center', marginBottom: 32 },
  fieldGroup: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: '600', color: Colors.neutral800, marginBottom: 8 },
  label2: { fontSize: 14, color: Colors.neutral600, marginTop: 12, marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, backgroundColor: Colors.neutral50 },
  passwordInput: { letterSpacing: 8 },
  hint: { fontSize: 12, color: Colors.neutral400, marginTop: 6, marginLeft: 2 },
  ageRow: { flexDirection: 'row', gap: 8 },
  ageBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center' },
  ageBtnActive: { borderColor: Colors.primary500, backgroundColor: Colors.primary50 },
  ageText: { fontSize: 12, color: Colors.neutral500, fontWeight: '500' },
  ageTextActive: { color: Colors.primary500, fontWeight: '700' },
  nextBtn: { backgroundColor: Colors.primary500, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: Colors.primary500, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  nextBtnDisabled: { opacity: 0.65 },
  nextBtnText: { color: Colors.bgCard, fontSize: 17, fontWeight: 'bold' },
});
