import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useBehaviorStore } from '@/stores/useBehaviorStore';
import { BehaviorCategory } from '@/types';
import { Colors, CategoryPalette, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal, { ModalStyles } from '@/components/Modal';
import AppModal from '@/components/AppModal';
import { useModal } from '@/hooks/useModal';

const PRESET_CATEGORIES: BehaviorCategory[] = [
  { id: 'study',      family_id: '', name: '学习', icon: '📚', color: CategoryPalette.study,   sort_order: 0, is_preset: 1, is_hidden: 0 },
  { id: 'chore',      family_id: '', name: '家务', icon: '🧹', color: CategoryPalette.chore,   sort_order: 1, is_preset: 1, is_hidden: 0 },
  { id: 'sport',      family_id: '', name: '运动', icon: '🏃', color: Colors.primary500,        sort_order: 2, is_preset: 1, is_hidden: 0 },
  { id: 'habit',      family_id: '', name: '习惯', icon: '😊', color: CategoryPalette.habit,   sort_order: 3, is_preset: 1, is_hidden: 0 },
  { id: 'social',     family_id: '', name: '社交', icon: '🤝', color: CategoryPalette.social,  sort_order: 4, is_preset: 1, is_hidden: 0 },
  { id: 'correction', family_id: '', name: '纠正', icon: '⚠️', color: Colors.error,            sort_order: 5, is_preset: 1, is_hidden: 0 },
];

export default function BehaviorRuleScreen() {
  const { currentFamily, children } = useFamilyStore();
  const { categories, rules, records, loadCategories, loadRules, loadRecords, addRule, updateRule, deleteRule, recordBehavior } = useBehaviorStore();
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePoints, setNewRulePoints] = useState('5');
  const [newRuleNeedApprove, setNewRuleNeedApprove] = useState(false);

  const [scoringRule, setScoringRule] = useState<any | null>(null);
  const [scoringChild, setScoringChild] = useState('');
  const [scoringPoints, setScoringPoints] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { modal, showModal, hideModal } = useModal();

  useEffect(() => {
    if (currentFamily) {
      loadCategories(currentFamily.id);
      loadRules(currentFamily.id);
    }
  }, [currentFamily?.id]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0].id);
  }, [categories.length]);

  // 加载第一个孩子的积分记录
  useEffect(() => {
    if (children.length > 0) {
      loadRecords(children[0].id);
    }
  }, [children.length]);

  const displayCategories = categories.length > 0
    ? categories
    : PRESET_CATEGORIES.map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }));

  const filteredRules = rules.filter(r => r.category_id === activeCategory);
  const activeCat = displayCategories.find(c => c.id === activeCategory);

  const openAddModal = () => {
    setEditingRule(null); setNewRuleName(''); setNewRulePoints('5'); setNewRuleNeedApprove(false);
    setShowAddModal(true);
  };

  const openEditModal = (rule: any) => {
    setEditingRule(rule); setNewRuleName(rule.name);
    setNewRulePoints(String(rule.points)); setNewRuleNeedApprove(rule.need_approve === 1);
    setShowAddModal(true);
  };

  const handleSaveRule = () => {
    if (!newRuleName.trim()) { showModal('提示', '请输入规则名称'); return; }
    if (!currentFamily || !activeCategory) return;
    if (editingRule) {
      updateRule(editingRule.id, { name: newRuleName.trim(), points: parseInt(newRulePoints) || 0, need_approve: newRuleNeedApprove ? 1 : 0 })
        .then(() => { setShowAddModal(false); setEditingRule(null); showModal('成功', '规则已更新'); })
        .catch((err: Error) => showModal('提示', err.message));
    } else {
      addRule({ family_id: currentFamily.id, category_id: activeCategory, name: newRuleName.trim(), points: parseInt(newRulePoints) || 5, daily_limit: 0, need_approve: newRuleNeedApprove ? 1 : 0, is_preset: 0 })
        .then(() => { setShowAddModal(false); setNewRuleName(''); setNewRulePoints('5'); setNewRuleNeedApprove(false); });
    }
  };

  const handleDeleteRule = (rule: any) => {
    showModal('确认删除', `确定要删除规则「${rule.name}」吗？`, [
      { text: '取消' },
      { text: '删除', danger: true, onPress: () => { deleteRule(rule.id).catch((err: Error) => showModal('提示', err.message)); } },
    ]);
  };

  const openScoringModal = (rule: any) => {
    setScoringRule(rule);
    setScoringPoints(rule.points);
    setScoringChild(children.length > 0 ? children[0].id : '');
  };

  const handleRecordBehavior = useCallback(async () => {
    if (!scoringRule || !scoringChild || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recordBehavior(scoringChild, scoringRule.id, `${scoringRule.name} 快速评分 ${scoringPoints > 0 ? '+' : ''}${scoringPoints}`, true, scoringPoints);
      setScoringRule(null);
      showModal('成功', `已记录 ${scoringPoints > 0 ? '+' : ''}${scoringPoints} 积分`);
    } catch (err: any) {
      showModal('提示', err.message || '评分失败');
    } finally { setIsSubmitting(false); }
  }, [scoringRule, scoringChild, scoringPoints, isSubmitting, recordBehavior]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 分类标签栏 */}
      <View style={styles.catBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catBar}>
          {displayCategories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, active && { backgroundColor: (cat.color || CategoryPalette.study) + '20', borderColor: cat.color || CategoryPalette.study }]}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.catEmoji}>{cat.icon || '📋'}</Text>
                <Text style={[styles.catLabel, active && { color: cat.color || CategoryPalette.study, fontWeight: '700' }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 规则区域 */}
      <View style={styles.rulesWrap}>
        <View style={styles.rulesHeader}>
          <View style={styles.rulesHeaderLeft}>
            {activeCat && <View style={[styles.catDot, { backgroundColor: activeCat.color || CategoryPalette.study }]} />}
            <Text style={styles.rulesTitle}>
              {activeCat ? `${activeCat.name} 规则` : '规则列表'}
              <Text style={styles.rulesCount}>  {filteredRules.length} 条</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Ionicons name="add" size={16} color={Colors.bgCard} />
            <Text style={styles.addBtnText}>新规则</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rulesList}>
          {filteredRules.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>还没有规则，点击「新规则」添加</Text>
            </View>
          ) : (
            filteredRules.map((rule) => (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={[styles.pointsBadge, rule.points >= 0 ? styles.badgePos : styles.badgeNeg]}>
                  <Text style={[styles.pointsNum, { color: rule.points >= 0 ? Colors.success : Colors.error }]}>
                    {rule.points > 0 ? '+' : ''}{rule.points}
                  </Text>
                </View>
                <View style={styles.ruleInfo}>
                  <Text style={styles.ruleName}>{rule.name}</Text>
                  <View style={styles.ruleTags}>
                    {rule.need_approve === 1 && (
                      <View style={styles.tagWrap}><Text style={[styles.tag, { color: Colors.warning }]}>需审核</Text></View>
                    )}
                    {rule.daily_limit > 0 && (
                      <View style={[styles.tagWrap, { backgroundColor: Colors.infoLight }]}><Text style={[styles.tag, { color: Colors.info }]}>限{rule.daily_limit}次</Text></View>
                    )}
                  </View>
                </View>
                <View style={styles.ruleActions}>
                  <TouchableOpacity style={[styles.actionBtn, styles.scoreBtn]} onPress={() => openScoringModal(rule)}>
                    <Text style={styles.scoreBtnText}>评分</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(rule)}>
                    <Ionicons name="pencil-outline" size={14} color={Colors.neutral500} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteRule(rule)}>
                    <Ionicons name="trash-outline" size={14} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* 最近评分记录 */}
        {records.filter(r => r.rule_id).length > 0 && children.length > 0 && (
          <View style={{ marginTop: Spacing[2], marginBottom: Spacing[4] }}>
            <Text style={styles.sectionTitle}>📝 最近评分记录</Text>
            {records.filter(r => r.rule_id).slice(0, 15).map((r) => {
              const ruleName = rules.find(rl => rl.id === r.rule_id)?.name || r.reason;
              const childName = children.find(c => c.id === r.child_id)?.name || '';
              const isPos = r.points_change >= 0;
              const statusText = r.approved === 0 ? '⏳' : r.approved === -1 ? '❌' : '✅';
              return (
                <View key={r.id} style={styles.recordRow}>
                  <Text style={styles.recordStatus}>{statusText}</Text>
                  <Text style={styles.recordChild}>{childName}</Text>
                  <Text style={styles.recordName} numberOfLines={1}>{ruleName}</Text>
                  <Text style={[styles.recordPoints, { color: isPos ? Colors.success : Colors.error }]}>
                    {isPos ? '+' : ''}{r.points_change}
                  </Text>
                  <Text style={styles.recordTime}>
                    {r.created_at ? new Date(r.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 添加/编辑规则弹窗 */}
      <Modal visible={showAddModal} onClose={() => setShowAddModal(false)} title={editingRule ? '编辑规则' : '新增行为规则'}>
        <View>
          <Text style={ModalStyles.fieldLabel}>规则名称</Text>
          <TextInput style={ModalStyles.input} placeholder="例如：完成英语作业" value={newRuleName} onChangeText={setNewRuleName} />
        </View>
        <View>
          <Text style={ModalStyles.fieldLabel}>积分值（正数加分，负数扣分）</Text>
          <TextInput style={ModalStyles.input} placeholder="正数加分，负数扣分" value={newRulePoints} onChangeText={(t) => setNewRulePoints(t.replace(/[^0-9-]/g, '').slice(0, 4))} keyboardType="number-pad" />
        </View>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={ModalStyles.fieldLabel}>需要家长审核</Text>
          </View>
          <TouchableOpacity style={[ModalStyles.selectChip, newRuleNeedApprove && ModalStyles.selectedChip]} onPress={() => setNewRuleNeedApprove(!newRuleNeedApprove)}>
            <Text style={[ModalStyles.selectChipText, newRuleNeedApprove && ModalStyles.selectedChipText]}>{newRuleNeedApprove ? '是' : '否'}</Text>
          </TouchableOpacity>
        </View>
        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setShowAddModal(false)}>
            <Text style={ModalStyles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ModalStyles.confirmButton} onPress={handleSaveRule}>
            <Text style={ModalStyles.confirmButtonText}>{editingRule ? '保存' : '添加'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 快速评分弹窗 */}
      <Modal visible={!!scoringRule} onClose={() => setScoringRule(null)} title={`快速评分：${scoringRule?.name || ''}`}>
        {scoringRule && (
          <>
            <View style={styles.scoringArea}>
              <TouchableOpacity style={styles.adjBtn} onPress={() => setScoringPoints(scoringPoints - 1)}>
                <Text style={styles.adjText}>−</Text>
              </TouchableOpacity>
              <View style={[styles.scoreBadge, scoringPoints >= 0 ? styles.badgePos : styles.badgeNeg]}>
                <Text style={[styles.scoreNum, { color: scoringPoints >= 0 ? Colors.success : Colors.error }]}>
                  {scoringPoints > 0 ? '+' : ''}{scoringPoints}
                </Text>
              </View>
              <TouchableOpacity style={styles.adjBtn} onPress={() => setScoringPoints(scoringPoints + 1)}>
                <Text style={styles.adjText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.scoringHint}>默认 {scoringRule.points > 0 ? '+' : ''}{scoringRule.points}，可自行调整</Text>

            {children.length > 0 && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={ModalStyles.fieldLabel}>选择孩子</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                  {children.map(c => (
                    <TouchableOpacity key={c.id} style={[ModalStyles.selectChip, scoringChild === c.id && ModalStyles.selectedChip]} onPress={() => setScoringChild(c.id)}>
                      <Text style={[ModalStyles.selectChipText, scoringChild === c.id && ModalStyles.selectedChipText]}>{c.avatar || '👦'} {c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={ModalStyles.buttonRow}>
              <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setScoringRule(null)}>
                <Text style={ModalStyles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ModalStyles.confirmButton, (!scoringChild || isSubmitting) && { opacity: 0.5 }]} onPress={handleRecordBehavior} disabled={!scoringChild || isSubmitting}>
                <Text style={ModalStyles.confirmButtonText}>{isSubmitting ? '记录中...' : `确认 ${scoringPoints > 0 ? '+' : ''}${scoringPoints}`}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Modal>

      <AppModal state={modal} onClose={hideModal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  catBarWrap: {
    backgroundColor: Colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  catBar: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] + 2, gap: Spacing.sm },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.neutral200,
    backgroundColor: Colors.bgCard,
  },
  catEmoji: { fontSize: Typography.sm + 2 },
  catLabel: { fontSize: Typography.sm + 1, fontWeight: '600', color: Colors.neutral500 },

  rulesWrap: { flex: 1, paddingHorizontal: Spacing[4] },
  rulesHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing[3],
  },
  rulesHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  rulesTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.neutral800 },
  rulesCount: { fontSize: Typography.sm, fontWeight: '400', color: Colors.neutral400 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primary500,
    paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.button,
  },
  addBtnText: { color: Colors.bgCard, fontSize: Typography.xs + 1, fontWeight: '700' },

  rulesList: { paddingBottom: Spacing[4] },
  ruleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[3] + 2,
    marginBottom: Spacing[2],
    gap: Spacing[3],
    ...Shadows.sm,
  },
  pointsBadge: {
    width: 44, height: 36, borderRadius: BorderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  badgePos: { backgroundColor: Colors.successLight },
  badgeNeg: { backgroundColor: Colors.errorLight },
  pointsNum: { fontSize: Typography.sm + 1, fontWeight: '800' },
  ruleInfo: { flex: 1 },
  ruleName: { fontSize: Typography.base, fontWeight: '600', color: Colors.neutral900, marginBottom: 3 },
  ruleTags: { flexDirection: 'row', gap: Spacing.xs },
  tagWrap: { backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.xs },
  tag: { fontSize: Typography.xs - 1, fontWeight: '600' },
  ruleActions: { flexDirection: 'row', gap: Spacing.xs },
  actionBtn: {
    width: 30, height: 30, borderRadius: BorderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neutral100,
  },
  scoreBtn: { backgroundColor: Colors.secondary50, width: 44 },
  scoreBtnText: { fontSize: Typography.xs, color: Colors.secondary300, fontWeight: '700' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },

  scoringArea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[5], marginVertical: Spacing.md },
  adjBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.neutral200 },
  adjBtnDisabled: { opacity: 0.3 },
  adjText: { fontSize: Typography['2xl'] + 2, fontWeight: '700', color: Colors.neutral700 },
  scoreBadge: { minWidth: 72, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  scoreNum: { fontSize: Typography['3xl'], fontWeight: '800' },
  scoringHint: { fontSize: Typography.xs, color: Colors.neutral400, textAlign: 'center' },

  emptyState: { paddingVertical: 60, alignItems: 'center', gap: Spacing[2] },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: Typography.sm + 1, color: Colors.neutral400 },

  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: Colors.neutral700,
    marginBottom: Spacing[2],
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  recordStatus: { fontSize: Typography.sm, width: 24, textAlign: 'center' },
  recordChild: { fontSize: Typography.xs, color: Colors.neutral500, minWidth: 32 },
  recordName: { flex: 1, fontSize: Typography.sm, color: Colors.neutral800 },
  recordPoints: { fontSize: Typography.sm, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  recordTime: { fontSize: Typography.xs, color: Colors.neutral400, width: 44, textAlign: 'right' },
});
