/**
 * Web 端数据库降级层 —— 用 localStorage 模拟 expo-sqlite API
 * 仅在 Web 端使用，原生端使用 src/db/database.ts（通过 platform extension）
 *
 * 提供与 database.ts 相同的导出接口，使所有 store 在 Web 端可正常运行。
 */

// ============================================================
// 类型兼容层
// ============================================================
export interface WebSQLiteDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: (string | number | null)[]): Promise<void>;
  getAllAsync<T = Record<string, unknown>>(sql: string, params?: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T = Record<string, unknown>>(sql: string, params?: (string | number | null)[]): Promise<T | null>;
  closeAsync(): Promise<void>;
}

// ============================================================
// localStorage 持久化 helpers
// ============================================================
const STORAGE_PREFIX = 'petgrowth_db_';

function getTableKey(table: string): string {
  return `${STORAGE_PREFIX}${table}`;
}

function loadTable<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(getTableKey(table));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTable<T>(table: string, data: T[]): void {
  localStorage.setItem(getTableKey(table), JSON.stringify(data));
}

// 生成简易 UUID（Web 端替代 uuid 库）
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// ============================================================
// 简易 SQL 解析器（仅支持本项目用到的语法子集）
// ============================================================

// CREATE TABLE IF NOT EXISTS <name> (...columns)
const CREATE_RE = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]+)\)/i;

// SELECT * FROM <table> [WHERE col = ?] [ORDER BY col ASC/DESC]
const SELECT_RE = /SELECT\s+\*\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+)\s+(ASC|DESC))?$/i;

// INSERT INTO <table> (cols) VALUES (placeholders)
const INSERT_RE = /INSERT\s+INTO\s+(\w+)\s*\(([\w,\s]+)\)\s*VALUES\s*\(([?,:\s]+)\)/i;

// UPDATE <table> SET col=?,... WHERE col=?
const UPDATE_RE = /UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i;

// DELETE FROM <table> WHERE col=?
const DELETE_RE = /DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i;

// 评估简单 WHERE 表达式（仅支持 AND 连接的等值/比较条件）
function evalWhere(row: Record<string, unknown>, whereSql: string, params: (string | number | null)[]): boolean {
  // 简化：仅处理 `col = ?` 和 `col > ?` / `col < ?`，多个条件用 AND 连接
  const clauses = whereSql.split(/\s+AND\s+/i);
  let paramIdx = 0;

  for (const clause of clauses) {
    const colMatch = clause.match(/(\w+)\s*(=|>|<|>=|<=)\s*\?/);
    if (!colMatch) continue;
    const [, col, op] = colMatch;
    const val = params[paramIdx++];
    const rowVal = row[col];

    let cmp: number;
    if (typeof rowVal === 'number' && typeof val === 'number') {
      cmp = rowVal - val;
    } else {
      cmp = String(rowVal ?? '').localeCompare(String(val ?? ''));
    }

    switch (op) {
      case '=': if (rowVal !== val) return false; break;
      case '>': if (cmp <= 0) return false; break;
      case '<': if (cmp >= 0) return false; break;
      case '>=': if (cmp < 0) return false; break;
      case '<=': if (cmp > 0) return false; break;
    }
  }
  return true;
}

// ============================================================
// 数据库实例
// ============================================================
let db: WebSQLiteDatabase | null = null;

export async function initDatabase(): Promise<WebSQLiteDatabase> {
  if (db) return db;

  // 初始化时确保表存在（从 localStorage 加载，不存在则创建空数组）
  const tables = ['family', 'children', 'pets', 'tasks', 'behavior_rules', 'shop_items', 'shop_purchases', 'ai_conversations', 'redeem_codes'];
  for (const t of tables) {
    if (localStorage.getItem(getTableKey(t)) === null) {
      saveTable(t, []);
    }
  }

  db = createWebDb();
  return db;
}

export function getDatabase(): WebSQLiteDatabase {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function createWebDb(): WebSQLiteDatabase {
  return {
    async execAsync(sql: string): Promise<void> {
      // 处理 CREATE TABLE 语句
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        if (/PRAGMA/i.test(stmt)) continue; // 忽略 PRAGMA
        const createMatch = stmt.match(CREATE_RE);
        if (createMatch) {
          const tableName = createMatch[1];
          if (localStorage.getItem(getTableKey(tableName)) === null) {
            saveTable(tableName, []);
          }
        }
      }
    },

    async runAsync(sql: string, params: (string | number | null)[] = []): Promise<void> {
      // INSERT
      const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([\w,\s]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (insertMatch) {
        const [, table, colStr] = insertMatch;
        const columns = colStr.split(',').map(c => c.trim());
        const rows = loadTable<Record<string, unknown>>(table);

        const newRow: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          newRow[col] = params[i] ?? null;
        });

        // 如果 id 为空（UUID 生成由调用方负责），自动生成
        if (newRow.id === null || newRow.id === '') {
          newRow.id = generateId();
        }

        rows.push(newRow);
        saveTable(table, rows);
        return;
      }

      // UPDATE
      const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
      if (updateMatch) {
        const [, table, setClause, whereClause] = updateMatch;
        const rows = loadTable<Record<string, unknown>>(table);

        // 解析 SET 子句 (col = ?)
        const setPairs = setClause.split(',').map(s => s.trim());
        const setValues: Record<string, (string | number | null)> = {};
        let paramIdx = 0;
        for (const pair of setPairs) {
          const [col] = pair.split('=').map(s => s.trim());
          setValues[col] = params[paramIdx++];
        }

        const updated = rows.map(row => {
          if (evalWhere(row, whereClause, params.slice(paramIdx))) {
            return { ...row, ...setValues };
          }
          return row;
        });
        saveTable(table, updated);
        return;
      }

      // DELETE
      const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);
      if (deleteMatch) {
        const [, table, whereClause] = deleteMatch;
        const rows = loadTable<Record<string, unknown>>(table);
        const filtered = rows.filter(row => !evalWhere(row, whereClause, params));
        saveTable(table, filtered);
        return;
      }
    },

    async getAllAsync<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
      const selectMatch = sql.match(SELECT_RE);
      if (!selectMatch) return [];
      const [, table, whereClause, orderCol, orderDir] = selectMatch;
      let rows = loadTable<T>(table);

      if (whereClause) {
        rows = rows.filter(row => evalWhere(row as unknown as Record<string, unknown>, whereClause, params));
      }

      if (orderCol) {
        rows.sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[orderCol];
          const bv = (b as unknown as Record<string, unknown>)[orderCol];
          if (av === undefined || bv === undefined) return 0;
          if (typeof av === 'number' && typeof bv === 'number') {
            return orderDir?.toUpperCase() === 'DESC' ? bv - av : av - bv;
          }
          return orderDir?.toUpperCase() === 'DESC'
            ? String(bv).localeCompare(String(av))
            : String(av).localeCompare(String(bv));
        });
      }

      return rows;
    },

    async getFirstAsync<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): Promise<T | null> {
      const results = await this.getAllAsync<T>(sql, params);
      return results.length > 0 ? results[0] : null;
    },

    async closeAsync(): Promise<void> {
      db = null;
    },
  };
}

// ============================================================
// 重新导出与 database.ts 相同的接口（供 store 使用）
// ============================================================

// 导出表数据（用于备份）
const EXPORT_TABLES = ['family', 'children', 'pets', 'tasks', 'behavior_rules', 'shop_items', 'shop_purchases', 'ai_conversations', 'redeem_codes'];

export async function exportDatabase(): Promise<string> {
  const tables: Record<string, unknown> = {};
  for (const table of EXPORT_TABLES) {
    tables[table] = loadTable(table);
  }
  return JSON.stringify({
    format: 'petgrowth',
    version: 1,
    encrypted: false,
    exportedAt: new Date().toISOString(),
    tables,
  }, null, 2);
}

export async function exportDatabaseEncrypted(_password: string): Promise<string> {
  // Web 端不支持加密备份，直接返回明文
  return exportDatabase();
}

export async function importDatabase(jsonData: string): Promise<void> {
  const parsed = JSON.parse(jsonData) as Record<string, unknown>;
  const data = (parsed.format === 'petgrowth' && parsed.tables && typeof parsed.tables === 'object')
    ? (parsed.tables as Record<string, unknown[]>)
    : (parsed as Record<string, unknown[]>);

  for (const table of EXPORT_TABLES) {
    const rows = data[table];
    if (Array.isArray(rows)) {
      saveTable(table, rows);
    }
  }
}

export async function wipeAllUserData(): Promise<void> {
  for (const table of EXPORT_TABLES) {
    saveTable(table, []);
  }
}

export async function resetDatabase(): Promise<void> {
  for (const table of EXPORT_TABLES) {
    localStorage.removeItem(getTableKey(table));
  }
  db = null;
}

// ============================================================
// 预设数据导入（Web 端实现）
// ============================================================
export async function importPresets(familyId: string): Promise<void> {
  try {
    const mod = await import('../constants/presets');
    const {
      generatePresetBehaviorCategories,
      generatePresetBehaviorRules,
      generatePresetTaskCategories,
      generatePresetTaskTemplates,
      generatePresetCosmetics,
    } = mod;

    // 行为分类
    const behaviorCats = generatePresetBehaviorCategories(familyId);
    saveTable('behavior_categories', behaviorCats);

    // 行为规则（需要分类 ID 映射）
    const catsLoaded = loadTable<Record<string, unknown>>('behavior_categories');
    const catMap: Record<string, string> = {};
    for (const c of catsLoaded) {
      if (c.family_id === familyId && c.is_preset) {
        catMap[(c as unknown as { name: string }).name] = c.id as string;
      }
    }
    const rules = generatePresetBehaviorRules(familyId, catMap);
    saveTable('behavior_rules', rules);

    // 任务分类
    const taskCats = generatePresetTaskCategories(familyId);
    saveTable('task_categories', taskCats);

    // 任务模板（需要任务分类 ID 映射）
    const tCatsLoaded = loadTable<Record<string, unknown>>('task_categories');
    const taskCatMap: Record<string, string> = {};
    for (const c of tCatsLoaded) {
      if (c.family_id === familyId && c.is_preset) {
        taskCatMap[(c as unknown as { name: string }).name] = c.id as string;
      }
    }
    const templates = generatePresetTaskTemplates(familyId, taskCatMap);
    saveTable('task_templates', templates);

    // 商城商品
    const shopItems = generatePresetCosmetics(familyId);
    saveTable('shop_items', shopItems);
  } catch (e) {
    console.warn('importPresets web stub:', e);
  }
}

// ============================================================
// 为家庭创建默认 AI 与安全配置（Web 端实现）
// ============================================================
export async function ensureAIForFamily(familyId: string): Promise<void> {
  // AI 配置
  const aiConfigs = loadTable<Record<string, unknown>>('ai_config');
  if (!aiConfigs.find(c => c.family_id === familyId)) {
    aiConfigs.push({
      id: generateId(),
      family_id: familyId,
      model_provider: 'qwen',
      model_name: 'qwen-turbo',
      api_key_encrypted: null,
      temperature: 0.7,
      max_tokens: 200,
      created_at: new Date().toISOString(),
    });
    saveTable('ai_config', aiConfigs);
  }

  // 安全配置
  const safety = loadTable<Record<string, unknown>>('ai_safety_config');
  if (!safety.find(s => s.family_id === familyId)) {
    safety.push({
      id: generateId(),
      family_id: familyId,
      topic_restriction: null,
      filter_level: 'standard',
      daily_message_limit: 50,
      session_duration_limit: 15,
      allowed_time_slots: null,
      blocked_keywords: null,
      save_history: 1,
      enable_voice: 0,
      updated_at: new Date().toISOString(),
    });
    saveTable('ai_safety_config', safety);
  }
}

// 默认导出兼容
export default { initDatabase, getDatabase };
