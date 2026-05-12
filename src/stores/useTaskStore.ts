import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskCategory,
  TaskTemplate,
  TaskCompletion,
  TaskStatus,
  RepeatType,
  ConfirmMode,
  Streak,
  Priority,
} from '../types';
import { dbGetAll, dbGetOne, dbRun } from '../db/helpers';
import { STREAK_REWARDS } from '../constants/evolution';
import { useFamilyStore } from './useFamilyStore';
import { usePetStore } from './usePetStore';

// ============================================================
// 任务奖励结算
// ============================================================
async function grantTaskCompletionRewards(childId: string, task: Task): Promise<void> {
  const points = task.points_reward ?? 0;
  const stars = task.stars_reward ?? 0;
  if (points === 0 && stars === 0) {
    await usePetStore.getState().addPointsForChild(childId, 5);
    return;
  }

  await dbRun(
    `UPDATE children SET
      current_points = current_points + ?,
      total_points = total_points + ?,
      current_stars = current_stars + ?,
      total_stars = total_stars + ?
     WHERE id = ?`,
    [points, points, stars, stars, childId]
  );

  const ts = new Date().toISOString();
  if (points > 0) {
    await dbRun(
      `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
       VALUES (?, ?, NULL, ?, ?, 'points', ?, 1, ?)`,
      [uuidv4(), childId, task.id, points, `完成任务：${task.title}`, ts]
    );
  }
  if (stars > 0) {
    await dbRun(
      `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
       VALUES (?, ?, NULL, ?, ?, 'stars', ?, 1, ?)`,
      [uuidv4(), childId, task.id, stars, `完成任务：${task.title}`, ts]
    );
  }

  await useFamilyStore.getState().refreshChildFromDb(childId);
  await usePetStore.getState().addPointsForChild(childId, points || 5);
}

/** 连续打卡里程碑奖励 */
async function grantStreakMilestoneRewards(childId: string, prevStreak: number, newStreak: number) {
  if (newStreak <= prevStreak) return;
  const ts = new Date().toISOString();
  for (const r of STREAK_REWARDS) {
    if (newStreak < r.days || prevStreak >= r.days) continue;
    const pts = r.pointsReward ?? 0;
    const sts = r.starsReward ?? 0;
    if (pts <= 0 && sts <= 0) continue;

    if (pts > 0) {
      await dbRun(
        `UPDATE children SET current_points = current_points + ?, total_points = total_points + ? WHERE id = ?`,
        [pts, pts, childId]
      );
      await dbRun(
        `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
         VALUES (?, ?, NULL, NULL, ?, 'points', ?, 1, ?)`,
        [uuidv4(), childId, pts, r.description, ts]
      );
    }
    if (sts > 0) {
      await dbRun(
        `UPDATE children SET current_stars = current_stars + ?, total_stars = total_stars + ? WHERE id = ?`,
        [sts, sts, childId]
      );
      await dbRun(
        `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
         VALUES (?, ?, NULL, NULL, ?, 'stars', ?, 1, ?)`,
        [uuidv4(), childId, sts, r.description, ts]
      );
    }

    await useFamilyStore.getState().refreshChildFromDb(childId);
    await usePetStore.getState().addPointsForChild(childId, pts || 5);
  }
}

// ============================================================
// Store interface
// ============================================================
interface TaskState {
  tasks: Task[];
  categories: TaskCategory[];
  templates: TaskTemplate[];
  completions: TaskCompletion[];
  streaks: Streak[];
  isLoading: boolean;

  loadTasks: (familyId: string, childId?: string) => Promise<void>;
  loadCategories: (familyId: string) => Promise<void>;
  loadTemplates: (familyId: string) => Promise<void>;
  loadCompletions: (childId: string) => Promise<void>;
  loadStreaks: (childId: string) => Promise<void>;
  createTask: (task: Omit<Task, 'id' | 'status' | 'points_awarded' | 'created_at' | 'completed_at' | 'confirmed_at' | 'completion_proof'>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  submitTask: (taskId: string, childId: string, proofData?: string) => Promise<TaskCompletion>;
  approveTask: (completionId: string) => Promise<void>;
  rejectTask: (completionId: string) => Promise<void>;
  addCategory: (familyId: string, name: string, icon: string, color: string) => Promise<TaskCategory>;
  addTemplate: (template: Omit<TaskTemplate, 'id' | 'created_at'>) => Promise<TaskTemplate>;
  getTodayTasks: (childId: string) => Promise<Task[]>;
  getPendingApprovals: (familyId: string) => Promise<TaskCompletion[]>;
  checkOverdue: (familyId: string) => Promise<void>;
  generateDailyTasks: (familyId: string) => Promise<void>;
  updateStreak: (childId: string, categoryId?: string) => Promise<Streak>;
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  categories: [],
  templates: [],
  completions: [],
  streaks: [],
  isLoading: false,

  loadTasks: async (familyId: string, childId?: string) => {
    set({ isLoading: true });
    let sql = 'SELECT * FROM tasks WHERE family_id = ?';
    const params: (string | number | null)[] = [familyId];
    if (childId) {
      sql += ' AND assignee_id = ?';
      params.push(childId);
    }
    sql += ' ORDER BY created_at DESC';
    const tasks = await dbGetAll<Task>(sql, params);
    set({ tasks, isLoading: false });
  },

  loadCategories: async (familyId: string) => {
    const categories = await dbGetAll<TaskCategory>(
      'SELECT * FROM task_categories WHERE family_id = ? ORDER BY sort_order',
      [familyId]
    );
    set({ categories });
  },

  loadTemplates: async (familyId: string) => {
    const templates = await dbGetAll<TaskTemplate>(
      'SELECT * FROM task_templates WHERE family_id = ?',
      [familyId]
    );
    set({ templates });
  },

  loadCompletions: async (childId: string) => {
    const completions = await dbGetAll<TaskCompletion>(
      'SELECT * FROM task_completions WHERE child_id = ? ORDER BY completed_at DESC LIMIT 100',
      [childId]
    );
    set({ completions });
  },

  loadStreaks: async (childId: string) => {
    const streaks = await dbGetAll<Streak>(
      'SELECT * FROM streaks WHERE child_id = ?',
      [childId]
    );
    set({ streaks });
  },

  createTask: async (taskInput) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const task: Task = {
      ...taskInput,
      id,
      // BUG-12 关联修复：新建任务默认 active，start_time 到达前也用 active
      status: 'active',
      points_awarded: 0,
      created_at: now,
      completed_at: null,
      confirmed_at: null,
      completion_proof: null,
    };

    await dbRun(
      `INSERT INTO tasks (id, family_id, category_id, title, description, points_reward, stars_reward,
        deadline, start_time, repeat_type, repeat_config, confirm_mode, overdue_penalty,
        assignee_id, priority, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id, task.family_id, task.category_id, task.title, task.description,
        task.points_reward, task.stars_reward, task.deadline, task.start_time,
        task.repeat_type, task.repeat_config, task.confirm_mode, task.overdue_penalty,
        task.assignee_id, task.priority, task.status, task.created_at,
      ]
    );

    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: async (taskId: string, updates: Partial<Task>) => {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const updateFields: (keyof Task)[] = ['title', 'description', 'category_id', 'points_reward', 'stars_reward',
      'deadline', 'start_time', 'repeat_type', 'repeat_config', 'confirm_mode',
      'overdue_penalty', 'priority', 'status'];

    for (const field of updateFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field] as string | number | null);
      }
    }

    if (fields.length > 0) {
      values.push(taskId);
      await dbRun(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
      set((state) => ({
        tasks: state.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t),
      }));
    }
  },

  deleteTask: async (taskId: string) => {
    await dbRun('DELETE FROM tasks WHERE id = ?', [taskId]);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) }));
  },

  // BUG-01 修复：SQL 参数数量与占位符一致（3个?对应3个参数）
  submitTask: async (taskId: string, childId: string, proofData?: string) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const now = new Date().toISOString();

    if (task.confirm_mode === 'auto') {
      // BUG-01 修复：3个占位符对应3个参数
      await dbRun('UPDATE tasks SET status = ?, completed_at = ?, points_awarded = 1 WHERE id = ?', [
        'completed', now, taskId,
      ]);
      const completion: TaskCompletion = {
        id: uuidv4(),
        task_id: taskId,
        child_id: childId,
        proof_data: proofData ?? null,
        approved: 1,
        completed_at: now,
        confirmed_at: now,
      };
      await dbRun(
        `INSERT INTO task_completions (id, task_id, child_id, proof_data, approved, completed_at, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [completion.id, completion.task_id, completion.child_id, completion.proof_data, completion.approved, completion.completed_at, completion.confirmed_at]
      );

      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'completed' as TaskStatus, completed_at: now, points_awarded: 1 } : t
        ),
        completions: [completion, ...state.completions],
      }));

      await get().updateStreak(childId, task.category_id ?? undefined);
      await grantTaskCompletionRewards(childId, task);
      return completion;
    }

    await dbRun('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?', ['submitted', now, taskId]);

    const completion: TaskCompletion = {
      id: uuidv4(),
      task_id: taskId,
      child_id: childId,
      proof_data: proofData ?? null,
      approved: 0,
      completed_at: now,
      confirmed_at: null,
    };
    await dbRun(
      `INSERT INTO task_completions (id, task_id, child_id, proof_data, approved, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [completion.id, completion.task_id, completion.child_id, completion.proof_data, completion.approved, completion.completed_at]
    );

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'submitted' as TaskStatus, completed_at: now } : t
      ),
      completions: [completion, ...state.completions],
    }));

    return completion;
  },

  // BUG-05 修复：先读取 points_awarded 原值，再 UPDATE，再发奖
  approveTask: async (completionId: string) => {
    const now = new Date().toISOString();

    // 先读取完成记录
    const completion = await dbGetOne<TaskCompletion>(
      'SELECT * FROM task_completions WHERE id = ?',
      [completionId]
    );
    if (!completion) return;

    // 读取任务原始状态（判断是否已发过奖励）
    const taskRow = await dbGetOne<Task>('SELECT * FROM tasks WHERE id = ?', [completion.task_id]);

    // 更新完成记录和任务状态
    await dbRun(
      'UPDATE task_completions SET approved = 1, confirmed_at = ? WHERE id = ?',
      [now, completionId]
    );
    await dbRun('UPDATE tasks SET status = ?, points_awarded = 1 WHERE id = ?', [
      'completed', completion.task_id,
    ]);

    // BUG-05 修复：使用读取到的原始 points_awarded 判断，避免时序问题
    if (taskRow && taskRow.points_awarded === 0) {
      await get().updateStreak(completion.child_id);
      await grantTaskCompletionRewards(completion.child_id, taskRow);
    }

    set((state) => ({
      completions: state.completions.map((c) =>
        c.id === completionId ? { ...c, approved: 1, confirmed_at: now } : c
      ),
      tasks: state.tasks.map((t) =>
        t.id === completion.task_id ? { ...t, status: 'completed' as TaskStatus, points_awarded: 1 } : t
      ),
    }));
  },

  // BUG-13 修复：拒绝后回退到 'active' 而非 'in_progress'
  rejectTask: async (completionId: string) => {
    await dbRun('UPDATE task_completions SET approved = -1 WHERE id = ?', [completionId]);

    const completion = await dbGetOne<TaskCompletion>(
      'SELECT * FROM task_completions WHERE id = ?',
      [completionId]
    );
    if (completion) {
      await dbRun('UPDATE tasks SET status = ? WHERE id = ?', ['active', completion.task_id]);
    }

    set((state) => ({
      completions: state.completions.map((c) =>
        c.id === completionId ? { ...c, approved: -1 } : c
      ),
      tasks: state.tasks.map((t) =>
        t.id === completion?.task_id ? { ...t, status: 'active' as TaskStatus } : t
      ),
    }));
  },

  addCategory: async (familyId: string, name: string, icon: string, color: string) => {
    const id = uuidv4();
    const { categories } = get();
    const category: TaskCategory = {
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
      `INSERT INTO task_categories (id, family_id, name, icon, color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [category.id, category.family_id, category.name, category.icon, category.color, category.sort_order]
    );
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  addTemplate: async (templateInput) => {
    const id = uuidv4();
    const template: TaskTemplate = {
      ...templateInput,
      id,
      created_at: new Date().toISOString(),
    };
    await dbRun(
      `INSERT INTO task_templates (id, family_id, category_id, title, description, default_points, default_confirm_mode, default_repeat, is_preset, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [template.id, template.family_id, template.category_id, template.title, template.description,
        template.default_points, template.default_confirm_mode, template.default_repeat, template.is_preset, template.created_at]
    );
    set((state) => ({ templates: [...state.templates, template] }));
    return template;
  },

  // BUG-12 修复：添加 'active' 状态到查询条件
  getTodayTasks: async (childId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dbGetAll<Task>(
      `SELECT * FROM tasks
       WHERE assignee_id = ?
       AND (status = 'active' OR status = 'in_progress' OR status = 'submitted')
       AND (start_time IS NULL OR DATE(start_time) <= ?)
       AND (deadline IS NULL OR DATE(deadline) >= ?)
       ORDER BY priority DESC, deadline ASC`,
      [childId, today, today]
    );
  },

  getPendingApprovals: async (familyId: string) => {
    return dbGetAll<TaskCompletion>(
      `SELECT tc.*, t.title as task_title, c.name as child_name
       FROM task_completions tc
       JOIN tasks t ON tc.task_id = t.id
       JOIN children c ON tc.child_id = c.id
       WHERE t.family_id = ? AND tc.approved = 0
       ORDER BY tc.completed_at DESC`,
      [familyId]
    );
  },

  checkOverdue: async (familyId: string) => {
    const now = new Date().toISOString();
    await dbRun(
      `UPDATE tasks SET status = 'overdue'
       WHERE family_id = ? AND status IN ('active', 'in_progress')
       AND deadline IS NOT NULL AND deadline < ?`,
      [familyId, now]
    );

    const { tasks } = get();
    set({
      tasks: tasks.map((t) => {
        if (
          t.family_id === familyId &&
          ['active', 'in_progress'].includes(t.status) &&
          t.deadline &&
          new Date(t.deadline) < new Date()
        ) {
          return { ...t, status: 'overdue' as TaskStatus };
        }
        return t;
      }),
    });
  },

  // BUG-07 修复：生成每日任务前先将前一天未完成的旧实例标记为 overdue
  generateDailyTasks: async (familyId: string) => {
    const today = new Date().toISOString().split('T')[0];

    // 将昨天及以前未完成的每日任务实例标记为 overdue
    await dbRun(
      `UPDATE tasks SET status = 'overdue'
       WHERE family_id = ? AND repeat_type = 'once'
       AND status IN ('active', 'in_progress')
       AND start_time IS NOT NULL AND DATE(start_time) < ?`,
      [familyId, today]
    );

    const recurringTasks = await dbGetAll<Task>(
      `SELECT * FROM tasks
       WHERE family_id = ? AND repeat_type != 'once' AND status != 'overdue'
       ORDER BY created_at`,
      [familyId]
    );

    for (const template of recurringTasks) {
      const existing = await dbGetOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM task_completions
         WHERE task_id = ? AND DATE(completed_at) = ? AND approved IN (0, 1)`,
        [template.id, today]
      );
      if (existing && existing.count > 0) continue;

      const activeInstance = await dbGetOne<Task>(
        `SELECT * FROM tasks
         WHERE family_id = ? AND status IN ('active', 'in_progress', 'submitted')
         AND DATE(start_time) = ?
         AND title = ? AND assignee_id = ?`,
        [familyId, today, template.title, template.assignee_id]
      );
      if (activeInstance) continue;

      if (template.repeat_type === 'weekly' && template.repeat_config) {
        try {
          const config = JSON.parse(template.repeat_config);
          const dayOfWeek = new Date().getDay();
          if (!config.daysOfWeek?.includes(dayOfWeek === 0 ? 7 : dayOfWeek)) continue;
        } catch {
          continue;
        }
      }

      const id = uuidv4();
      const todayStart = new Date();
      todayStart.setHours(7, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(21, 0, 0, 0);

      await dbRun(
        `INSERT INTO tasks (id, family_id, category_id, title, description, points_reward, stars_reward,
          deadline, start_time, repeat_type, repeat_config, confirm_mode, overdue_penalty,
          assignee_id, priority, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'once', NULL, ?, ?, ?, ?, 'active', ?)`,
        [
          id, template.family_id, template.category_id, template.title, template.description,
          template.points_reward, template.stars_reward,
          todayEnd.toISOString(), todayStart.toISOString(),
          template.confirm_mode, template.overdue_penalty,
          template.assignee_id, template.priority, new Date().toISOString(),
        ]
      );
    }

    await get().loadTasks(familyId);
  },

  // BUG-02 修复：categoryId 为 undefined 时传 null，正确匹配 IS NULL
  updateStreak: async (childId: string, categoryId?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const catIdParam = categoryId ?? null;

    const existing = await dbGetOne<Streak>(
      'SELECT * FROM streaks WHERE child_id = ? AND category_id IS ?',
      [childId, catIdParam]
    );

    if (existing) {
      const lastDate = existing.last_completion_date;
      let newStreak = existing.current_streak;
      const prevStreak = existing.current_streak;

      if (lastDate === today) return existing;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastDate === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }

      const bestStreak = Math.max(existing.best_streak, newStreak);

      await dbRun(
        'UPDATE streaks SET current_streak = ?, best_streak = ?, last_completion_date = ? WHERE id = ?',
        [newStreak, bestStreak, today, existing.id]
      );

      await grantStreakMilestoneRewards(childId, prevStreak, newStreak);

      const updated: Streak = { ...existing, current_streak: newStreak, best_streak: bestStreak, last_completion_date: today };
      set((state) => ({
        streaks: state.streaks.map((s) => s.id === existing.id ? updated : s),
      }));
      return updated;
    } else {
      const id = uuidv4();
      const streak: Streak = {
        id,
        child_id: childId,
        category_id: catIdParam,
        current_streak: 1,
        best_streak: 1,
        last_completion_date: today,
      };
      await dbRun(
        'INSERT INTO streaks (id, child_id, category_id, current_streak, best_streak, last_completion_date) VALUES (?, ?, ?, ?, ?, ?)',
        [streak.id, streak.child_id, streak.category_id, streak.current_streak, streak.best_streak, streak.last_completion_date]
      );
      set((state) => ({ streaks: [...state.streaks, streak] }));
      return streak;
    }
  },
}));
