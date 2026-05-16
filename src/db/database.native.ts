import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

let db: SQLite.SQLiteDatabase | null = null;

// ============================================================
// 数据库初始化
// ============================================================
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('petgrowth.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  await createTables();
  return db;
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ============================================================
// 创建所有表
// ============================================================
async function createTables(): Promise<void> {
  const database = getDatabase();

  const createTableStatements = [
    // 应用级键值（Zustand 会话等，不入业务备份表清单）
    `CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );`,

    // 家庭表
    `CREATE TABLE IF NOT EXISTS family (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      parent_password TEXT NOT NULL,
      parent_pin_length INTEGER DEFAULT 6,
      created_at TEXT DEFAULT (datetime('now'))
    );`,

    // 孩子表
    `CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      age_range TEXT DEFAULT '6-8',
      avatar TEXT,
      total_points INTEGER DEFAULT 0,
      current_points INTEGER DEFAULT 0,
      total_stars INTEGER DEFAULT 0,
      current_stars INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE
    );`,

    // 宠物表
    `CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL,
      species_id TEXT NOT NULL,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      current_points INTEGER DEFAULT 0,
      points_to_next_level INTEGER DEFAULT 100,
      current_stage INTEGER DEFAULT 1,
      mood_type TEXT DEFAULT 'normal',
      mood_value INTEGER DEFAULT 80,
      health_type TEXT DEFAULT 'healthy',
      hunger_value INTEGER DEFAULT 80,
      clean_value INTEGER DEFAULT 80,
      last_fed_at TEXT DEFAULT (datetime('now')),
      last_bathed_at TEXT DEFAULT (datetime('now')),
      last_played_at TEXT DEFAULT (datetime('now')),
      last_rested_at TEXT,
      sick_since TEXT,
      consecutive_neglect_days INTEGER DEFAULT 0,
      ran_away_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    );`,

    // 进化记录表
    `CREATE TABLE IF NOT EXISTS evolution_history (
      id TEXT PRIMARY KEY NOT NULL,
      pet_id TEXT NOT NULL,
      stage INTEGER NOT NULL,
      evolved_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    );`,

    // 行为规则分类表
    `CREATE TABLE IF NOT EXISTS behavior_categories (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      is_preset INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE
    );`,

    // 行为规则表
    `CREATE TABLE IF NOT EXISTS behavior_rules (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      points INTEGER NOT NULL,
      daily_limit INTEGER DEFAULT 0,
      need_approve INTEGER DEFAULT 0,
      is_preset INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES behavior_categories(id) ON DELETE CASCADE
    );`,

    // 积分记录表
    `CREATE TABLE IF NOT EXISTS point_records (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL,
      rule_id TEXT,
      task_id TEXT,
      points_change INTEGER NOT NULL,
      currency_type TEXT DEFAULT 'points',
      reason TEXT,
      approved INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_id) REFERENCES behavior_rules(id) ON DELETE SET NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );`,

    // 任务分类表
    `CREATE TABLE IF NOT EXISTS task_categories (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      is_preset INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE
    );`,

    // 任务模板表
    `CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      default_points INTEGER DEFAULT 5,
      default_confirm_mode TEXT DEFAULT 'auto',
      default_repeat TEXT DEFAULT 'once',
      is_preset INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES task_categories(id) ON DELETE CASCADE
    );`,

    // 任务表
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL,
      category_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      points_reward INTEGER DEFAULT 5,
      stars_reward INTEGER DEFAULT 0,
      deadline TEXT,
      start_time TEXT,
      repeat_type TEXT DEFAULT 'once',
      repeat_config TEXT,
      confirm_mode TEXT DEFAULT 'auto',
      overdue_penalty INTEGER DEFAULT 0,
      assignee_id TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'active',
      completion_proof TEXT,
      completed_at TEXT,
      confirmed_at TEXT,
      points_awarded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES task_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (assignee_id) REFERENCES children(id) ON DELETE CASCADE
    );`,

    // 任务完成记录表
    `CREATE TABLE IF NOT EXISTS task_completions (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      child_id TEXT NOT NULL,
      proof_data TEXT,
      approved INTEGER DEFAULT 0,
      completed_at TEXT DEFAULT (datetime('now')),
      confirmed_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    );`,

    // 连续完成记录表
    `CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL,
      category_id TEXT,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      last_completion_date TEXT,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    );`,

    // 商城商品表
    `CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      item_type TEXT NOT NULL,
      sub_type TEXT,
      price_type TEXT DEFAULT 'points',
      price INTEGER NOT NULL,
      stock INTEGER DEFAULT -1,
      image TEXT,
      rarity TEXT DEFAULT 'common',
      is_preset INTEGER DEFAULT 0,
      parent_approval INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE
    );`,

    // 兑换记录表
    `CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      redeem_code TEXT,
      status TEXT DEFAULT 'pending',
      purchase_time TEXT DEFAULT (datetime('now')),
      redeemed_at TEXT,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
    );`,

    // 宠物装扮装备表
    `CREATE TABLE IF NOT EXISTS pet_equipments (
      id TEXT PRIMARY KEY NOT NULL,
      pet_id TEXT NOT NULL,
      slot_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      equipped INTEGER DEFAULT 0,
      acquired_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
    );`,

    // AI配置表
    `CREATE TABLE IF NOT EXISTS ai_config (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL UNIQUE,
      model_provider TEXT DEFAULT 'qwen',
      model_name TEXT DEFAULT 'qwen-turbo',
      api_key_encrypted TEXT,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 200,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE
    );`,

    // AI安全配置表
    `CREATE TABLE IF NOT EXISTS ai_safety_config (
      id TEXT PRIMARY KEY NOT NULL,
      family_id TEXT NOT NULL UNIQUE,
      topic_restriction TEXT,
      filter_level TEXT DEFAULT 'standard',
      daily_message_limit INTEGER DEFAULT 50,
      session_duration_limit INTEGER DEFAULT 15,
      allowed_time_slots TEXT,
      blocked_keywords TEXT,
      save_history INTEGER DEFAULT 1,
      enable_voice INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES family(id) ON DELETE CASCADE
    );`,

    // 聊天记录表
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      pet_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      mood_at_time TEXT,
      pet_stage_at_time INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    );`,

    // 每日汇总表
    `CREATE TABLE IF NOT EXISTS daily_summaries (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL,
      date TEXT NOT NULL,
      points_earned INTEGER DEFAULT 0,
      points_spent INTEGER DEFAULT 0,
      stars_earned INTEGER DEFAULT 0,
      stars_spent INTEGER DEFAULT 0,
      tasks_completed INTEGER DEFAULT 0,
      tasks_total INTEGER DEFAULT 0,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      UNIQUE(child_id, date)
    );`,

    // 每日行为记录（用于每日上限控制）
    `CREATE TABLE IF NOT EXISTS daily_behavior_records (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_id) REFERENCES behavior_rules(id) ON DELETE CASCADE,
      UNIQUE(child_id, rule_id, date)
    );`,

    // 宠物图鉴表：保存满级宠物的快照信息
    `CREATE TABLE IF NOT EXISTS pet_collection (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL,
      pet_id TEXT NOT NULL,
      species_id TEXT NOT NULL,
      pet_name TEXT NOT NULL,
      species_emoji TEXT NOT NULL,
      species_display_name TEXT NOT NULL,
      saved_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    );`,
  ];

  for (const sql of createTableStatements) {
    await database.execAsync(sql);
  }

  // 创建索引
  const createIndexStatements = [
    `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);`,
    `CREATE INDEX IF NOT EXISTS idx_point_records_child ON point_records(child_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_pet ON chat_messages(pet_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_child ON purchases(child_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_daily_summaries_child ON daily_summaries(child_id, date);`,
    `CREATE INDEX IF NOT EXISTS idx_daily_behavior_records ON daily_behavior_records(child_id, rule_id, date);`,
    `CREATE INDEX IF NOT EXISTS idx_pet_collection_child ON pet_collection(child_id, saved_at);`,
  ];

  for (const sql of createIndexStatements) {
    await database.execAsync(sql);
  }

  // ============================================================
  // 数据库迁移：exp 字段重命名为 points
  // ============================================================
  const migrations = [
    // 检查旧列是否存在，存在则重命名
    `ALTER TABLE pets RENAME COLUMN current_exp TO current_points;`,
    `ALTER TABLE pets RENAME COLUMN exp_to_next_level TO points_to_next_level;`,
    // 新增 parent_pin_length 列（v1→v2 迁移）
    `ALTER TABLE family ADD COLUMN parent_pin_length INTEGER DEFAULT 6;`,
  ];

  for (const sql of migrations) {
    try {
      await database.execAsync(sql);
    } catch {
      // 列名已更新或不存在，忽略错误
    }
  }
}

// ============================================================
// 数据库操作工具函数
// ============================================================

export function generateId(): string {
  return uuidv4();
}

export function now(): string {
  return new Date().toISOString();
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// 预设数据导入
// ============================================================
export async function importPresets(familyId: string): Promise<void> {
  const database = getDatabase();

  // 导入行为分类
  const { PRESET_BEHAVIOR_CATEGORIES, generatePresetBehaviorCategories, generatePresetBehaviorRules, generatePresetTaskCategories, generatePresetTaskTemplates, generatePresetCosmetics } = await import('../constants/presets');
  const presetCats = generatePresetBehaviorCategories(familyId);
  for (const cat of presetCats) {
    await database.runAsync(
      `INSERT OR IGNORE INTO behavior_categories (id, family_id, name, icon, color, sort_order, is_preset, is_hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cat.id, cat.family_id, cat.name, cat.icon, cat.color, cat.sort_order, cat.is_preset, cat.is_hidden]
    );
  }

  // 获取已导入的分类ID映射
  const cats = await database.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM behavior_categories WHERE family_id = ? AND is_preset = 1`,
    [familyId]
  );
  const catMap: Record<string, string> = {};
  for (const c of cats) {
    catMap[c.name] = c.id;
  }

  // 导入行为规则
  const presetRules = generatePresetBehaviorRules(familyId, catMap);
  for (const rule of presetRules) {
    await database.runAsync(
      `INSERT OR IGNORE INTO behavior_rules (id, family_id, category_id, name, points, daily_limit, need_approve, is_preset, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.id, rule.family_id, rule.category_id, rule.name, rule.points, rule.daily_limit, rule.need_approve, rule.is_preset, rule.created_at]
    );
  }

  // 导入任务分类
  const presetTaskCats = generatePresetTaskCategories(familyId);
  for (const cat of presetTaskCats) {
    await database.runAsync(
      `INSERT OR IGNORE INTO task_categories (id, family_id, name, icon, color, sort_order, is_preset, is_hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cat.id, cat.family_id, cat.name, cat.icon, cat.color, cat.sort_order, cat.is_preset, cat.is_hidden]
    );
  }

  // 获取已导入的任务分类ID映射
  const taskCats = await database.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM task_categories WHERE family_id = ? AND is_preset = 1`,
    [familyId]
  );
  const taskCatMap: Record<string, string> = {};
  for (const c of taskCats) {
    taskCatMap[c.name] = c.id;
  }

  // 导入任务模板
  const presetTemplates = generatePresetTaskTemplates(familyId, taskCatMap);
  for (const tpl of presetTemplates) {
    await database.runAsync(
      `INSERT OR IGNORE INTO task_templates (id, family_id, category_id, title, description, default_points, default_confirm_mode, default_repeat, is_preset, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tpl.id, tpl.family_id, tpl.category_id, tpl.title, tpl.description, tpl.default_points, tpl.default_confirm_mode, tpl.default_repeat, tpl.is_preset, tpl.created_at]
    );
  }

  // 导入商城商品
  const presetShopItems = generatePresetCosmetics(familyId);
  for (const item of presetShopItems) {
    await database.runAsync(
      `INSERT OR IGNORE INTO shop_items (id, family_id, name, description, item_type, sub_type, price_type, price, stock, image, rarity, is_preset, parent_approval, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.family_id, item.name, item.description, item.item_type, item.sub_type, item.price_type, item.price, item.stock, item.image, item.rarity, item.is_preset, item.parent_approval, item.created_at]
    );
  }
}

// ============================================================
// 清空本地业务数据（保留表结构）
// ============================================================
export async function wipeAllUserData(): Promise<void> {
  const database = getDatabase();
  // 先关闭外键约束再清理（PRAGMA 不能在事务内修改）
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  await database.execAsync('BEGIN;');
  try {
    // 系统级配置不重置：ai_config, ai_safety_config, app_kv
    const tables = [
      'daily_behavior_records', 'daily_summaries', 'chat_messages',
      'pet_equipments', 'purchases', 'point_records', 'task_completions',
      'streaks', 'tasks', 'task_templates', 'task_categories',
      'behavior_rules', 'behavior_categories', 'evolution_history',
      'pets', 'children', 'shop_items', 'family',
    ];
    for (const t of tables) {
      await database.runAsync(`DELETE FROM ${t}`);
    }
    await database.execAsync('COMMIT;');
  } catch (e) {
    await database.execAsync('ROLLBACK;');
    throw e;
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
}

// ============================================================
// 新建家庭后：默认 AI 与安全配置（便于聊天与设置页读取）
// ============================================================
export async function ensureAIForFamily(familyId: string): Promise<void> {
  const database = getDatabase();
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM ai_config WHERE family_id = ?',
    [familyId]
  );
  if (!existing) {
    await database.runAsync(
      `INSERT INTO ai_config (id, family_id, model_provider, model_name, api_key_encrypted, temperature, max_tokens, created_at)
       VALUES (?, ?, 'qwen', 'qwen-turbo', NULL, 0.7, 200, datetime('now'))`,
      [uuidv4(), familyId]
    );
  }
  const safety = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM ai_safety_config WHERE family_id = ?',
    [familyId]
  );
  if (!safety) {
    await database.runAsync(
      `INSERT INTO ai_safety_config (id, family_id, topic_restriction, filter_level, daily_message_limit, session_duration_limit, allowed_time_slots, blocked_keywords, save_history, enable_voice, updated_at)
       VALUES (?, ?, NULL, 'standard', 50, 15, NULL, NULL, 1, 0, datetime('now'))`,
      [uuidv4(), familyId]
    );
  }
}

const EXPORT_TABLES = [
  'family',
  'children',
  'pets',
  'evolution_history',
  'behavior_categories',
  'behavior_rules',
  'point_records',
  'task_categories',
  'task_templates',
  'tasks',
  'task_completions',
  'streaks',
  'shop_items',
  'purchases',
  'pet_equipments',
  'ai_config',
  'ai_safety_config',
  'chat_messages',
  'daily_summaries',
  'daily_behavior_records',
] as const;

/** 导入时按外键依赖顺序写入 */
const IMPORT_TABLE_ORDER: readonly string[] = [
  'family',
  'behavior_categories',
  'behavior_rules',
  'task_categories',
  'task_templates',
  'shop_items',
  'children',
  'pets',
  'evolution_history',
  'ai_config',
  'ai_safety_config',
  'tasks',
  'task_completions',
  'streaks',
  'point_records',
  'purchases',
  'pet_equipments',
  'chat_messages',
  'daily_summaries',
  'daily_behavior_records',
];

// ============================================================
// 数据库备份导出
// ============================================================
export async function exportDatabase(): Promise<string> {
  const database = getDatabase();
  const tables: Record<string, unknown> = {};

  for (const table of EXPORT_TABLES) {
    tables[table] = await database.getAllAsync(`SELECT * FROM ${table}`);
  }

  return JSON.stringify(
    {
      format: 'petgrowth',
      version: 1,
      encrypted: false,
      exportedAt: new Date().toISOString(),
      tables,
    },
    null,
    2
  );
}

/** AES 加密备份（password 建议 ≥6 位，与设置页一致） */
export async function exportDatabaseEncrypted(password: string): Promise<string> {
  if (password.length < 6) {
    throw new Error('备份密码至少 6 位');
  }
  const plain = await exportDatabase();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const CryptoJS = require('crypto-js');
  const ciphertext = CryptoJS.AES.encrypt(plain, password).toString();
  return JSON.stringify(
    {
      format: 'petgrowth',
      version: 2,
      encrypted: true,
      exportedAt: new Date().toISOString(),
      ciphertext,
    },
    null,
    2
  );
}

// ============================================================
// 数据库导入
// ============================================================
export async function importDatabase(jsonData: string, password?: string): Promise<void> {
  const database = getDatabase();
  let payloadStr = jsonData.trim();
  const outer = JSON.parse(payloadStr) as Record<string, unknown>;

  if (outer.format === 'petgrowth' && outer.encrypted === true && typeof outer.ciphertext === 'string') {
    const pwd = password?.trim();
    if (!pwd) {
      throw new Error('该备份已加密，请输入备份密码');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const CryptoJS = require('crypto-js');
    const plain = CryptoJS.AES.decrypt(outer.ciphertext, pwd).toString(CryptoJS.enc.Utf8);
    if (!plain) {
      throw new Error('密码错误或备份文件已损坏');
    }
    payloadStr = plain;
  }

  const parsed = JSON.parse(payloadStr) as Record<string, unknown>;
  const data =
    parsed.format === 'petgrowth' && parsed.tables && typeof parsed.tables === 'object'
      ? (parsed.tables as Record<string, unknown[]>)
      : (parsed as Record<string, unknown[]>);

  await wipeAllUserData();

  for (const table of IMPORT_TABLE_ORDER) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    for (const row of rows as Record<string, unknown>[]) {
      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const values = Object.values(row);
      const placeholders = columns.map(() => '?').join(', ');
      await database.runAsync(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values as (string | number | null)[]
      );
    }
  }
}
