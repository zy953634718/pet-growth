import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useBehaviorStore } from '@/stores/useBehaviorStore';
import { BehaviorCategory } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal, { ModalStyles } from '@/components/Modal';

const PRESET_CATEGORIES: BehaviorCategory[] = [
  { id: 'study', family_id: '', name: '学习', icon: '📚', color: '#4A90D9', sort_order: 0, is_preset: 1, is_hidden: 0 },
  { id: 'chore', family_id: '', name: '家务', icon: '🧹', color: '#6BCB77', sort_order: 1, is_preset: 1, is_hidden: 0 },
  { id: 'sport', family_id: '', name: '运动', icon: '🏃', color: Colors.primary500, sort_order: 2, is_preset: 1, is_hidden: 0 },
  { id: 'habit', family_id: '', name: '习惯', icon: '😊', color: '#FFD93D', sort_order: 3, is_preset: 1, is_hidden: 0 },
  { id: 'social', family_id: '', name: '社交', icon: '🤝', color: '#9C7BCE', sort_order: 4, is_preset: 1, is_hidden: 0 },
  { id: 'correction', family_id: '', name: '纠正', icon: '⚠️', color: Colors.error, sort_order: 5, is_preset: 1, is_hidden: 0 },
];

export default function BehaviorRuleScreen() {
  const { currentFamily, children } = useFamilyStore();
  const { categories, rules, loadCategories, loadRules, addRule, updateRule, deleteRule, recordBehavior } = useBehaviorStore();
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePoints, setNewRulePoints] = useState('5');
  const [newRuleNeedApprove, setNewRuleNeedApprove] = useState(false);

  // 快速评分相关 state
  const [scoringRule, setScoringRule] = useState<any | null>(null);
  const [scoringChild, setScoringChild] = useState('');
  const [scoringPoints, setScoringPoints] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentFamily) {
      loadCategories(currentFamily.id);
      loadRules(currentFamily.id);
    }
  }, [currentFamily?.id]);

  // Set default active category when categories load
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories.length]);

  const filteredRules = rules.filter(r => r.category_id === activeCategory);
  const activeCat = categories.find(c => c.id === activeCategory);

  // --- 新增/编辑规则 ---
  const openAddModal = () => {
    setEditingRule(null);
    setNewRuleName('');
    setNewRulePoints('5');
    setNewRuleNeedApprove(false);
    setShowAddModal(true);
  };

  const openEditModal = (rule: any) => {
    setEditingRule(rule);
    setNewRuleName(rule.name);
    setNewRulePoints(String(rule.points));
    setNewRuleNeedApprove(rule.need_approve === 1);
    setShowAddModal(true);
  };

  const handleSaveRule = () => {
    if (!newRuleName.trim()) { Alert.alert('提示', '请输入规则名称'); return; }
    if (!currentFamily || !activeCategory) return;

    if (editingRule) {
      // 编辑模式
      updateRule(editingRule.id, {
        name: newRuleName.trim(),
        points: parseInt(newRulePoints) || 0,
        need_approve: newRuleNeedApprove ? 1 : 0,
      }).then(() => {
        setShowAddModal(false);
        setEditingRule(null);
        Alert.alert('成功', '规则已更新');
      }).catch((err: Error) => Alert.alert('提示', err.message));
    } else {
      // 新增模式
      addRule({
        family_id: currentFamily.id,
        category_id: activeCategory,
        name: newRuleName.trim(),
        points: parseInt(newRulePoints) || 5,
        daily_limit: 0,
        need_approve: newRuleNeedApprove ? 1 : 0,
        is_preset: 0,
      }).then(() => {
        setShowAddModal(false);
        setNewRuleName('');
        setNewRulePoints('5');
        setNewRuleNeedApprove(false);
      });
    }
  };

  // --- 删除规则 ---
  const handleDeleteRule = (rule: any) => {
    Alert.alert('确认删除', `确定要删除规则「${rule.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteRule(rule.id).catch((err: Error) => Alert.alert('提示', err.message));
        },
      },
    ]);
  };

  // --- 快速评分 ---
  const openScoringModal = (rule: any) => {
    setScoringRule(rule);
    setScoringPoints(rule.points > 0 ? 1 : -1);
    setScoringChild(children.length > 0 ? children[0].id : '');
  };

  const handleRecordBehavior = useCallback(async () => {
    if (!scoringRule || !scoringChild || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recordBehavior(
        scoringChild,
        scoringRule.id,
        `${scoringRule.name} 快速评分 ${scoringPoints > 0 ? '+' : ''}${scoringPoints}`,
        true
      );
      setScoringRule(null);
      Alert.alert('成功', `已记录 ${scoringPoints > 0 ? '+' : ''}${scoringPoints} 积分`);
    } catch (err: any) {
      Alert.alert('提示', err.message || '评分失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [scoringRule, scoringChild, scoringPoints, isSubmitting, recordBehavior]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>✏️ 行为规则</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Text style={styles.addBtnText}>+ 新规则</Text>
        </TouchableOpacity>
      </View>

      {/* 分类标签栏 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {(categories.length > 0 ? categories : PRESET_CATEGORIES.map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }))).map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.catChip,
              activeCategory === cat.id && { backgroundColor: (cat.color || '#4A90D9') + '22', borderColor: cat.color },
            ]}
            onPress={() => setActiveCategory(cat.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.catEmoji}>{cat.icon || '📋'}</Text>
            <Text style={[styles.catLabel, activeCategory === cat.id && { color: cat.color || '#4A90D9' }]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 规则列表 */}
      <View style={styles.rulesArea}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleHeaderTitle}>
            {activeCat ? `${activeCat.icon || '📋'} ${activeCat.name} 规则` : '规则列表'} ({filteredRules.length}条)
          </Text>
          <TouchableOpacity onPress={() => Alert.alert('提示', '预设已导入')}>
            <Text style={styles.importLink}>一键导入预设</Text>
          </TouchableOpacity>
        </View>

        {filteredRules.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>还没有规则，点击右上角添加</Text>
          </View>
        ) : (
          filteredRules.map((rule) => (
            <View key={rule.id} style={styles.ruleCard}>
              <View style={styles.ruleLeft}>
                <View style={[
                  styles.pointsBadge,
                  rule.points > 0 ? styles.positive : styles.negative,
                ]}>
                  <Text style={styles.pointsNum}>{rule.points > 0 ? '+' : ''}{rule.points}</Text>
                </View>
                <Text style={styles.ruleName}>{rule.name}</Text>
              </View>
              <View style={styles.ruleRight}>
                {rule.need_approve === 1 && (
                  <Text style={styles.approvalTag}>需审核</Text>
                )}
                {rule.daily_limit > 0 && (
                  <Text style={styles.limitTag}>限{rule.daily_limit}次</Text>
                )}
                <TouchableOpacity style={styles.actionBtn} onPress={() => openScoringModal(rule)}>
                  <Text style={styles.quickBtn}>评分</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(rule)}>
                  <Text style={styles.editBtn}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteRule(rule)}>
                  <Text style={styles.deleteBtn}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 添加/编辑规则弹窗 */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingRule ? '编辑规则' : '新增行为规则'}
      >
        <View>
          <Text style={ModalStyles.fieldLabel}>规则名称</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="例如：完成英语作业"
            value={newRuleName}
            onChangeText={setNewRuleName}
          />
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>积分值（正数加分，负数扣分）</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="正数加分，负数扣分"
            value={newRulePoints}
            onChangeText={(t) => setNewRulePoints(t.replace(/[^0-9-]/g, '').slice(0, 4))}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={ModalStyles.fieldLabel}>需要家长审核</Text>
          </View>
          <TouchableOpacity
            style={[ModalStyles.selectChip, newRuleNeedApprove && ModalStyles.selectedChip]}
            onPress={() => setNewRuleNeedApprove(!newRuleNeedApprove)}
          >
            <Text style={[ModalStyles.selectChipText, newRuleNeedApprove && ModalStyles.selectedChipText]}>
              {newRuleNeedApprove ? '是' : '否'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity
            style={ModalStyles.cancelButton}
            onPress={() => setShowAddModal(false)}
          >
            <Text style={ModalStyles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={ModalStyles.confirmButton}
            onPress={handleSaveRule}
          >
            <Text style={ModalStyles.confirmButtonText}>{editingRule ? '保存' : '添加'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 快速评分弹窗 */}
      <Modal
        visible={!!scoringRule}
        onClose={() => setScoringRule(null)}
        title={`快速评分：${scoringRule?.name || ''}`}
      >
        {scoringRule && (
          <>
            {/* 积分调节 */}
            <View style={styles.scoringPointsArea}>
              <TouchableOpacity
                style={[styles.scoringAdjustBtn, scoringPoints <= -5 && { opacity: 0.3 }]}
                onPress={() => setScoringPoints(Math.max(-5, scoringPoints - 1))}
                disabled={scoringPoints <= -5}
              >
                <Text style={styles.scoringAdjustText}>-</Text>
              </TouchableOpacity>
              <View style={[styles.pointsBadge, scoringPoints >= 0 ? styles.positive : styles.negative, styles.scoringBadge]}>
                <Text style={styles.scoringPointsNum}>{scoringPoints > 0 ? '+' : ''}{scoringPoints}</Text>
              </View>
              <TouchableOpacity
                style={[styles.scoringAdjustBtn, scoringPoints >= 5 && { opacity: 0.3 }]}
                onPress={() => setScoringPoints(Math.min(5, scoringPoints + 1))}
                disabled={scoringPoints >= 5}
              >
                <Text style={styles.scoringAdjustText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.scoringHint}>默认积分 {scoringRule.points > 0 ? '+' : ''}{scoringRule.points}，可自行调整</Text>

            {/* 选择孩子 */}
            {children.length > 0 && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={ModalStyles.fieldLabel}>选择孩子</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                  {children.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[ModalStyles.selectChip, scoringChild === c.id && ModalStyles.selectedChip]}
                      onPress={() => setScoringChild(c.id)}
                    >
                      <Text style={[ModalStyles.selectChipText, scoringChild === c.id && ModalStyles.selectedChipText]}>
                        {c.avatar || '👦'} {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={ModalStyles.buttonRow}>
              <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setScoringRule(null)}>
                <Text style={ModalStyles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ModalStyles.confirmButton, (!scoringChild || isSubmitting) && { opacity: 0.5 }]}
                onPress={handleRecordBehavior}
                disabled={!scoringChild || isSubmitting}
              >
                <Text style={ModalStyles.confirmButtonText}>
                  {isSubmitting ? '记录中...' : `确认 ${scoringPoints > 0 ? '+' : ''}${scoringPoints}`}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[4] + 2,
    paddingTop: Spacing.md + 2,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.xl + 2,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  addBtn: {
    backgroundColor: Colors.primary500,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
  },
  addBtnText: {
    color: Colors.bgCard,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  categoryRow: {
    paddingHorizontal: Spacing[4],
    gap: Spacing.xs + 3,
    paddingVertical: Spacing.sm,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius['3xl'],
    borderWidth: 1.3,
    borderColor: Colors.neutral200,
    backgroundColor: Colors.bgCard,
  },
  catEmoji: { fontSize: Typography.sm + 2 },
  catLabel: {
    fontSize: Typography.sm + 1,
    fontWeight: '600',
    color: Colors.neutral500,
  },
  rulesArea: {
    flex: 1,
    paddingHorizontal: Spacing[4],
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  ruleHeaderTitle: {
    fontSize: Typography.sm + 2,
    fontWeight: '700',
    color: Colors.neutral700,
  },
  importLink: {
    fontSize: Typography.sm + 1,
    color: Colors.secondary300,
    fontWeight: '500',
  },
  ruleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
  },
  ruleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  positive: {
    backgroundColor: Colors.successLight,
  },
  negative: {
    backgroundColor: Colors.errorLight,
  },
  pointsBadge: {
    width: Spacing[5] + 2,
    height: Spacing[7],
    borderRadius: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsNum: {
    fontSize: Typography.sm + 1,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  ruleName: {
    fontSize: Typography.base + 1,
    fontWeight: '500',
    color: Colors.neutral900,
  },
  ruleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 1,
  },
  approvalTag: {
    fontSize: Typography.xs - 2,
    color: Colors.warning,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Spacing.xs,
    fontWeight: '500',
  },
  limitTag: {
    fontSize: Typography.xs - 2,
    color: '#4A90D9',
    backgroundColor: Colors.infoLight,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Spacing.xs,
    fontWeight: '500',
  },
  actionBtn: {
    paddingVertical: Spacing.xs - 1,
    paddingHorizontal: Spacing.xs,
    borderRadius: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.neutral200,
    backgroundColor: Colors.neutral50,
  },
  quickBtn: {
    fontSize: Typography.xs - 1,
    color: Colors.secondary300,
    fontWeight: '600',
  },
  editBtn: {
    fontSize: Typography.xs - 1,
    color: Colors.primary500,
    fontWeight: '500',
  },
  deleteBtn: {
    fontSize: Typography.xs - 1,
    color: Colors.error,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['10'],
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  emptyIcon: {
    fontSize: Typography['5xl'] + 2,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sm + 1,
    color: Colors.neutral300,
  },

  // 快速评分相关样式
  scoringPointsArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
    marginVertical: Spacing.md,
  },
  scoringAdjustBtn: {
    width: Spacing[10],
    height: Spacing[10],
    borderRadius: Spacing[5],
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral200,
  },
  scoringAdjustText: {
    fontSize: Typography.xl + 4,
    fontWeight: '700',
    color: Colors.neutral700,
  },
  scoringBadge: {
    minWidth: Spacing[8] + 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  scoringPointsNum: {
    fontSize: Typography['2xl'] + 2,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  scoringHint: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    textAlign: 'center',
  },
});
