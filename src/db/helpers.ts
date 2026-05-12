import { getDatabase } from './database';

export async function dbRun(sql: string, params: (string | number | null)[] = []): Promise<void> {
  const db = getDatabase();
  await db.runAsync(sql, params);
}

export async function dbGetOne<T>(sql: string, params: (string | number | null)[] = []): Promise<T | null> {
  const db = getDatabase();
  return (await db.getFirstAsync<T>(sql, params)) ?? null;
}

export async function dbGetAll<T>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
  const db = getDatabase();
  return (await db.getAllAsync<T>(sql, params)) ?? [];
}

export async function dbRunTransaction(operations: (() => Promise<void>)[]): Promise<void> {
  const db = getDatabase();
  await db.execAsync('BEGIN;');
  try {
    for (const op of operations) {
      await op();
    }
    await db.execAsync('COMMIT;');
  } catch (e) {
    await db.execAsync('ROLLBACK;');
    throw e;
  }
}
