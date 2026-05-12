import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import TaskCard from '@/components/TaskCard';
import PointBadge from '@/components/PointBadge';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { Task, TaskStatus } from '@/types';
import { Colors, Typography, Spacing, BorderRadius } from '@/theme';

type TabType = 'today' | 'all';

export default function TaskListScreen() {
  const [tab, setTab] = useState<TabType>('today');

  const { currentChild, currentFamily } = useFamilyStore();
  const {
    tasks,
    isLoading,
    completions,
    loadTasks,
    loadCompletions,
    submitTask,
    loadStreaks,
    streaks,
  } = useTaskStore();

  // Load data when family/child changes
  useEffect(() => {
    if (!currentFamily || !currentChild) return;
    loadTasks(currentFamily.id, currentChild.id);
    loadCompletions(currentChild.id);
    loadStreaks(currentChild.id);
  }, [currentFamily?.id, currentChild?.id]);

  // Today's date string
  const today = new Date();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')} ${dayNames[today.getDay()]}`;

  // Filter tasks based on tab
  const activeTasks = tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'active' || t.status === 'submitted'
  );
  const doneTasks = tasks.filter((t) => t.status === 'completed');

  const displayTasks = tab === 'today' ? activeTasks : tasks;

  // Today's earned points from completions
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPoints = completions
    .filter((c) => c.approved === 1 && c.completed_at?.startsWith(todayStr))
    .reduce((sum, c) => {
      const task = tasks.find((t) => t.id === c.task_id);
      return sum + (task?.points_reward ?? 0);
    }, 0);

  // Streak days from streaks state
  const currentStreak = streaks.length > 0
    ? Math.max(...streaks.map((s) => s.current_streak))
    : 0;

  // Submit handler（拍照确认：先选图再提交凭证）
  const handleSubmit = useCallback(
    async (taskId: string) => {
      if (!currentChild || !currentFamily) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      let proof: string | undefined;
      if (task.confirm_mode === 'photo') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('提示', '需要相册权限才能上传任务照片');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.85,
        });
        if (result.canceled) return;
        const uri = result.assets[0]?.uri;
        if (!uri) return;
        proof = JSON.stringify({
          type: 'image',
          uri,
          at: new Date().toISOString(),
        });
      }

      try {
        await submitTask(taskId, currentChild.id, proof);
        await loadTasks(currentFamily.id, currentChild.id);
        await loadCompletions(currentChild.id);
      } catch (err: unknown) {
        Alert.alert('提示', err instanceof Error ? err.message : '提交失败');
      }
    },
    [currentChild, currentFamily, tasks, submitTask, loadTasks, loadCompletions]
  );

  // Progress
  const totalCount = tasks.length;
  const doneCount = doneTasks.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (!currentChild) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={{ fontSize: 16, color: Colors.neutral400 }}>请先选择孩子档案</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部 */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 任务列表</Text>
        <View style={styles.dateBox}>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
      </View>

      {/* Tab 切换 */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'today' && styles.tabActive]}
          onPress={() => setTab('today')}
        >
          <Text style={[styles.tabText, tab === 'today' && styles.tabTextActive]}>今日任务</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>全部任务</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={{ fontSize: 16, color: Colors.neutral400 }}>加载中...</Text>
          </View>
        ) : (
          <>
            {/* 进行中 */}
            <Text style={styles.sectionLabel}>🔥 进行中 ({activeTasks.length})</Text>
            {activeTasks.length === 0 ? (
              <View style={styles.emptyHint}>
                <Text style={{ fontSize: 14, color: Colors.neutral300 }}>暂无进行中的任务</Text>
              </View>
            ) : (
              activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSubmit={() => handleSubmit(task.id)}
                />
              ))
            )}

            {/* 已完成 */}
            <Text style={styles.sectionLabel}>✅ 已完成 ({doneTasks.length})</Text>
            {doneTasks.length === 0 ? (
              <View style={styles.emptyHint}>
                <Text style={{ fontSize: 14, color: Colors.neutral300 }}>暂无已完成的任务</Text>
              </View>
            ) : (
              doneTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))
            )}

            {/* 进度汇总 */}
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>今日进度</Text>
                <Text style={styles.summaryValue}>{progress}%</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>已获积分</Text>
                <View style={styles.pointsRow}>
                  <PointBadge type="points" amount={todayPoints} size="small" />
                </View>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>连续完成</Text>
                <Text style={styles.streakValue}>🔥 {currentStreak} 天</Text>
              </View>
            </View>
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  dateBox: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  date: {
    fontSize: 13,
    color: Colors.neutral600,
    fontWeight: '500',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 14,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.neutral200,
  },
  tabActive: {
    backgroundColor: Colors.primary500,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral500,
  },
  tabTextActive: {
    color: Colors.bgCard,
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral800,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHint: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  summary: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.neutral600,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary300,
  },
  pointsRow: {},
  streakValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary500,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
});
