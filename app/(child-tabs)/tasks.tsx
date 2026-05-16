import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import TaskCard from '@/components/TaskCard';
import PointBadge from '@/components/PointBadge';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useBehaviorStore } from '@/stores/useBehaviorStore';
import { BehaviorCategory } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, CategoryPalette, Shadows } from '@/theme';
import Modal, { ModalStyles } from '@/components/Modal';
import AppModal from '@/components/AppModal';
import { useModal } from '@/hooks/useModal';

type TabType = 'today' | 'all' | 'behavior';

const PRESET_CATS: BehaviorCategory[] = [
  { id: 'study',      family_id: '', name: '学习', icon: '📚', color: CategoryPalette.study,  sort_order: 0, is_preset: 1, is_hidden: 0 },
  { id: 'chore',      family_id: '', name: '家务', icon: '🧹', color: CategoryPalette.chore,  sort_order: 1, is_preset: 1, is_hidden: 0 },
  { id: 'sport',      family_id: '', name: '运动', icon: '🏃', color: Colors.primary500,       sort_order: 2, is_preset: 1, is_hidden: 0 },
  { id: 'habit',      family_id: '', name: '习惯', icon: '😊', color: CategoryPalette.habit,  sort_order: 3, is_preset: 1, is_hidden: 0 },
  { id: 'social',     family_id: '', name: '社交', icon: '🤝', color: CategoryPalette.social, sort_order: 4, is_preset: 1, is_hidden: 0 },
  { id: 'correction', family_id: '', name: '纠正', icon: '⚠️', color: Colors.error,           sort_order: 5, is_preset: 1, is_hidden: 0 },
];

export default function TaskListScreen() {
  const [tab, setTab] = useState<TabType>('today');

  // 任务弹窗
  const { modal: taskModal, showModal: showTaskModal, hideModal: hideTaskModal } = useModal();

  // 行为自评状态
  const [activeCat, setActiveCat] = useState('');
  const [scoringRule, setScoringRule] = useState<any | null>(null);
  const [scoringPoints, setScoringPoints] = useState(1);
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const { modal: behaviorModal, showModal: showBehaviorModal, hideModal: hideBehaviorModal } = useModal();

  const { currentChild, currentFamily } = useFamilyStore();
  const { categories, rules, records, loadCategories, loadRules, loadRecords, recordBehavior } = useBehaviorStore();
  const { tasks, isLoading, completions, loadTasks, loadCompletions, submitTask, loadStreaks, streaks } = useTaskStore();

  useEffect(() => {
    if (!currentFamily || !currentChild) return;
    loadTasks(currentFamily.id, currentChild.id);
    loadCompletions(currentChild.id);
    loadStreaks(currentChild.id);
  }, [currentFamily?.id, currentChild?.id]);

  useEffect(() => {
    if (!currentFamily || !currentChild) return;
    loadCategories(currentFamily.id);
    loadRules(currentFamily.id);
    loadRecords(currentChild.id, 20);
  }, [currentFamily?.id, currentChild?.id]);

  useEffect(() => {
    if (categories.length > 0 && !activeCat) setActiveCat(categories[0].id);
  }, [categories.length]);

  // ── 任务相关 ────────────────────────────────────────────────
  const today = new Date();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')} ${dayNames[today.getDay()]}`;

  const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'active' || t.status === 'submitted');
  const doneTasks = tasks.filter(t => t.status === 'completed');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPoints = completions
    .filter(c => c.approved === 1 && c.completed_at?.startsWith(todayStr))
    .reduce((sum, c) => sum + (tasks.find(t => t.id === c.task_id)?.points_reward ?? 0), 0);

  const currentStreak = streaks.length > 0 ? Math.max(...streaks.map(s => s.current_streak)) : 0;
  const totalCount = tasks.length;
  const doneCount = doneTasks.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const handleSubmit = useCallback(async (taskId: string) => {
    if (!currentChild || !currentFamily) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let proof: string | undefined;
    if (task.confirm_mode === 'photo') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { showTaskModal('提示', '需要相册权限才能上传任务照片'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;
      proof = JSON.stringify({ type: 'image', uri, at: new Date().toISOString() });
    }

    try {
      await submitTask(taskId, currentChild.id, proof);
      await loadTasks(currentFamily.id, currentChild.id);
      await loadCompletions(currentChild.id);
    } catch (err: unknown) {
      showTaskModal('提示', err instanceof Error ? err.message : '提交失败');
    }
  }, [currentChild, currentFamily, tasks, submitTask, loadTasks, loadCompletions, showTaskModal]);

  // ── 行为自评相关 ─────────────────────────────────────────────
  const displayCats = categories.length > 0 ? categories : PRESET_CATS;
  const activeCategory = displayCats.find(c => c.id === activeCat);
  const filteredRules = rules.filter(r => r.category_id === activeCat);
  const behaviorRecords = records.filter(r => r.rule_id);

  const handleOpenScore = (rule: any) => {
    setScoringRule(rule);
    setScoringPoints(rule.points);
  };

  const handleAdjustPoints = (delta: number) => {
    if (!scoringRule) return;
    const next = scoringPoints + delta;
    if (next < 1 || next > scoringRule.points) return;
    setScoringPoints(next);
  };

  const handleSelfScore = useCallback(async () => {
    if (!scoringRule || !currentChild || scoreSubmitting) return;
    setScoreSubmitting(true);
    try {
      await recordBehavior(
        currentChild.id,
        scoringRule.id,
        `${scoringRule.name} 自评 ${scoringPoints > 0 ? '+' : ''}${scoringPoints}`,
        true,
        scoringPoints
      );
      await loadRecords(currentChild.id, 20);
      setScoringRule(null);
      showBehaviorModal('✅ 完成', `已记录 ${scoringPoints > 0 ? '+' : ''}${scoringPoints} 积分`);
    } catch (err: any) {
      showBehaviorModal('提示', err.message || '评分失败');
    } finally {
      setScoreSubmitting(false);
    }
  }, [scoringRule, currentChild, scoringPoints, scoreSubmitting, recordBehavior, loadRecords, showBehaviorModal]);

  const isPos = (v: number) => v >= 0;

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
      {/* 🎉 顶部激励栏 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>👋 {currentChild?.name || '小宝贝'}</Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.pointsBox}>
            <Text style={styles.pointsIcon}>⭐</Text>
            <Text style={styles.pointsValue}>{currentChild?.current_points ?? 0}</Text>
          </View>
          <View style={styles.streakBox}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={styles.streakValue}>{currentStreak}天</Text>
          </View>
        </View>
      </View>

      {/* Tab 切换 */}
      <View style={styles.tabRow}>
        {([
          { key: 'today', label: '⭐ 今日' },
          { key: 'all',   label: '📋 全部' },
          { key: 'behavior', label: '🌟 行为' },
        ] as { key: TabType; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading && tab !== 'behavior' ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.emptyMessage}>加载中...</Text>
          </View>

        ) : tab === 'behavior' ? (
          /* ── 行为自评 Tab ── */
          <>
            {/* 分类标签栏 */}
            <View style={styles.catBarWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catBar}>
                {displayCats.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      activeCat === cat.id && {
                        backgroundColor: (cat.color || CategoryPalette.study) + '20',
                        borderColor: cat.color || CategoryPalette.study,
                      },
                    ]}
                    onPress={() => setActiveCat(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.catEmoji}>{cat.icon || '📋'}</Text>
                    <Text style={[styles.catLabel, activeCat === cat.id && { color: cat.color || CategoryPalette.study, fontWeight: '700' }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 当前分类标题 */}
            <View style={styles.catHeader}>
              {activeCategory && <View style={[styles.catDot, { backgroundColor: activeCategory.color || CategoryPalette.study }]} />}
              <Text style={styles.catTitle}>
                {activeCategory ? `${activeCategory.name} 行为` : '行为列表'}
                <Text style={styles.catCount}>  {filteredRules.length} 项</Text>
              </Text>
            </View>

            {/* 规则列表 */}
            {filteredRules.length === 0 ? (
              <View style={styles.emptyHint}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyHintText}>该分类下还没有行为规则</Text>
                <Text style={styles.emptyHintSub}>让家长添加一些规则吧</Text>
              </View>
            ) : (
              filteredRules.map(rule => (
                <View key={rule.id} style={styles.ruleCard}>
                  <View style={[styles.pointsBadge, isPos(rule.points) ? styles.badgePos : styles.badgeNeg]}>
                    <Text style={[styles.pointsNum, { color: isPos(rule.points) ? Colors.success : Colors.error }]}>
                      {rule.points > 0 ? '+' : ''}{rule.points}
                    </Text>
                  </View>
                  <View style={styles.ruleInfo}>
                    <Text style={styles.ruleName}>{rule.name}</Text>
                    <View style={styles.ruleTags}>
                      {rule.need_approve === 1 && (
                        <View style={styles.tagWrap}>
                          <Text style={[styles.tag, { color: Colors.warning }]}>需审核</Text>
                        </View>
                      )}
                      {rule.daily_limit > 0 && (
                        <View style={[styles.tagWrap, { backgroundColor: Colors.infoLight }]}>
                          <Text style={[styles.tag, { color: Colors.info }]}>限{rule.daily_limit}次</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.scoreBtn} onPress={() => handleOpenScore(rule)} activeOpacity={0.7}>
                    <Ionicons name="star" size={14} color={Colors.secondary300} />
                    <Text style={styles.scoreBtnText}>自评</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* 最近自评记录 */}
            {behaviorRecords.length > 0 && (
              <View style={styles.recordsSection}>
                <Text style={styles.sectionLabel}>📝 最近自评记录</Text>
                {behaviorRecords.map(r => {
                  const ruleName = rules.find(rl => rl.id === r.rule_id)?.name || r.reason;
                  const positive = r.points_change >= 0;
                  const statusText = r.approved === 0 ? '⏳' : r.approved === -1 ? '❌' : '✅';
                  return (
                    <View key={r.id} style={styles.recordRow}>
                      <Text style={styles.recordStatus}>{statusText}</Text>
                      <Text style={styles.recordName} numberOfLines={1}>{ruleName}</Text>
                      <Text style={[styles.recordPts, { color: positive ? Colors.success : Colors.error }]}>
                        {positive ? '+' : ''}{r.points_change}
                      </Text>
                      <Text style={styles.recordTime}>
                        {r.created_at ? new Date(r.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>

        ) : (
          /* ── 任务 Tab（今日 / 全部）── */
          <>
            <Text style={styles.sectionLabel}>🔥 进行中 ({activeTasks.length})</Text>
            {activeTasks.length === 0 ? (
              <View style={styles.emptyHint}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyHintText}>今天还没有任务要做</Text>
                <Text style={styles.emptySubText}>完成家长布置的任务，获取积分吧！</Text>
              </View>
            ) : (
              (tab === 'today' ? activeTasks : tasks).map(task => (
                <TaskCard key={task.id} task={task} onSubmit={() => handleSubmit(task.id)} />
              ))
            )}

            <Text style={styles.sectionLabel}>✅ 已完成 ({doneTasks.length})</Text>
            {doneTasks.length === 0 ? (
              <View style={styles.emptyHint}>
                <Text style={styles.emptyEmoji}>🌟</Text>
                <Text style={styles.emptyHintText}>还没有完成的任务</Text>
                <Text style={styles.emptySubText}>完成任务获得 ⭐，兑换喜欢的奖品！</Text>
              </View>
            ) : (
              doneTasks.map(task => <TaskCard key={task.id} task={task} />)
            )}

            {/* 🎯 今日进度条 */}
            <View style={styles.summary}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>🎯 今日进度</Text>
                <Text style={styles.progressStats}>{doneCount}/{totalCount} 任务 · ⭐ {todayPoints} 分</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` as any }]} />
              </View>
              <Text style={styles.progressEmoji}>
                {progress === 0 ? '💪 开始行动吧！' :
                 progress < 50 ? '👏 加油，你可以的！' :
                 progress < 100 ? '🎉 快完成了！' :
                 '🏆 全部完成，太棒了！'}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>🔥</Text>
                  <Text style={styles.statNum}>{currentStreak}天</Text>
                  <Text style={styles.statLabel}>连续完成</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>⭐</Text>
                  <Text style={styles.statNum}>{todayPoints}</Text>
                  <Text style={styles.statLabel}>今日积分</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>✅</Text>
                  <Text style={styles.statNum}>{doneCount}/{totalCount}</Text>
                  <Text style={styles.statLabel}>完成进度</Text>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* 任务提示弹窗 */}
      <AppModal state={taskModal} onClose={hideTaskModal} />

      {/* 自评评分弹窗 */}
      <Modal visible={!!scoringRule} onClose={() => setScoringRule(null)} title={`自评：${scoringRule?.name || ''}`}>
        {scoringRule && (
          <>
            <Text style={styles.scoringDesc}>评估自己在这项行为中的表现，给自己打分</Text>
            <View style={styles.scoringArea}>
              <TouchableOpacity
                style={[styles.adjBtn, scoringPoints <= 1 && styles.adjBtnDisabled]}
                onPress={() => handleAdjustPoints(-1)}
                disabled={scoringPoints <= 1}
              >
                <Text style={[styles.adjText, scoringPoints <= 1 && { color: Colors.neutral300 }]}>−</Text>
              </TouchableOpacity>
              <View style={[styles.scoreBadge, isPos(scoringPoints) ? styles.badgePos : styles.badgeNeg]}>
                <Text style={[styles.scoreNum, { color: isPos(scoringPoints) ? Colors.success : Colors.error }]}>
                  {scoringPoints > 0 ? '+' : ''}{scoringPoints}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.adjBtn, scoringPoints >= scoringRule.points && styles.adjBtnDisabled]}
                onPress={() => handleAdjustPoints(1)}
                disabled={scoringPoints >= scoringRule.points}
              >
                <Text style={[styles.adjText, scoringPoints >= scoringRule.points && { color: Colors.neutral300 }]}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.scoringHint}>
              满分 {scoringRule.points > 0 ? '+' : ''}{scoringRule.points}，可自评 1 ~ {scoringRule.points}
            </Text>
            <View style={ModalStyles.buttonRow}>
              <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setScoringRule(null)}>
                <Text style={ModalStyles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ModalStyles.confirmButton, scoreSubmitting && { opacity: 0.5 }]}
                onPress={handleSelfScore}
                disabled={scoreSubmitting}
              >
                <Text style={ModalStyles.confirmButtonText}>
                  {scoreSubmitting ? '提交中...' : `确认 ${scoringPoints > 0 ? '+' : ''}${scoringPoints}`}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Modal>

      {/* 行为自评完成提示 */}
      <AppModal state={behaviorModal} onClose={hideBehaviorModal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Spacing[10] },
  emptyMessage: { fontSize: Typography.lg, color: Colors.neutral400 },
  bottomSpacer: { height: Spacing[5] },

  header: {
    paddingHorizontal: Spacing['4.5'],
    paddingTop: Spacing[4],
    paddingBottom: Spacing['2.5'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', gap: Spacing[2], alignItems: 'center' },
  greeting: { fontSize: Typography.lg, fontWeight: '700', color: Colors.neutral900 },
  emptyEmoji: { fontSize: 36, marginBottom: Spacing[1] },
  emptySubText: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: 2 },
  date: { fontSize: Typography.xs, color: Colors.neutral400 },
  pointsBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warningLight, paddingHorizontal: Spacing[2], paddingVertical: Spacing[1], borderRadius: BorderRadius.full, gap: 3 },
  pointsIcon: { fontSize: Typography.sm },
  pointsValue: { fontSize: Typography.sm, fontWeight: '800', color: Colors.warning },
  streakBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: Spacing[2], paddingVertical: Spacing[1], borderRadius: BorderRadius.full, gap: 3 },
  streakIcon: { fontSize: Typography.sm },

  tabRow: { flexDirection: 'row', marginHorizontal: Spacing['4.5'], marginBottom: Spacing['3.5'], gap: Spacing['2.5'] },
  tab: { flex: 1, paddingVertical: Spacing['2.5'] - 1, borderRadius: BorderRadius.button, alignItems: 'center', backgroundColor: Colors.neutral200 },
  tabActive: { backgroundColor: Colors.primary500 },
  tabText: { fontSize: Typography.sm + 1, fontWeight: '600', color: Colors.neutral500 },
  tabTextActive: { color: Colors.bgCard },

  scrollContent: { paddingHorizontal: Spacing['4.5'] },

  sectionLabel: { fontSize: Typography.base + 1, fontWeight: '700', color: Colors.neutral800, marginTop: Spacing[4], marginBottom: Spacing[2] },
  emptyHint: { alignItems: 'center', paddingVertical: Spacing[5] },
  emptyHintText: { fontSize: Typography.base, color: Colors.neutral300 },
  emptyHintSub: { fontSize: Typography.xs, color: Colors.neutral300, marginTop: 4 },
  emptyIcon: { fontSize: 40, marginBottom: Spacing[2] },

  summary: { backgroundColor: Colors.bgCard, borderRadius: BorderRadius['2xl'], padding: Spacing[4], marginTop: Spacing[4], ...Shadows.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing[2] },
  progressTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.neutral800 },
  progressStats: { fontSize: Typography.xs, color: Colors.neutral400 },
  progressBarBg: { height: 12, backgroundColor: Colors.neutral100, borderRadius: 6, overflow: 'hidden', marginBottom: Spacing[2] },
  progressBarFill: { height: 12, backgroundColor: Colors.primary500, borderRadius: 6 },
  progressEmoji: { fontSize: Typography.sm, color: Colors.neutral600, textAlign: 'center', marginBottom: Spacing[3] },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statEmoji: { fontSize: 20, marginBottom: 2 },
  statNum: { fontSize: Typography.base, fontWeight: '800', color: Colors.neutral900 },
  statLabel: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.neutral200 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing[2], borderBottomWidth: 1, borderBottomColor: Colors.borderDivider,
  },
  summaryLabel: { fontSize: Typography.base, color: Colors.neutral600 },
  summaryValue: { fontSize: Typography.base, fontWeight: '700', color: Colors.secondary300 },
  streakValue: { fontSize: Typography.base + 1, fontWeight: '700', color: Colors.primary500 },

  // ── 行为自评 ─────────────────────────────────────────────────
  catBarWrap: { marginBottom: Spacing[2] },
  catBar: { flexDirection: 'row', gap: Spacing[2] },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1] + 2,
    borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.neutral200,
    backgroundColor: Colors.bgCard,
  },
  catEmoji: { fontSize: Typography.sm + 2 },
  catLabel: { fontSize: Typography.sm + 1, fontWeight: '600', color: Colors.neutral500 },

  catHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing[2] },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.neutral800 },
  catCount: { fontSize: Typography.sm, fontWeight: '400', color: Colors.neutral400 },

  ruleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[3] + 2,
    marginBottom: Spacing[2],
    gap: Spacing[3],
    ...Shadows.sm,
  },
  pointsBadge: { width: 44, height: 36, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  badgePos: { backgroundColor: Colors.successLight },
  badgeNeg: { backgroundColor: Colors.errorLight },
  pointsNum: { fontSize: Typography.sm + 1, fontWeight: '800' },
  ruleInfo: { flex: 1 },
  ruleName: { fontSize: Typography.base, fontWeight: '600', color: Colors.neutral900, marginBottom: 3 },
  ruleTags: { flexDirection: 'row', gap: Spacing.xs },
  tagWrap: { backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.xs },
  tag: { fontSize: Typography.xs - 1, fontWeight: '600' },
  scoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.secondary50,
    paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.button,
  },
  scoreBtnText: { fontSize: Typography.xs, color: Colors.secondary300, fontWeight: '700' },

  recordsSection: { marginTop: Spacing[4] },
  recordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  recordStatus: { fontSize: Typography.sm, width: 24, textAlign: 'center' },
  recordName: { flex: 1, fontSize: Typography.sm, color: Colors.neutral800 },
  recordPts: { fontSize: Typography.sm, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  recordTime: { fontSize: Typography.xs, color: Colors.neutral400, width: 44, textAlign: 'right' },

  scoringDesc: { fontSize: Typography.sm, color: Colors.neutral500, textAlign: 'center', marginBottom: Spacing.md },
  scoringArea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[5], marginVertical: Spacing.md },
  adjBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.neutral200 },
  adjBtnDisabled: { opacity: 0.3 },
  adjText: { fontSize: Typography['2xl'] + 2, fontWeight: '700', color: Colors.neutral700 },
  scoreBadge: { minWidth: 72, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  scoreNum: { fontSize: Typography['3xl'], fontWeight: '800' },
  scoringHint: { fontSize: Typography.xs, color: Colors.neutral400, textAlign: 'center' },
});
