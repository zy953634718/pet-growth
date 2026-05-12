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
  container: { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: 28, paddingTop: 50 },
  title: { fontSize: 26, fontWeight: 'bold', color: Colors.neutral900, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.neutral400, textAlign: 'center', marginBottom: 36 },
  card: { borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  childCard: { backgroundColor: Colors.bgCard, borderWidth: 2, borderColor: '#B8F5E8' },
  parentCard: { backgroundColor: Colors.bgCard, borderWidth: 2, borderColor: Colors.primary200 },
  cardEmoji: { fontSize: 52, marginBottom: 12 },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.neutral900, marginBottom: 10 },
  cardDesc: { fontSize: 14, color: Colors.neutral500, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  enterBadge: { backgroundColor: Colors.secondary300, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 16 },
  enterText: { color: Colors.bgCard, fontSize: 15, fontWeight: '600' },
  lockBadge: { backgroundColor: '#FFF0E6', paddingHorizontal: 20, paddingVertical: 9, borderRadius: 16, borderWidth: 1, borderColor: '#FFD1CC' },
  lockText: { color: Colors.primary500, fontSize: 15, fontWeight: '600' },
});
