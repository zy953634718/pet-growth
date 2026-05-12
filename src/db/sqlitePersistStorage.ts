import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';
import { initDatabase, getDatabase } from './database';

/**
 * Zustand persist 存储：原生端写入 SQLite `app_kv`，与业务数据同一库文件。
 * Web 端仍由 useFamilyStore 使用 localStorage，不经过此模块。
 */
export const sqlitePersistStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    await initDatabase();
    const db = getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_kv WHERE key = ?',
      [name]
    );
    if (row?.value != null) return row.value;

    // 从旧版 AsyncStorage 一次性迁移到 SQLite
    if (name === 'family-storage' && Platform.OS !== 'web') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const legacy = await AsyncStorage.getItem(name);
        if (legacy != null) {
          await db.runAsync(
            `INSERT OR REPLACE INTO app_kv (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
            [name, legacy]
          );
          await AsyncStorage.removeItem(name);
          return legacy;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    await initDatabase();
    const db = getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO app_kv (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      [name, value]
    );
  },

  removeItem: async (name: string): Promise<void> => {
    await initDatabase();
    const db = getDatabase();
    await db.runAsync('DELETE FROM app_kv WHERE key = ?', [name]);
  },
};

/** 清除会话持久化（重置数据 / 校验失败时用；Web 清 localStorage） */
export async function clearFamilySessionPersist(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem('family-storage');
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await sqlitePersistStorage.removeItem('family-storage');
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('family-storage');
  } catch {
    /* ignore */
  }
}
