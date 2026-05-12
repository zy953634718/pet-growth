import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

  // Load pet for each child sequentially to avoid race conditions in shared store
  useEffect(() => {
    if (children.length === 0) return;

    let cancelled = false;
    const loadPetsSequentially = async () => {
      const results: Record<string, Pet> = {};
      for (const child of children) {
        // Temporarily set currentChild so loadPet targets the right pet
        await loadPet(child.id);
        const petState = usePetStore.getState().pet;
        if (petState && !cancelled) {
          results[child.id] = petState;
        }
      }
      if (!cancelled) {
        setChildPets(results);
      }
    };

    loadPetsSequentially();
    return () => { /* no-op cleanup */ };
  }, [children.length]);

  // Compute stats from real data
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.created_at?.startsWith(today));
  const completedToday = tasks.filter(t => t.status === 'completed').length;
  const pendingApprovals = tasks.filter(t => t.status === 'submitted').length;

  // Compute per-child task stats
  const getChildTaskStats = (childId: string) => {
    const childTasks = tasks.filter(t => t.assignee_id === childId);
    const childCompleted = childTasks.filter(t => t.status === 'completed').length;
    return { completed: childCompleted, total: childTasks.length };
  };

  // Navigate to stats for selected child
  const handleChildCardPress = useCallback(async (childId: string) => {
    await selectChild(childId);
    router.push('/(parent-tabs)/stats');
  }, [selectChild, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 头部 */}
        <View style={styles.header}>
          <Text style={styles.familyName}>🏠 {currentFamily?.name || '我的家庭'}</Text>
          <TouchableOpacity onPress={() => router.push('/(parent-tabs)/settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* 概览卡片 */}
        <View style={styles.overviewCard}>
          <Text style={styles.todayTitle}>今日概览</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{completedToday}/{todayTasks.length}</Text>
              <Text style={styles.statLabel}>任务完成</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.statItem, pendingApprovals > 0 && styles.pendingItem]}>
              <Text style={styles.statNum}>{pendingApprovals}</Text>
              <Text style={styles.statLabel}>待审核</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{children.length}</Text>
              <Text style={styles.statLabel}>孩子数</Text>
            </View>
          </View>
        </View>

        {/* 孩子列表 */}
        <Text style={styles.sectionTitle}>👶 孩子档案</Text>
        {children.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>还没有孩子档案</Text>
          </View>
        ) : (
          children.map((child) => {
            const pet = childPets[child.id];
            const taskStats = getChildTaskStats(child.id);
            return (
              <TouchableOpacity
                key={child.id}
                style={styles.childCard}
                activeOpacity={0.8}
                onPress={() => void handleChildCardPress(child.id)}
              >
                <View style={styles.childLeft}>
                  <Text style={styles.childAvatar}>{child.avatar || '👦'}</Text>
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{child.name}</Text>
                    <Text style={styles.childTaskStat}>
                      已完成 {taskStats.completed}/{taskStats.total} 任务
                    </Text>
                  </View>
                </View>
                <View style={styles.childRight}>
                  <PetAvatar speciesId={pet?.species_id || 'dragon'} stage={pet?.current_stage || 1} size={40} />
                  <Text style={styles.petHealthText}>
                    {pet ? `${MOOD_EMOJI[pet.mood_type] || '🙂'} · ${HEALTH_EMOJI[pet.health_type] || '💚'}` : '🥚'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* 快捷操作 */}
        <Text style={styles.sectionTitle}>⚡ 快捷操作</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(parent-tabs)/tasks')}
            activeOpacity={0.8}
          >
            <Text style={styles.quickEmoji}>➕</Text>
            <Text style={styles.quickLabel}>布置任务</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(parent-tabs)/behavior')}
            activeOpacity={0.8}
          >
            <Text style={styles.quickEmoji}>✏️</Text>
            <Text style={styles.quickLabel}>行为评价</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(parent-tabs)/stats')}
            activeOpacity={0.8}
          >
            <Text style={styles.quickEmoji}>📊</Text>
            <Text style={styles.quickLabel}>查看数据</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(parent-tabs)/shop')}
            activeOpacity={0.8}
          >
            <Text style={styles.quickEmoji}>🛍️</Text>
            <Text style={styles.quickLabel}>商城管理</Text>
          </TouchableOpacity>
        </View>

        {/* 待审核通知 */}
        {pendingApprovals > 0 && (
          <TouchableOpacity
            style={styles.noticeBanner}
            onPress={() => router.push('/(parent-tabs)/tasks')}
            activeOpacity={0.8}
          >
            <Text style={styles.noticeIcon}>🔔</Text>
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>有 {pendingApprovals} 条任务待审核</Text>
              <Text style={styles.noticeDesc}>点击前往确认或驳回</Text>
            </View>
            <Text style={styles.noticeArrow}>›</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: Spacing[4] + 4 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scrollContent: {
    padding: Spacing[4] + 2,
    paddingTop: Spacing[2] + 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  familyName: {
    fontSize: Typography['2xl'] + 2,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  settingsIcon: {
    fontSize: Typography.xl + 2,
  },
  overviewCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing[4] + 4,
    marginBottom: Spacing[4] + 4,
    ...Shadows.sm,
  },
  todayTitle: {
    fontSize: Typography.base + 2,
    fontWeight: '700',
    color: Colors.neutral900,
    marginBottom: Spacing[3] + 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  pendingItem: {},
  statNum: {
    fontSize: Typography['3xl'] - 2,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: Spacing[4] + 8,
    backgroundColor: Colors.neutral200,
  },
  sectionTitle: {
    fontSize: Typography.base + 2,
    fontWeight: '700',
    color: Colors.neutral900,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  childCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.card,
    padding: Spacing[4],
    marginBottom: Spacing.sm + 2,
    ...Shadows.xs,
  },
  childLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  childAvatar: {
    fontSize: Typography['2xl'] + 6,
  },
  childInfo: {},
  childName: {
    fontSize: Typography.base + 2,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  childTaskStat: {
    fontSize: Typography.xs,
    color: Colors.neutral500,
    marginTop: Spacing.xs,
  },
  childRight: {
    alignItems: 'flex-end',
  },
  petStatusEmoji: {
    fontSize: Typography['2xl'] + 8,
  },
  petHealthText: {
    fontSize: Typography.xs - 1,
    color: Colors.neutral400,
    marginTop: Spacing.xs,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.card,
    padding: Spacing[3] + 2,
    alignItems: 'center',
    ...Shadows.xs,
  },
  quickEmoji: {
    fontSize: Typography['3xl'] - 2,
    marginBottom: Spacing.xs,
  },
  quickLabel: {
    fontSize: Typography.xs,
    color: Colors.neutral600,
    fontWeight: '500',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.card,
    padding: Spacing[3] + 2,
    borderWidth: 1,
    borderColor: Colors.starBorder,
    marginTop: Spacing[3] + 2,
  },
  noticeIcon: {
    fontSize: Typography['2xl'] + 4,
  },
  noticeContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  noticeTitle: {
    fontSize: Typography.sm + 1,
    fontWeight: '600',
    color: Colors.warning,
  },
  noticeDesc: {
    fontSize: Typography.xs,
    color: Colors.warning,
    marginTop: 2,
  },
  noticeArrow: {
    fontSize: Typography['2xl'] + 4,
    color: Colors.neutral300,
  },
  emptyState: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.card,
    padding: Spacing[4] + 6,
    alignItems: 'center',
    marginBottom: Spacing.sm + 2,
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.neutral300,
  },
});
