import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { usePetStore } from '@/stores/usePetStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { MOOD_EMOJI, HEALTH_EMOJI } from '@/types';
import { Pet } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import PetAvatar from '@/components/PetAvatar';

export default function ParentHomeScreen() {
  const router = useRouter();
  const { currentFamily, children, loadChildren, selectChild } = useFamilyStore();
  const { loadPet } = usePetStore();
  const { tasks, loadTasks } = useTaskStore();
  const [childPets, setChildPets] = useState<Record<string, Pet>>({});

  useEffect(() => {
    if (currentFamily) {
      loadChildren(currentFamily.id);
      loadTasks(currentFamily.id);
    }
  }, [currentFamily?.id]);

  useEffect(() => {
    if (children.length === 0) return;
    let cancelled = false;
    const loadPetsSequentially = async () => {
      const results: Record<string, Pet> = {};
      for (const child of children) {
        await loadPet(child.id);
        const petState = usePetStore.getState().pet;
        if (petState && !cancelled) results[child.id] = petState;
      }
      if (!cancelled) setChildPets(results);
    };
    loadPetsSequentially();
    return () => { cancelled = true; };
  }, [children.length]);

  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.created_at?.startsWith(today));
  const completedToday = tasks.filter(t => t.status === 'completed').length;
  const pendingApprovals = tasks.filter(t => t.status === 'submitted').length;

  const getChildTaskStats = (childId: string) => {
    const childTasks = tasks.filter(t => t.assignee_id === childId);
    return { completed: childTasks.filter(t => t.status === 'completed').length, total: childTasks.length };
  };

  const handleChildCardPress = useCallback(async (childId: string) => {
    await selectChild(childId);
    router.push('/(parent-tabs)/stats');
  }, [selectChild, router]);

  const QUICK_ACTIONS = [
    { emoji: 'clipboard-outline', label: '布置任务', route: '/(parent-tabs)/tasks' as const, color: Colors.secondary300 },
    { emoji: 'star-outline', label: '行为评价', route: '/(parent-tabs)/behavior' as const, color: Colors.warning },
    { emoji: 'bar-chart-outline', label: '查看数据', route: '/(parent-tabs)/stats' as const, color: Colors.info },
    { emoji: 'storefront-outline', label: '商城管理', route: '/(parent-tabs)/shop' as const, color: Colors.primary500 },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* 家庭信息 banner */}
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerGreeting}>你好，家长 👋</Text>
            <Text style={styles.bannerFamily}>{currentFamily?.name || '我的家庭'}</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/(parent-tabs)/settings')}>
            <Ionicons name="settings-outline" size={22} color={Colors.neutral600} />
          </TouchableOpacity>
        </View>

        {/* 概览卡片 */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>今日概览</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{completedToday}</Text>
              <Text style={styles.statSub}>/ {todayTasks.length}</Text>
              <Text style={styles.statLabel}>任务完成</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, pendingApprovals > 0 && { color: Colors.warning }]}>
                {pendingApprovals}
              </Text>
              <Text style={styles.statSub}> </Text>
              <Text style={styles.statLabel}>待审核</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{children.length}</Text>
              <Text style={styles.statSub}> </Text>
              <Text style={styles.statLabel}>孩子数</Text>
            </View>
          </View>
        </View>

        {/* 待审核通知 */}
        {pendingApprovals > 0 && (
          <TouchableOpacity style={styles.noticeBanner} onPress={() => router.push('/(parent-tabs)/tasks')} activeOpacity={0.8}>
            <View style={styles.noticeDot} />
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>有 {pendingApprovals} 条任务待审核</Text>
              <Text style={styles.noticeDesc}>点击前往确认或驳回</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* 孩子档案 */}
        <Text style={styles.sectionTitle}>孩子档案</Text>
        {children.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👶</Text>
            <Text style={styles.emptyText}>还没有孩子档案</Text>
          </View>
        ) : (
          children.map((child) => {
            const pet = childPets[child.id];
            const taskStats = getChildTaskStats(child.id);
            const progress = taskStats.total > 0 ? taskStats.completed / taskStats.total : 0;
            return (
              <TouchableOpacity
                key={child.id}
                style={styles.childCard}
                activeOpacity={0.8}
                onPress={() => void handleChildCardPress(child.id)}
              >
                <Text style={styles.childAvatar}>{child.avatar || '👦'}</Text>
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <View style={styles.progressRow}>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Text style={styles.progressLabel}>{taskStats.completed}/{taskStats.total}</Text>
                  </View>
                </View>
                <View style={styles.childRight}>
                  <PetAvatar speciesId={pet?.species_id || 'dragon'} stage={pet?.current_stage || 1} size={44} />
                  <Text style={styles.petStatus}>
                    {pet ? `${MOOD_EMOJI[pet.mood_type] || '🙂'} ${HEALTH_EMOJI[pet.health_type] || '💚'}` : '🥚'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* 快捷操作 */}
        <Text style={styles.sectionTitle}>快捷操作</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickCard}
              onPress={() => router.push(action.route)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: action.color + '18' }]}>
                <Ionicons name={action.emoji as any} size={24} color={action.color} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: Spacing[6] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scrollContent: { paddingHorizontal: Spacing[4], paddingTop: Spacing[3] },

  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  bannerGreeting: { fontSize: Typography.sm, color: Colors.neutral500, marginBottom: 2 },
  bannerFamily: { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.neutral900 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },

  overviewCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing[5],
    marginBottom: Spacing[3],
    ...Shadows.md,
  },
  overviewTitle: { fontSize: Typography.sm, fontWeight: '600', color: Colors.neutral500, marginBottom: Spacing[3], textTransform: 'uppercase', letterSpacing: 0.8 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: Typography['3xl'], fontWeight: '800', color: Colors.neutral900 },
  statSub: { fontSize: Typography.sm, color: Colors.neutral400, marginTop: -2 },
  statLabel: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: Spacing[1] },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.neutral100 },

  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing[3],
    marginBottom: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    gap: Spacing.sm,
  },
  noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: Typography.sm + 1, fontWeight: '700', color: Colors.warningDark },
  noticeDesc: { fontSize: Typography.xs, color: Colors.warning, marginTop: 1 },

  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: Colors.neutral500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing[2],
    marginTop: Spacing[1],
  },

  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[4],
    marginBottom: Spacing[2],
    gap: Spacing[3],
    ...Shadows.sm,
  },
  childAvatar: { fontSize: 36 },
  childInfo: { flex: 1 },
  childName: { fontSize: Typography.base + 1, fontWeight: '700', color: Colors.neutral900, marginBottom: Spacing[1] + 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBg: { flex: 1, height: 6, backgroundColor: Colors.neutral100, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.secondary300, borderRadius: 3 },
  progressLabel: { fontSize: Typography.xs, color: Colors.neutral400, width: 32, textAlign: 'right' },
  childRight: { alignItems: 'center', gap: 4 },
  petStatus: { fontSize: Typography.xs, color: Colors.neutral400 },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginBottom: Spacing[2],
  },
  quickCard: {
    width: '47.5%',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[4],
    alignItems: 'flex-start',
    gap: Spacing[2],
    ...Shadows.sm,
  },
  quickIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontSize: Typography.sm + 1, fontWeight: '600', color: Colors.neutral800 },

  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[6],
    alignItems: 'center',
    marginBottom: Spacing[3],
    ...Shadows.xs,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing[2] },
  emptyText: { fontSize: Typography.sm + 1, color: Colors.neutral400 },
});
