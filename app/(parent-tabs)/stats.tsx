import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useBehaviorStore } from '@/stores/useBehaviorStore';
import { Colors, CategoryPalette, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

type Period = 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = { week: '本周', month: '本月', all: '全部' };
const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>('week');

  const { currentFamily, currentChild, children, selectChild } = useFamilyStore();
  const { tasks, completions, streaks, loadTasks, loadCompletions, loadStreaks } = useTaskStore();
  const { records, categories, rules, loadRecords, loadCategories, loadRules } = useBehaviorStore();

  useEffect(() => {
    if (!currentChild && children.length > 0) {
      selectChild(children[0].id);
      return;
    }
    if (!currentChild) return;
    const childId = currentChild.id;
    const familyId = currentFamily?.id || '';
    loadTasks(familyId, childId);
    loadCompletions(childId);
    loadStreaks(childId);
    loadRecords(childId);
    if (familyId) {
      void loadCategories(familyId);
      void loadRules(familyId);
    }
  }, [currentChild, children, selectChild, currentFamily, loadTasks, loadCompletions, loadStreaks, loadRecords, loadCategories, loadRules]);

  const filteredCompletions = useMemo(() => {
    const approved = completions.filter((c) => c.approved === 1);
    if (period === 'all') return approved;
    const cutoff = new Date();
    if (period === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setDate(cutoff.getDate() - 30);
    return approved.filter((c) => new Date(c.completed_at) >= cutoff);
  }, [completions, period]);

  const filteredRecords = useMemo(() => {
    if (period === 'all') return records;
    const cutoff = new Date();
    if (period === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setDate(cutoff.getDate() - 30);
    return records.filter((r) => new Date(r.created_at) >= cutoff);
  }, [records, period]);

  const weeklyBars = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() + mondayOffset + i);
      dayDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(dayDate);
      nextDay.setDate(dayDate.getDate() + 1);
      const dayCompletions = completions.filter(c => {
        const d = new Date(c.completed_at);
        return d >= dayDate && d < nextDay && c.approved === 1;
      });
      return {
        completed: dayCompletions.length,
        pointsEarned: dayCompletions.reduce(
          (sum, c) => sum + (tasks.find((t) => t.id === c.task_id)?.points_reward ?? 0), 0
        ),
      };
    });
  }, [completions, tasks]);

  const maxCompleted = useMemo(() => Math.max(1, ...weeklyBars.map((b) => b.completed)), [weeklyBars]);

  const totalPoints = useMemo(
    () => filteredRecords
      .filter((r) => r.approved === 1 && r.currency_type === 'points')
      .reduce((sum, r) => sum + r.points_change, 0),
    [filteredRecords]
  );

  const totalTasks = filteredCompletions.length;

  const assigneeTasks = useMemo(
    () => tasks.filter((t) => t.assignee_id === currentChild?.id),
    [tasks, currentChild?.id]
  );
  const completedAssignee = assigneeTasks.filter((t) => t.status === 'completed').length;
  const rate = assigneeTasks.length > 0 ? Math.round((completedAssignee / assigneeTasks.length) * 100) : 0;

  const streakDays = useMemo(() => {
    if (streaks.length === 0) return 0;
    return Math.max(...streaks.map(s => s.current_streak));
  }, [streaks]);

  const categoryData = useMemo(() => {
    if (!categories.length || !rules.length) return [];
    const ruleToCat = new Map(rules.map((r) => [r.id, r.category_id]));
    return categories
      .filter((c) => !c.is_hidden)
      .map((cat) => {
        const catRecords = filteredRecords.filter(
          (r) => r.approved === 1 && r.rule_id && ruleToCat.get(r.rule_id) === cat.id
        );
        const points = catRecords.reduce((sum, r) => sum + r.points_change, 0);
        return { name: cat.icon ? `${cat.icon} ${cat.name}` : cat.name, points: Math.max(0, points), color: cat.color || CategoryPalette.study };
      })
      .filter((c) => c.points > 0);
  }, [categories, rules, filteredRecords]);

  const maxCatPoints = useMemo(() => Math.max(1, ...categoryData.map(c => c.points)), [categoryData]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return '今天';
    if (d.getTime() === yesterday.getTime()) return '昨天';
    return `${d.getMonth() + 1}-${d.getDate()}`;
  };

  const recentRecords = useMemo(
    () => filteredRecords.filter((r) => r.approved === 1).slice(0, 20),
    [filteredRecords]
  );

  const todayIdx = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  if (!currentChild) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyPage}>
          <Text style={styles.emptyPageIcon}>👶</Text>
          <Text style={styles.emptyPageText}>请先在首页选择要查看的孩子档案</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 孩子选择器 */}
      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childRow}>
          {children.map((ch) => (
            <TouchableOpacity
              key={ch.id}
              style={[styles.childChip, currentChild?.id === ch.id && styles.childChipActive]}
              onPress={() => selectChild(ch.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.childChipAvatar}>{ch.avatar || '👦'}</Text>
              <Text style={[styles.childChipName, currentChild?.id === ch.id && styles.childChipNameActive]}>
                {ch.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 时间段选择 */}
      <View style={styles.periodBar}>
        {(['week', 'month', 'all'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 摘要卡片 */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>{PERIOD_LABELS[period]}数据摘要</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: Colors.secondary300 }]}>{rate}%</Text>
              <Text style={styles.summaryLabel}>任务完成率</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: Colors.primary500 }]}>{totalTasks}</Text>
              <Text style={styles.summaryLabel}>完成任务</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: Colors.warning }]}>{totalPoints}</Text>
              <Text style={styles.summaryLabel}>获得积分</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: Colors.error }]}>🔥{streakDays}</Text>
              <Text style={styles.summaryLabel}>连续天数</Text>
            </View>
          </View>
        </View>

        {/* 每日完成趋势 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>每日完成趋势</Text>
          {weeklyBars.every(b => b.completed === 0) ? (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={32} color={Colors.neutral300} />
              <Text style={styles.emptyText}>暂无数据</Text>
            </View>
          ) : (
            <View style={styles.barChart}>
              {DAY_LABELS.map((day, i) => {
                const isToday = i === todayIdx;
                const barH = Math.max(4, (weeklyBars[i].completed / maxCompleted) * 100);
                return (
                  <View key={i} style={styles.barCol}>
                    {weeklyBars[i].completed > 0 && (
                      <Text style={[styles.barValue, isToday && { color: Colors.primary500 }]}>
                        {weeklyBars[i].completed}
                      </Text>
                    )}
                    <View style={styles.barTrack}>
                      <View style={[
                        styles.barFill,
                        { height: barH, backgroundColor: isToday ? Colors.primary500 : Colors.secondary300 },
                      ]} />
                    </View>
                    <Text style={[styles.dayLabel, isToday && { color: Colors.primary500, fontWeight: '700' }]}>
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 各分类积分分布 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>各分类积分分布</Text>
          {categoryData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pie-chart-outline" size={32} color={Colors.neutral300} />
              <Text style={styles.emptyText}>暂无数据</Text>
            </View>
          ) : (
            categoryData.map((cat) => (
              <View key={cat.name} style={styles.catRow}>
                <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                <View style={styles.catTrack}>
                  <View style={[styles.catFill, { width: `${(cat.points / maxCatPoints) * 100}%`, backgroundColor: cat.color }]} />
                </View>
                <Text style={[styles.catPoints, { color: cat.color }]}>{cat.points}</Text>
              </View>
            ))
          )}
        </View>

        {/* 积分收支明细 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>积分收支明细</Text>
          {recentRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={32} color={Colors.neutral300} />
              <Text style={styles.emptyText}>暂无数据</Text>
            </View>
          ) : (
            recentRecords.map((record, idx) => (
              <View key={record.id} style={[styles.recordRow, idx === recentRecords.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.recordDateWrap}>
                  <Text style={styles.recordDate}>{formatDate(record.created_at)}</Text>
                </View>
                <Text style={styles.recordDesc} numberOfLines={1}>{record.reason || '积分变动'}</Text>
                <Text style={[styles.recordChange, record.points_change >= 0 ? styles.income : styles.expense]}>
                  {record.points_change >= 0 ? `+${record.points_change}` : `${record.points_change}`}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: Spacing[6] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  childRow: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  childChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.neutral200,
    backgroundColor: Colors.bgCard,
  },
  childChipActive: { backgroundColor: Colors.primary50, borderColor: Colors.primary500 },
  childChipAvatar: { fontSize: Typography.sm + 2 },
  childChipName: { fontSize: Typography.sm, fontWeight: '600', color: Colors.neutral500 },
  childChipNameActive: { color: Colors.primary500 },

  periodBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  periodBtn: {
    flex: 1, paddingVertical: Spacing.sm + 1,
    borderRadius: BorderRadius.button, alignItems: 'center',
    backgroundColor: Colors.neutral100,
  },
  periodBtnActive: { backgroundColor: Colors.primary500 },
  periodText: { fontSize: Typography.sm + 1, fontWeight: '600', color: Colors.neutral500 },
  periodTextActive: { color: Colors.bgCard },

  content: { paddingHorizontal: Spacing[4], paddingTop: Spacing[3] },

  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing[5],
    marginBottom: Spacing[3],
    ...Shadows.md,
  },
  summaryGrid: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: Typography['2xl'], fontWeight: '800' },
  summaryLabel: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: Spacing[1] },
  summaryDivider: { width: 1, height: 40, backgroundColor: Colors.neutral100 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[4],
    marginBottom: Spacing[3],
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: Typography.base, fontWeight: '700', color: Colors.neutral800,
    marginBottom: Spacing[3],
  },

  barChart: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: 140, gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center', gap: Spacing[1] },
  barValue: { fontSize: Typography.xs - 1, fontWeight: '700', color: Colors.neutral500 },
  barTrack: {
    flex: 1, width: '80%', backgroundColor: Colors.neutral100,
    borderRadius: BorderRadius.xs, justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: BorderRadius.xs },
  dayLabel: { fontSize: Typography.xs - 1, color: Colors.neutral400 },

  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing[2] + 2 },
  catName: { width: 72, fontSize: Typography.sm, fontWeight: '500', color: Colors.neutral700 },
  catTrack: {
    flex: 1, height: 10, backgroundColor: Colors.neutral100,
    borderRadius: 5, marginHorizontal: Spacing.sm, overflow: 'hidden',
  },
  catFill: { height: 10, borderRadius: 5, minWidth: 4 },
  catPoints: { width: 36, textAlign: 'right', fontSize: Typography.sm, fontWeight: '700' },

  recordRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing[2] + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral100,
    gap: Spacing.sm,
  },
  recordDateWrap: {
    width: 40, alignItems: 'center',
    backgroundColor: Colors.neutral100,
    borderRadius: BorderRadius.xs,
    paddingVertical: 3,
  },
  recordDate: { fontSize: Typography.xs - 1, color: Colors.neutral500, fontWeight: '600' },
  recordDesc: { flex: 1, fontSize: Typography.sm + 1, color: Colors.neutral800 },
  recordChange: { fontSize: Typography.base, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  income: { color: Colors.success },
  expense: { color: Colors.error },

  emptyState: { alignItems: 'center', paddingVertical: Spacing[5], gap: Spacing[2] },
  emptyText: { fontSize: Typography.sm + 1, color: Colors.neutral300 },

  emptyPage: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing[3] },
  emptyPageIcon: { fontSize: 48 },
  emptyPageText: { fontSize: Typography.base, color: Colors.neutral400 },
});
