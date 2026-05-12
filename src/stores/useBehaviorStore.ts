import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  BehaviorRule,
  BehaviorCategory,
  PointRecord,
  CurrencyType,
} from '../types';
import { dbGetAll, dbRun } from '../db/helpers';

// ============================================================
// Store interface
// ============================================================
interface BehaviorState {
  rules: BehaviorRule[];
  categories: BehaviorCategory[];
  records: PointRecord[];
  isLoading: boolean;

  // Actions
  loadCategories: (familyId: string) => Promise<void>;
  loadRules: (familyId: string) => Promise<void>;
  loadRecords: (childId: string) => Promise<void>;
  addCategory: (familyId: string, name: string, icon: string, color: string) => Promise<BehaviorCategory>;
  addRule: (rule: Omit<BehaviorRule, 'id' | 'created_at'>) => Promise<BehaviorRule>;
  updateRule: (ruleId: string, updates: Partial<BehaviorRule>) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  recordBehavior: (
    childId: string,
    ruleId: string,
    reason: string,
    autoApprove?: boolean
  ) => Promise<PointRecord>;
  approveRecord: (recordId: string, approved: boolean) => Promise<void>;
  getTodayRecords: (childId: string) => Promise<PointRecord[]>;
  getTodayPointsForRule: (childId: string, ruleId: string) => Promise<number>;
  manualAddPoints: (
    childId: string,
    points: number,
    currency: CurrencyType,
    reason: string
  ) => Promise<PointRecord>;
}

export const useBehaviorStore = create<BehaviorState>()((set, get) => ({
  rules: [],
  categories: [],
  records: [],
  isLoading: false,

  loadCategories: async (familyId: string) => {
    const categories = await dbGetAll<BehaviorCategory>(
      'SELECT * FROM behavior_categories WHERE family_id = ? ORDER BY sort_order',
      [familyId]
    );
    set({ categories });
  },

  loadRules: async (familyId: string) => {
    set({ isLoading: true });
    const rules = await dbGetAll<BehaviorRule>(
      'SELECT * FROM behavior_rules WHERE family_id = ? ORDER BY created_at',
      [familyId]
    );
    set({ rules, isLoading: false });
  },

  loadRecords: async (childId: string) => {
    const records = await dbGetAll<PointRecord>(
      'SELECT * FROM point_records WHERE child_id = ? ORDER BY created_at DESC LIMIT 200',
      [childId]
    );
    set({ records });
  },

  addCategory: async (familyId: string, name: string, icon: string, color: string) => {
    const id = uuidv4();
    const { categories } = get();
    const category: BehaviorCategory = {
      id,
      family_id: familyId,
      name,
      icon,
      color,
      sort_order: categories.length,
      is_preset: 0,
      is_hidden: 0,
    };
    await dbRun(
      `INSERT INTO behavior_categories (id, family_id, name, icon, color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [category.id, category.family_id, category.name, category.icon, category.color, category.sort_order]
    );
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  addRule: async (ruleInput) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const rule: BehaviorRule = {
      ...ruleInput,
      id,
      created_at: now,
    };
    await dbRun(
      `INSERT INTO behavior_rules (id, family_id, category_id, name, points, daily_limit, need_approve, is_preset)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.id, rule.family_id, rule.category_id, rule.name, rule.points, rule.daily_limit, rule.need_approve, rule.is_preset]
    );
    set((state) => ({ rules: [...state.rules, rule] }));
    return rule;
  },

  updateRule: async (ruleId: string, updates: Partial<BehaviorRule>) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.points !== undefined) { fields.push('points = ?'); values.push(updates.points); }
    if (updates.category_id !== undefined) { fields.push('category_id = ?'); values.push(updates.category_id); }
    if (updates.daily_limit !== undefined) { fields.push('daily_limit = ?'); values.push(updates.daily_limit); }
    if (updates.need_approve !== undefined) { fields.push('need_approve = ?'); values.push(updates.need_approve); }

    if (fields.length > 0) {
      values.push(ruleId);
      await dbRun(`UPDATE behavior_rules SET ${fields.join(', ')} WHERE id = ?`, values);
      set((state) => ({
        rules: state.rules.map((r) =>
          r.id === ruleId ? { ...r, ...updates } : r
        ),
      }));
    }
  },

  deleteRule: async (ruleId: string) => {
    await dbRun('DELETE FROM behavior_rules WHERE id = ?', [ruleId]);
    set((state) => ({ rules: state.rules.filter((r) => r.id !== ruleId) }));
  },

  recordBehavior: async (childId: string, ruleId: string, reason: string, autoApprove = true) => {
    const { rules } = get();
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error('Rule not found');

    // Check daily limit (only applies to positive-point rules)
    if (rule.daily_limit > 0 && rule.points > 0) {
      const todayPoints = await get().getTodayPointsForRule(childId, ruleId);
      if (todayPoints + rule.points > rule.daily_limit) {
        throw new Error('已达到今日该行为积分上限');
      }
    }

    const approved = autoApprove && !rule.need_approve ? 1 : 0;
    const record: PointRecord = {
      id: uuidv4(),
      child_id: childId,
      rule_id: ruleId,
      task_id: null,
      points_change: rule.points,
      currency_type: 'points' as CurrencyType,
      reason: reason || rule.name,
      approved,
      created_at: new Date().toISOString(),
    };

    await dbRun(
      `INSERT INTO point_records (id, child_id, rule_id, points_change, currency_type, reason, approved)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [record.id, record.child_id, record.rule_id, record.points_change, record.currency_type, record.reason, record.approved]
    );

    set((state) => ({
      records: [record, ...state.records],
    }));

    return record;
  },

  approveRecord: async (recordId: string, approved: boolean) => {
    const approvedVal = approved ? 1 : -1;
    await dbRun('UPDATE point_records SET approved = ? WHERE id = ?', [approvedVal, recordId]);
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId ? { ...r, approved: approvedVal } : r
      ),
    }));
  },

  getTodayRecords: async (childId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dbGetAll<PointRecord>(
      `SELECT * FROM point_records
       WHERE child_id = ? AND approved = 1
       AND DATE(created_at) = ?
       ORDER BY created_at DESC`,
      [childId, today]
    );
  },

  getTodayPointsForRule: async (childId: string, ruleId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const rows = await dbGetAll<{ total: number }>(
      `SELECT COALESCE(SUM(points_change), 0) as total
       FROM point_records
       WHERE child_id = ? AND rule_id = ? AND approved >= 0
       AND DATE(created_at) = ?`,
      [childId, ruleId, today]
    );
    return rows[0]?.total ?? 0;
  },

  manualAddPoints: async (childId: string, points: number, currency: CurrencyType, reason: string) => {
    const record: PointRecord = {
      id: uuidv4(),
      child_id: childId,
      rule_id: null,
      task_id: null,
      points_change: points,
      currency_type: currency,
      reason,
      approved: 1,
      created_at: new Date().toISOString(),
    };

    await dbRun(
      `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.id, record.child_id, record.rule_id, record.task_id, record.points_change, record.currency_type, record.reason, record.approved]
    );

    set((state) => ({
      records: [record, ...state.records],
    }));

    return record;
  },
}));
