import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { Priority, RepeatType, ConfirmMode } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal, { ModalStyles } from '@/components/Modal';

type TabType = 'all' | 'pending' | 'done';

export default function TaskManageScreen() {
  const { currentFamily, children } = useFamilyStore();
  const { tasks, loadTasks, createTask, approveTask, rejectTask, completions, loadCompletions } = useTaskStore();
  const [tab, setTab] = useState<TabType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [approving, setApproving] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPoints, setFormPoints] = useState('10');
  const [formRepeat, setFormRepeat] = useState<RepeatType>('once');
  const [formConfirm, setFormConfirm] = useState<ConfirmMode>('parent');
  const [formAssignee, setFormAssignee] = useState('');

  useEffect(() => {
    if (currentFamily) {
      loadTasks(currentFamily.id);
    }
    // Load completions for each child
    children.forEach(c => loadCompletions(c.id));
  }, [currentFamily?.id]);

  useEffect(() => {
    if (children.length > 0 && !formAssignee) {
      setFormAssignee(children[0].id);
    }
  }, [children.length]);

  const filtered = tasks.filter(t => {
    if (tab === 'pending') return t.status === 'submitted';
    if (tab === 'done') return t.status === 'completed';
    return true;
  });

  const getAssigneeName = (assigneeId: string) =>
    children.find(c => c.id === assigneeId)?.name || '未知';

  const getTaskCompletion = (taskId: string) =>
    completions.find(c => c.task_id === taskId && c.approved === 0);

  const parseProofData = (taskId: string): { type: string; uri: string; at?: string } | null => {
    const completion = getTaskCompletion(taskId);
    if (!completion?.proof_data) return null;
    try {
      return JSON.parse(completion.proof_data);
    } catch {
      return null;
    }
  };

  const handleApprove = async (taskId: string) => {
    const completion = getTaskCompletion(taskId);
    if (!completion) { Alert.alert('提示', '找不到待审核记录'); return; }
    setApproving(true);
    try {
      await approveTask(completion.id);
      if (currentFamily) loadTasks(currentFamily.id);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (taskId: string) => {
    const completion = getTaskCompletion(taskId);
    if (!completion) { Alert.alert('提示', '找不到待审核记录'); return; }
    setApproving(true);
    try {
      await rejectTask(completion.id);
      if (currentFamily) loadTasks(currentFamily.id);
    } finally {
      setApproving(false);
    }
  };

  const handleApproveAll = () => {
    const pendingTasks = tasks.filter(t => t.status === 'submitted');
    if (pendingTasks.length === 0) return;
    Alert.alert(
      '全部通过',
      `确认将 ${pendingTasks.length} 条待审核任务全部通过？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '全部通过',
          style: 'default',
          onPress: async () => {
            setApproving(true);
            try {
              for (const task of pendingTasks) {
                const completion = getTaskCompletion(task.id);
                if (completion) await approveTask(completion.id);
              }
              if (currentFamily) await loadTasks(currentFamily.id);
              setSelectedTask(null);
              Alert.alert('成功', `已通过 ${pendingTasks.length} 条任务`);
            } finally {
              setApproving(false);
            }
          },
        },
      ]
    );
  };

  const handleCreateTask = () => {
    if (!formTitle.trim()) { Alert.alert('提示', '请输入任务名称'); return; }
    if (!formAssignee) { Alert.alert('提示', '请选择任务分配对象'); return; }
    if (!currentFamily) return;

    createTask({
      family_id: currentFamily.id,
      category_id: null,
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      points_reward: parseInt(formPoints) || 10,
      stars_reward: 0,
      deadline: null,
      start_time: new Date().toISOString(),
      repeat_type: formRepeat,
      repeat_config: null,
      confirm_mode: formConfirm,
      overdue_penalty: 0,
      assignee_id: formAssignee,
      priority: 'medium' as Priority,
    }).then(() => {
      setShowCreateModal(false);
      setFormTitle('');
      setFormDesc('');
      setFormPoints('10');
      setFormRepeat('once');
      setFormConfirm('parent');
      loadTasks(currentFamily.id);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📋 任务管理</Text>
        <View style={styles.headerBtns}>
          {tab === 'pending' && tasks.filter(t => t.status === 'submitted').length > 1 && (
            <TouchableOpacity style={styles.approveAllBtn} onPress={handleApproveAll} disabled={approving}>
              <Text style={styles.approveAllBtnText}>✅ 全部通过</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={styles.createBtnText}>+ 创建任务</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab 栏 */}
      <View style={styles.tabRow}>
        {(['all', 'pending', 'done'] as TabType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'all' ? `全部 (${tasks.length})` : t === 'pending' ? '待审核' : '已完成'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 任务列表 */}
      <ScrollView contentContainerStyle={styles.taskList} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>暂无任务</Text>
          </View>
        )}
        {filtered.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.taskCard,
              task.status === 'submitted' && styles.pendingCard,
              task.status === 'completed' && styles.doneCard,
            ]}
            onPress={() => task.status === 'submitted' ? setSelectedTask(task) : null}
            activeOpacity={0.75}
          >
            <View style={styles.taskTop}>
              <View style={styles.taskTitleArea}>
                <Text style={[
                  styles.priorityDot,
                  { backgroundColor: task.priority === 'high' ? Colors.error : task.priority === 'medium' ? Colors.warning : Colors.success }
                ]} />
                <Text style={styles.taskTitle}>{task.title}</Text>
              </View>
              <Text style={[
                styles.taskStatus,
                task.status === 'active' && styles.statusActive,
                task.status === 'submitted' && styles.statusPending,
                task.status === 'completed' && styles.statusDone,
              ]}>
                {task.status === 'active' ? '进行中' : task.status === 'submitted' ? '待审核' : task.status === 'completed' ? '已完成' : '进行中'}
              </Text>
            </View>
            <View style={styles.taskMeta}>
              <Text style={styles.meta}>👤 {getAssigneeName(task.assignee_id)}</Text>
              <Text style={styles.meta}>⭐ +{task.points_reward}</Text>
              <Text style={styles.meta}>{task.repeat_type === 'daily' ? '每天' : task.repeat_type === 'once' ? '一次性' : '每周'}</Text>
            </View>

            {task.status === 'submitted' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleReject(task.id)}
                >
                  <Text style={styles.rejectBtnText}>❌ 驳回</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => handleApprove(task.id)}
                >
                  <Text style={styles.approveBtnText}>✅ 通过</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 创建任务弹窗 */}
      <Modal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建新任务"
        scrollable
      >
        <View>
          <Text style={ModalStyles.fieldLabel}>任务名称 *</Text>
          <TextInput style={ModalStyles.input} placeholder="例如：完成数学作业" value={formTitle} onChangeText={setFormTitle} />
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>任务描述（可选）</Text>
          <TextInput style={[ModalStyles.input, ModalStyles.textArea]} placeholder="详细说明..." value={formDesc} onChangeText={setFormDesc} multiline />
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>积分奖励</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="例如：10"
            value={formPoints}
            onChangeText={(t) => setFormPoints(t.replace(/[^0-9]/g, '').slice(0, 4))}
            keyboardType="number-pad"
          />
        </View>

        {/* 分配对象 */}
        {children.length > 0 && (
          <View>
            <Text style={ModalStyles.fieldLabel}>分配给</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
              {children.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[ModalStyles.selectChip, formAssignee === c.id && ModalStyles.selectedChip]}
                  onPress={() => setFormAssignee(c.id)}
                >
                  <Text style={[ModalStyles.selectChipText, formAssignee === c.id && ModalStyles.selectedChipText]}>
                    {c.avatar || '👦'} {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View>
          <Text style={ModalStyles.fieldLabel}>重复类型</Text>
          <View style={ModalStyles.selectRow}>
            {([['once', '一次'], ['daily', '每天'], ['weekly', '每周']] as [RepeatType, string][]).map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[ModalStyles.selectChip, formRepeat === val && ModalStyles.selectedChip]}
                onPress={() => setFormRepeat(val)}
              >
                <Text style={[ModalStyles.selectChipText, formRepeat === val && ModalStyles.selectedChipText]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>确认方式</Text>
          <View style={ModalStyles.selectRow}>
            {([['auto', '自动'], ['parent', '家长'], ['photo', '拍照']] as [ConfirmMode, string][]).map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[ModalStyles.selectChip, formConfirm === val && ModalStyles.selectedChip]}
                onPress={() => setFormConfirm(val)}
              >
                <Text style={[ModalStyles.selectChipText, formConfirm === val && ModalStyles.selectedChipText]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setShowCreateModal(false)}>
            <Text style={ModalStyles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ModalStyles.confirmButton} onPress={handleCreateTask}>
            <Text style={ModalStyles.confirmButtonText}>创建</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 审核详情弹窗 */}
      <Modal
        visible={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title="任务审核"
      >
        <Text style={[ModalStyles.fieldLabel, { marginTop: 0 }]}>{selectedTask?.title}</Text>

        {/* 凭证区域 */}
        {(() => {
          const proofData = selectedTask ? parseProofData(selectedTask.id) : null;
          if (proofData && proofData.type === 'image' && proofData.uri) {
            return (
              <View style={styles.proofBox}>
                <Text style={styles.proofTitle}>📸 凭证照片</Text>
                <Image
                  source={{ uri: proofData.uri }}
                  style={styles.proofImage}
                  resizeMode="cover"
                />
                {proofData.at && (
                  <Text style={styles.proofTime}>
                    提交于 {new Date(proofData.at).toLocaleString('zh-CN')}
                  </Text>
                )}
              </View>
            );
          }
          return (
            <View style={styles.proofBox}>
              <Text style={styles.proofTitle}>📸 凭证照片</Text>
              <View style={styles.proofPlaceholder}>
                <Text style={styles.proofHint}>该任务无需拍照凭证</Text>
              </View>
            </View>
          );
        })()}

        <View style={styles.detailMeta}>
          <Text style={styles.meta}>
            分配给：{getAssigneeName(selectedTask?.assignee_id)}
          </Text>
          <Text style={styles.meta}>积分奖励：+{selectedTask?.points_reward}</Text>
        </View>

        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity
            style={ModalStyles.dangerButton}
            onPress={() => {
              handleReject(selectedTask?.id);
              setSelectedTask(null);
            }}
            disabled={approving}
          >
            <Text style={ModalStyles.dangerButtonText}>驳回 ❌</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={ModalStyles.confirmButton}
            onPress={() => {
              handleApprove(selectedTask?.id);
              setSelectedTask(null);
            }}
            disabled={approving}
          >
            <Text style={ModalStyles.confirmButtonText}>
              {approving ? '处理中...' : '通过 ✅'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Loading overlay */}
      {approving && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary500} />
          <Text style={styles.loadingText}>正在处理...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.neutral900 },
  createBtn: { backgroundColor: Colors.secondary300, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.chip },
  createBtnText: { color: Colors.bgCard, fontSize: 13, fontWeight: '600' },
  headerBtns: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  approveAllBtn: { backgroundColor: Colors.successLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.chip },
  approveAllBtnText: { color: Colors.success, fontSize: 13, fontWeight: '600' },
  tabRow: { flexDirection: 'row', marginHorizontal: Spacing.screenPadding, gap: Spacing.xs, marginBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.tab, alignItems: 'center', backgroundColor: Colors.neutral200 },
  tabActive: { backgroundColor: Colors.bgCard, ...Shadows.sm },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.neutral400 },
  tabTextActive: { color: Colors.neutral900 },
  taskList: { paddingHorizontal: Spacing.screenPadding },
  taskCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
  },
  pendingCard: { borderColor: Colors.warningLight, borderWidth: 1.5, backgroundColor: '#FFFBF5' },
  doneCard: { opacity: 0.6 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  taskTitleArea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: Colors.neutral900 },
  taskStatus: { fontSize: 12, fontWeight: '600', paddingHorizontal: Spacing.xs, paddingVertical: 3, borderRadius: BorderRadius.chip },
  statusActive: { color: Colors.secondary300, backgroundColor: Colors.secondary50 },
  statusPending: { color: Colors.warning, backgroundColor: Colors.warningLight },
  statusDone: { color: Colors.neutral400, backgroundColor: Colors.neutral100 },
  taskMeta: { flexDirection: 'row', gap: Spacing.sm },
  meta: { fontSize: 12, color: Colors.neutral500 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  approveBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.button, backgroundColor: Colors.secondary300, alignItems: 'center' },
  approveBtnText: { color: Colors.bgCard, fontWeight: '600', fontSize: 14 },
  rejectBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.button, borderWidth: 1.5, borderColor: Colors.error, alignItems: 'center', backgroundColor: Colors.bgCard },
  rejectBtnText: { color: Colors.error, fontWeight: '600', fontSize: 14 },

  // 审核详情
  proofBox: { marginBottom: Spacing.md },
  proofTitle: { fontSize: 14, fontWeight: '600', color: Colors.neutral700, marginBottom: Spacing.xs },
  proofImage: { width: '100%', height: 200, borderRadius: BorderRadius.input, backgroundColor: Colors.neutral100 },
  proofPlaceholder: { backgroundColor: Colors.neutral100, borderRadius: BorderRadius.input, height: 80, alignItems: 'center', justifyContent: 'center' },
  proofIcon: { fontSize: 32, marginBottom: Spacing.xs },
  proofHint: { fontSize: 13, color: Colors.neutral400 },
  proofTime: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: Spacing.xs },
  detailMeta: { marginTop: Spacing.md },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: { marginTop: Spacing.sm, color: Colors.neutral600, fontSize: 14 },

  // Empty state
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.neutral300 },
});
