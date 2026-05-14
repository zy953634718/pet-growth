import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFamilyStore } from '@/stores/useFamilyStore';

import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

export default function RoleSelectScreen() {
  const router = useRouter();
  const { currentFamily, children, loadChildren, selectChild, setRole } = useFamilyStore();

  useEffect(() => {
    if (currentFamily?.id) {
      void loadChildren(currentFamily.id);
    }
  }, [currentFamily?.id, loadChildren]);

  const enterChild = () => {
    if (children.length === 0) {
      Alert.alert('提示', '还没有孩子档案，请用家长端检查家庭设置');
      return;
    }
    if (children.length === 1) {
      selectChild(children[0].id);
    } else if (!useFamilyStore.getState().currentChild) {
      selectChild(children[0].id);
    }
    setRole('child');
    router.replace('/(child-tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>选择你的身份</Text>
      <Text style={styles.subtitle}>你是家长还是孩子呢？</Text>

      <TouchableOpacity style={[styles.card, styles.childCard]} onPress={enterChild} activeOpacity={0.85}>
        <Text style={styles.cardEmoji}>👦</Text>
        <Text style={styles.cardTitle}>孩子端</Text>
        <Text style={styles.cardDesc}>查看任务 · 照顾宠物{'\n'}兑换商城 · 和宠物聊天</Text>
        <View style={styles.enterBadge}><Text style={styles.enterText}>进入 →</Text></View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.parentCard]}
        onPress={() => router.push({ pathname: '/ParentLock', params: { target: 'parent' } })}
        activeOpacity={0.85}
      >
        <Text style={styles.cardEmoji}>👨‍👩‍👧</Text>
        <Text style={styles.cardTitle}>家长端</Text>
        <Text style={styles.cardDesc}>管理行为规则 · 布置任务{'\n'}审核确认 · 查看数据</Text>
        <View style={styles.lockBadge}><Text style={styles.lockText}>🔐 需要密码</Text></View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: Spacing[7], paddingTop: Spacing[12] + 2 },
  title: { fontSize: Typography['3xl'], fontWeight: 'bold', color: Colors.neutral900, textAlign: 'center', marginBottom: Spacing['1.5'] },
  subtitle: { fontSize: Typography.base, color: Colors.neutral400, textAlign: 'center', marginBottom: Spacing[9] },
  card: { borderRadius: BorderRadius['3xl'], padding: Spacing[7], alignItems: 'center', marginBottom: Spacing['4.5'], ...Shadows.lg },
  childCard: { backgroundColor: Colors.bgCard, borderWidth: 2, borderColor: Colors.borderMint },
  parentCard: { backgroundColor: Colors.bgCard, borderWidth: 2, borderColor: Colors.primary200 },
  cardEmoji: { fontSize: 52, marginBottom: Spacing[3] },
  cardTitle: { fontSize: Typography['2xl'], fontWeight: 'bold', color: Colors.neutral900, marginBottom: Spacing['2.5'] },
  cardDesc: { fontSize: Typography.base, color: Colors.neutral500, textAlign: 'center', lineHeight: 22, marginBottom: Spacing[4] },
  enterBadge: { backgroundColor: Colors.secondary300, paddingHorizontal: Spacing[5], paddingVertical: Spacing['2.5'] - 1, borderRadius: BorderRadius.xl },
  enterText: { color: Colors.bgCard, fontSize: Typography.base, fontWeight: '600' },
  lockBadge: { backgroundColor: Colors.bgCoralSoft, paddingHorizontal: Spacing[5], paddingVertical: Spacing['2.5'] - 1, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.borderCoral },
  lockText: { color: Colors.primary500, fontSize: Typography.base, fontWeight: '600' },
});
