import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import TaskCard from '@/components/TaskCard';
import PointBadge from '@/components/PointBadge';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { Task, TaskStatus } from '@/types';
import { Colors, Typography, Spacing, BorderRadius } from '@/theme';
import Modal from '@/components/Modal';

type TabType = 'today' | 'all';

export default function TaskListScreen() {
  const [tab, setTab] = useState<TabType>('today');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = useCallback((title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }, []);

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
          showModal('提示', '需要相册权限才能上传任务照片');
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
        showModal('提示', err instanceof Error ? err.message : '提交失败');
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
          <Text style={styles.emptyMessage}>请先选择孩子档案</Text>
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
            <Text style={styles.emptyMessage}>加载中...</Text>
          </View>
        ) : (
          <>
            {/* 进行中 */}
            <Text style={styles.sectionLabel}>🔥 进行中 ({activeTasks.length})</Text>
            {activeTasks.length === 0 ? (
              <View style={styles.emptyHint}>
                <Text style={styles.emptyHintText}>暂无进行中的任务</Text>
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
                <Text style={styles.emptyHintText}>暂无已完成的任务</Text>
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
        <View style={styles.bottomSpacer} />
      </ScrollView>
      {/* 提示弹窗 */}
      <Modal visible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle}>
        <Text style={styles.modalMessage}>
          {modalMessage}
        </Text>
        <TouchableOpacity
          style={styles.modalBtn}
          onPress={() => setModalVisible(false)}
        >
          <Text style={styles.modalBtnText}>知道了</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  emptyMessage: {
    fontSize: Typography.lg,
    color: Colors.neutral400,
  },
  emptyHintText: {
    fontSize: Typography.base,
    color: Colors.neutral300,
  },
  bottomSpacer: {
    height: Spacing[5],
  },
  modalMessage: {
    fontSize: Typography.base + 1,
    color: Colors.neutral600,
    textAlign: 'center',
    marginBottom: Spacing[5],
  },
  modalBtn: {
    backgroundColor: Colors.primary500,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalBtnText: {
    color: Colors.neutral0,
    fontSize: Typography.base + 1,
    fontWeight: '700',
  },
  header: {
    paddingHorizontal: Spacing['4.5'],
    paddingTop: Spacing[4],
    paddingBottom: Spacing['2.5'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography['2xl'] + 2,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  dateBox: {
    backgroundColor: Colors.borderDivider,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing['1.5'] - 1,
    borderRadius: BorderRadius.md,
  },
  date: {
    fontSize: Typography.sm + 1,
    color: Colors.neutral600,
    fontWeight: '500',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing['4.5'],
    marginBottom: Spacing['3.5'],
    gap: Spacing['2.5'],
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing['2.5'] - 1,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
    backgroundColor: Colors.neutral200,
  },
  tabActive: {
    backgroundColor: Colors.primary500,
  },
  tabText: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.neutral500,
  },
  tabTextActive: {
    color: Colors.bgCard,
  },
  scrollContent: {
    paddingHorizontal: Spacing['4.5'],
  },
  sectionLabel: {
    fontSize: Typography.base + 1,
    fontWeight: '700',
    color: Colors.neutral800,
    marginTop: Spacing[4],
    marginBottom: Spacing[2],
  },
  emptyHint: {
    alignItems: 'center',
    paddingVertical: Spacing[5],
  },
  summary: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing['4.5'],
    marginTop: Spacing[4],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  summaryLabel: {
    fontSize: Typography.base,
    color: Colors.neutral600,
  },
  summaryValue: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.secondary300,
  },
  pointsRow: {},
  streakValue: {
    fontSize: Typography.base + 1,
    fontWeight: '700',
    color: Colors.primary500,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing[10],
  },
});
