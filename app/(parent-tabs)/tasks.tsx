import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { Priority, RepeatType, ConfirmMode } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal, { ModalStyles } from '@/components/Modal';
import AppModal from '@/components/AppModal';
import { useModal } from '@/hooks/useModal';

type TabType = 'all' | 'pending' | 'done';

const TAB_LABELS: Record<TabType, string> = { all: '全部', pending: '待审核', done: '已完成' };

export default function TaskManageScreen() {
  const { currentFamily, children } = useFamilyStore();
  const { tasks, loadTasks, createTask, approveTask, rejectTask, completions, loadCompletions } = useTaskStore();
  const [tab, setTab] = useState<TabType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [approving, setApproving] = useState(false);
  const { modal, showModal, hideModal } = useModal();

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPoints, setFormPoints] = useState('10');
  const [formRepeat, setFormRepeat] = useState<RepeatType>('once');
  const [formConfirm, setFormConfirm] = useState<ConfirmMode>('parent');
  const [formAssignee, setFormAssignee] = useState('');

  useEffect(() => {
    if (currentFamily) loadTasks(currentFamily.id);
    children.forEach(c => loadCompletions(c.id));
  }, [currentFamily?.id]);

  useEffect(() => {
    if (children.length > 0 && !formAssignee) setFormAssignee(children[0].id);
  }, [children.length]);

  const pendingCount = tasks.filter(t => t.status === 'submitted').length;

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
    try { return JSON.parse(completion.proof_data); } catch { return null; }
  };

  const handleApprove = async (taskId: string) => {
    const completion = getTaskCompletion(taskId);
    if (!completion) { showModal('提示', '找不到待审核记录'); return; }
    setApproving(true);
    try {
      await approveTask(completion.id);
      if (currentFamily) loadTasks(currentFamily.id);
    } finally { setApproving(false); }
  };

  const handleReject = async (taskId: string) => {
    const completion = getTaskCompletion(taskId);
    if (!completion) { showModal('提示', '找不到待审核记录'); return; }
    setApproving(true);
    try {
      await rejectTask(completion.id);
      if (currentFamily) loadTasks(currentFamily.id);
    } finally { setApproving(false); }
  };

  const handleApproveAll = () => {
    const pendingTasks = tasks.filter(t => t.status === 'submitted');
    if (pendingTasks.length === 0) return;
    showModal('全部通过', `确认将 ${pendingTasks.length} 条待审核任务全部通过？`, [
      { text: '取消' },
      {
        text: '全部通过', primary: true,
        onPress: async () => {
          setApproving(true);
          try {
            for (const task of pendingTasks) {
              const completion = getTaskCompletion(task.id);
              if (completion) await approveTask(completion.id);
            }
            if (currentFamily) await loadTasks(currentFamily.id);
            setSelectedTask(null);
            showModal('成功', `已通过 ${pendingTasks.length} 条任务`);
          } finally { setApproving(false); }
        },
      },
    ]);
  };

  const handleCreateTask = () => {
    if (!formTitle.trim()) { showModal('提示', '请输入任务名称'); return; }
    if (!formAssignee) { showModal('提示', '请选择任务分配对象'); return; }
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
      setFormTitle(''); setFormDesc(''); setFormPoints('10');
      setFormRepeat('once'); setFormConfirm('parent');
      loadTasks(currentFamily.id);
    });
  };

  const PRIORITY_COLOR: Record<string, string> = {
    high: Colors.error, medium: Colors.warning, low: Colors.success,
  };
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    active:    { label: '进行中', color: Colors.secondary300, bg: Colors.secondary50 },
    submitted: { label: '待审核', color: Colors.warning,      bg: Colors.warningLight },
    completed: { label: '已完成', color: Colors.neutral400,   bg: Colors.neutral100 },
    overdue:   { label: '已逾期', color: Colors.error,        bg: Colors.errorLight },
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab 栏 */}
      <View style={styles.tabBar}>
        {(['all', 'pending', 'done'] as TabType[]).map((t) => (
          <TouchableOpacity key={t} style={styles.tabItem} onPress={() => setTab(t)} activeOpacity={0.7}>
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {TAB_LABELS[t]}
              </Text>
              {t === 'pending' && pendingCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>
              )}
            </View>
            {tab === t && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
        <View style={styles.tabActions}>
          {tab === 'pending' && pendingCount > 1 && (
            <TouchableOpacity style={styles.approveAllBtn} onPress={handleApproveAll} disabled={approving}>
              <Text style={styles.approveAllText}>全部通过</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={18} color={Colors.bgCard} />
            <Text style={styles.createBtnText}>创建</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 任务列表 */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>暂无任务</Text>
          </View>
        )}
        {filtered.map((task) => {
          const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.active;
          return (
            <TouchableOpacity
              key={task.id}
              style={[styles.taskCard, task.status === 'submitted' && styles.taskCardPending]}
              onPress={() => task.status === 'submitted' ? setSelectedTask(task) : null}
              activeOpacity={0.8}
            >
              <View style={styles.taskHeader}>
                <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLOR[task.priority] || Colors.neutral300 }]} />
                <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                </View>
              </View>

              <View style={styles.taskMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="person-outline" size={12} color={Colors.neutral400} />
                  <Text style={styles.metaText}>{getAssigneeName(task.assignee_id)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="diamond-outline" size={12} color={Colors.neutral400} />
                  <Text style={styles.metaText}>+{task.points_reward}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="repeat-outline" size={12} color={Colors.neutral400} />
                  <Text style={styles.metaText}>
                    {task.repeat_type === 'daily' ? '每天' : task.repeat_type === 'once' ? '一次' : '每周'}
                  </Text>
                </View>
              </View>

              {task.status === 'submitted' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(task.id)}>
                    <Ionicons name="close" size={14} color={Colors.error} />
                    <Text style={styles.rejectText}>驳回</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(task.id)}>
                    <Ionicons name="checkmark" size={14} color={Colors.bgCard} />
                    <Text style={styles.approveText}>通过</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* 创建任务弹窗 */}
      <Modal visible={showCreateModal} onClose={() => setShowCreateModal(false)} title="创建新任务" scrollable>
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
          <TextInput style={ModalStyles.input} placeholder="10" value={formPoints} onChangeText={(t) => setFormPoints(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" />
        </View>
        {children.length > 0 && (
          <View>
            <Text style={ModalStyles.fieldLabel}>分配给</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
              {children.map(c => (
                <TouchableOpacity key={c.id} style={[ModalStyles.selectChip, formAssignee === c.id && ModalStyles.selectedChip]} onPress={() => setFormAssignee(c.id)}>
                  <Text style={[ModalStyles.selectChipText, formAssignee === c.id && ModalStyles.selectedChipText]}>{c.avatar || '👦'} {c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <View>
          <Text style={ModalStyles.fieldLabel}>重复类型</Text>
          <View style={ModalStyles.selectRow}>
            {([['once', '一次'], ['daily', '每天'], ['weekly', '每周']] as [RepeatType, string][]).map(([val, label]) => (
              <TouchableOpacity key={val} style={[ModalStyles.selectChip, formRepeat === val && ModalStyles.selectedChip]} onPress={() => setFormRepeat(val)}>
                <Text style={[ModalStyles.selectChipText, formRepeat === val && ModalStyles.selectedChipText]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View>
          <Text style={ModalStyles.fieldLabel}>确认方式</Text>
          <View style={ModalStyles.selectRow}>
            {([['auto', '自动'], ['parent', '家长'], ['photo', '拍照']] as [ConfirmMode, string][]).map(([val, label]) => (
              <TouchableOpacity key={val} style={[ModalStyles.selectChip, formConfirm === val && ModalStyles.selectedChip]} onPress={() => setFormConfirm(val)}>
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
      <Modal visible={!!selectedTask} onClose={() => setSelectedTask(null)} title="任务审核">
        <Text style={[ModalStyles.fieldLabel, { marginTop: 0 }]}>{selectedTask?.title}</Text>
        {(() => {
          const proofData = selectedTask ? parseProofData(selectedTask.id) : null;
          if (proofData?.type === 'image' && proofData.uri) {
            return (
              <View style={styles.proofBox}>
                <Text style={styles.proofLabel}>📸 凭证照片</Text>
                <Image source={{ uri: proofData.uri }} style={styles.proofImage} resizeMode="cover" />
                {proofData.at && <Text style={styles.proofTime}>提交于 {new Date(proofData.at).toLocaleString('zh-CN')}</Text>}
              </View>
            );
          }
          return (
            <View style={styles.proofBox}>
              <View style={styles.proofEmpty}>
                <Text style={styles.proofEmptyText}>该任务无需拍照凭证</Text>
              </View>
            </View>
          );
        })()}
        <View style={styles.detailMeta}>
          <Text style={styles.metaText}>分配给：{getAssigneeName(selectedTask?.assignee_id)}</Text>
          <Text style={styles.metaText}>积分奖励：+{selectedTask?.points_reward}</Text>
        </View>
        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity style={ModalStyles.dangerButton} onPress={() => { handleReject(selectedTask?.id); setSelectedTask(null); }} disabled={approving}>
            <Text style={ModalStyles.dangerButtonText}>驳回</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ModalStyles.confirmButton} onPress={() => { handleApprove(selectedTask?.id); setSelectedTask(null); }} disabled={approving}>
            <Text style={ModalStyles.confirmButtonText}>{approving ? '处理中...' : '通过 ✅'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {approving && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary500} />
          <Text style={styles.loadingText}>正在处理...</Text>
        </View>
      )}

      <AppModal state={modal} onClose={hideModal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  tabItem: { paddingVertical: Spacing[3], marginRight: Spacing[4], alignItems: 'center' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1] },
  tabText: { fontSize: Typography.sm + 1, fontWeight: '600', color: Colors.neutral400 },
  tabTextActive: { color: Colors.neutral900 },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: Colors.primary500, borderRadius: 1 },
  badge: { backgroundColor: Colors.primary500, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 9, color: Colors.bgCard, fontWeight: '700' },
  tabActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, alignItems: 'center' },
  approveAllBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.button, backgroundColor: Colors.successLight },
  approveAllText: { fontSize: Typography.xs, color: Colors.success, fontWeight: '600' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary500, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 1, borderRadius: BorderRadius.button },
  createBtnText: { color: Colors.bgCard, fontSize: Typography.xs + 1, fontWeight: '700' },

  list: { padding: Spacing[4] },

  taskCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[4],
    marginBottom: Spacing[2],
    ...Shadows.sm,
    overflow: 'hidden',
  },
  taskCardPending: {
    borderWidth: 1.5,
    borderColor: Colors.warningBorder,
    backgroundColor: Colors.warningBgSoft,
  },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing[2] },
  priorityBar: { width: 3, height: 18, borderRadius: 2 },
  taskTitle: { flex: 1, fontSize: Typography.base, fontWeight: '600', color: Colors.neutral900 },
  statusChip: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.chip },
  statusText: { fontSize: Typography.xs, fontWeight: '700' },

  taskMeta: { flexDirection: 'row', gap: Spacing[3] },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: Typography.xs, color: Colors.neutral500 },

  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing[3] },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm + 1, borderRadius: BorderRadius.button, borderWidth: 1.5, borderColor: Colors.error, backgroundColor: Colors.bgCard },
  rejectText: { color: Colors.error, fontWeight: '700', fontSize: Typography.sm + 1 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm + 1, borderRadius: BorderRadius.button, backgroundColor: Colors.secondary300 },
  approveText: { color: Colors.bgCard, fontWeight: '700', fontSize: Typography.sm + 1 },

  proofBox: { marginBottom: Spacing.md },
  proofLabel: { fontSize: Typography.sm, fontWeight: '600', color: Colors.neutral700, marginBottom: Spacing.xs },
  proofImage: { width: '100%', height: 200, borderRadius: BorderRadius.input, backgroundColor: Colors.neutral100 },
  proofEmpty: { backgroundColor: Colors.neutral100, borderRadius: BorderRadius.input, height: 72, alignItems: 'center', justifyContent: 'center' },
  proofEmptyText: { fontSize: Typography.sm, color: Colors.neutral400 },
  proofTime: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: Spacing.xs },
  detailMeta: { marginTop: Spacing.sm, gap: 4 },

  emptyState: { paddingVertical: 60, alignItems: 'center', gap: Spacing[2] },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: Typography.base, color: Colors.neutral300 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  loadingText: { marginTop: Spacing.sm, color: Colors.neutral600, fontSize: Typography.sm + 1 },
});
