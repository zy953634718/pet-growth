import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useBehaviorStore } from '@/stores/useBehaviorStore';

import { Colors, Typography, Spacing, BorderRadius, Shadows, TouchTarget } from '@/theme';

type Period = 'week' | 'month' | 'all';

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

  // Filter completions by period（仅已通过审核）
  const filteredCompletions = useMemo(() => {
    const approved = completions.filter((c) => c.approved === 1);
    if (period === 'all') return approved;
    const now = new Date();
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else cutoff.setDate(now.getDate() - 30);
    return approved.filter((c) => new Date(c.completed_at) >= cutoff);
  }, [completions, period]);

  // Filter records by period
  const filteredRecords = useMemo(() => {
    if (period === 'all') return records;
    const now = new Date();
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else cutoff.setDate(now.getDate() - 30);
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
          (sum, c) => sum + (tasks.find((t) => t.id === c.task_id)?.points_reward ?? 0),
          0
        ),
      };
    });
  }, [completions, tasks]);

  const maxCompleted = useMemo(() => Math.max(0, ...weeklyBars.map((b) => b.completed)), [weeklyBars]);
  const totalPoints = useMemo(
    () =>
      filteredRecords
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
  const rate =
    assigneeTasks.length > 0 ? Math.round((completedAssignee / assigneeTasks.length) * 100) : 0;
  const streakDays = useMemo(() => {
    if (streaks.length === 0) return 0;
    return Math.max(...streaks.map(s => s.current_streak));
  }, [streaks]);

  // 行为分类积分：通过 rule_id → behavior_rules.category_id 汇总
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
        return {
          name: cat.icon ? `${cat.icon} ${cat.name}` : cat.name,
          points: Math.max(0, points),
          color: cat.color || '#4A90D9',
        };
      })
      .filter((c) => c.points > 0);
  }, [categories, rules, filteredRecords]);

  // Format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return '今天';
    if (d.getTime() === yesterday.getTime()) return '昨天';
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${m}-${day}`;
  };

  const recentRecords = useMemo(
    () =>
      filteredRecords
        .filter((r) => r.approved === 1)
        .slice(0, 20),
    [filteredRecords]
  );

  if (!currentChild) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Text style={{ fontSize: 16, color: Colors.neutral400 }}>请先在首页选择要查看的孩子档案</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 成长数据</Text>
      </View>

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

      {/* 时间选择 */}
      <View style={styles.periodRow}>
        {(['week', 'month', 'all'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p === 'week' ? '本周' : p === 'month' ? '本月' : '全部'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 周报摘要卡片 */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>📈 {period === 'week' ? '本周' : period === 'month' ? '本月' : '全部'}数据摘要</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{rate}%</Text>
              <Text style={styles.summaryLabel}>任务完成率</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{totalTasks}</Text>
              <Text style={styles.summaryLabel}>完成任务</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{totalPoints}</Text>
              <Text style={styles.summaryLabel}>获得积分</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>🔥 {streakDays}</Text>
              <Text style={styles.summaryLabel}>连续天数</Text>
            </View>
          </View>
        </View>

        {/* 任务完成率柱状图 */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>每日完成趋势</Text>
          {weeklyBars.length === 0 || weeklyBars.every(b => b.completed === 0) ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>暂无数据</Text>
            </View>
          ) : (
            <View style={styles.barChart}>
              {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barValue}>{weeklyBars[i].completed}</Text>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: Math.max(
                            6,
                            (weeklyBars[i].completed / (maxCompleted || 1)) * 112
                          ),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.dayLabel}>{day}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 各分类积分分布 */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>各分类积分分布</Text>
          {categoryData.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>暂无数据</Text>
            </View>
          ) : (
            categoryData.map((cat) => {
              const maxCatPoints = Math.max(...categoryData.map(c => c.points), 1);
              return (
                <View key={cat.name} style={styles.catRow}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <View style={styles.catBarBg}>
                    <View
                      style={[styles.catBarFill, { width: `${(cat.points / maxCatPoints) * 100}%`, backgroundColor: cat.color }]}
                    />
                  </View>
                  <Text style={styles.catPoints}>{cat.points}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* 积分收支明细（简化版） */}
        <View style={styles.detailCard}>
          <Text style={styles.chartTitle}>积分收支明细</Text>
          {recentRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>暂无数据</Text>
            </View>
          ) : (
            recentRecords.map((record) => (
              <View key={record.id} style={styles.recordRow}>
                <Text style={styles.recordDate}>{formatDate(record.created_at)}</Text>
                <View style={styles.recordDesc}>
                  <Text style={styles.recordDescText} numberOfLines={1}>{record.reason || '积分变动'}</Text>
                </View>
                <Text style={[styles.recordChange, record.points_change >= 0 ? styles.income : styles.expense]}>
                  {record.points_change >= 0 ? `+${record.points_change}` : `${record.points_change}`}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.neutral900 },
  periodRow: { flexDirection: 'row', marginHorizontal: 18, gap: 7, marginBottom: 12 },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.neutral200 },
  periodActive: { backgroundColor: Colors.bgCard, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  periodText: { fontSize: 13, fontWeight: '600', color: Colors.neutral400 },
  periodTextActive: { color: Colors.neutral900 },
  content: { paddingHorizontal: Spacing[4] },

  // 孩子选择器
  childRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[4],
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs - 1,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.neutral200,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  childChipActive: {
    backgroundColor: Colors.primary50,
    borderColor: Colors.primary200,
  },
  childChipAvatar: { fontSize: Typography.sm + 1 },
  childChipName: { fontSize: Typography.xs + 1, fontWeight: '600', color: Colors.neutral500 },
  childChipNameActive: { color: Colors.primary500 },

  // 周报摘要
  summaryCard: {
    backgroundColor: Colors.bgCard, borderRadius: 18, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.neutral900, marginBottom: 14 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: {
    width: '47%', backgroundColor: Colors.bgPrimary, borderRadius: 14, padding: 14, alignItems: 'center',
  },
  summaryNum: { fontSize: 26, fontWeight: 'bold', color: Colors.primary500 },
  summaryLabel: { fontSize: 11, color: Colors.neutral400, marginTop: 4 },

  // 柱状图
  chartCard: {
    backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  chartTitle: { fontSize: 15, fontWeight: '700', color: Colors.neutral900, marginBottom: 14 },
  barChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingHorizontal: 4 },
  barCol: { alignItems: 'center', gap: 4, flex: 1 },
  barValue: { fontSize: 11, fontWeight: '600', color: Colors.neutral600 },
  barBg: {
    width: 28, height: 120, backgroundColor: '#F0F0F0', borderRadius: 6,
    alignItems: 'flex-end', overflow: 'hidden', justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  barFill: {
    width: '100%', minHeight: 8, borderRadius: 6, backgroundColor: Colors.primary500,
  },
  dayLabel: { fontSize: 10, color: Colors.neutral400, marginTop: 4 },

  // 分类条形图
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  catName: { width: 80, fontSize: 13, fontWeight: '500', color: Colors.neutral700 },
  catBarBg: { flex: 1, height: 14, backgroundColor: '#ECECEC', borderRadius: 7, marginLeft: 8, overflow: 'hidden' },
  catBarFill: { height: 14, borderRadius: 7, minWidth: 4 },
  catPoints: { width: 40, textAlign: 'right', fontSize: 13, fontWeight: 'bold', color: Colors.neutral600, marginLeft: 8 },

  // 收支明细
  detailCard: {
    backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  recordRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral100,
  },
  recordDate: { width: 50, fontSize: 12, color: Colors.neutral400, fontWeight: '500' },
  recordDesc: { flex: 1, marginLeft: 8 },
  recordDescText: { fontSize: 13, color: Colors.neutral800 },
  recordChange: { width: 60, textAlign: 'right', fontSize: 14, fontWeight: 'bold' },
  income: { color: Colors.success },
  expense: { color: Colors.error },

  // 空状态
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: Colors.neutral300, textAlign: 'center' },
});
