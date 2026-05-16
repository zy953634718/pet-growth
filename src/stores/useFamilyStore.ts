import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import * as Crypto from 'expo-crypto';
import { Family, Child } from '../types';
import { wipeAllUserData } from '../db/database';
import { dbGetAll, dbGetOne, dbRun } from '../db/helpers';
import { sqlitePersistStorage, clearFamilySessionPersist } from '../db/sqlitePersistStorage';

// ============================================================
// Platform-aware storage: Web 用 localStorage；原生端用 SQLite app_kv
// ============================================================
const webPersistStorage = {
  getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
};

// ============================================================
// Store interface
// ============================================================
interface FamilyState {
  currentFamily: Family | null;
  currentRole: 'parent' | 'child';
  currentChild: Child | null;
  children: Child[];
  isAuthenticated: boolean;
  isSetupComplete: boolean;

  // Actions
  createFamily: (name: string, parentPassword: string) => Promise<Family>;
  loadFamily: (familyId: string) => Promise<void>;
  addChild: (name: string, ageRange: string) => Promise<Child>;
  setRole: (role: 'parent' | 'child') => void;
  selectChild: (childId: string) => void;
  authenticateParent: (password: string) => Promise<boolean>;
  updateChild: (childId: string, updates: Partial<Child>) => Promise<void>;
  loadChildren: (familyId: string) => Promise<void>;
  logout: () => void;
  resetFamily: () => void;
  updateParentPassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  /** 清空 SQLite 中全部业务数据并复位会话（用于重置 / 重新创建家庭前） */
  purgeAllLocalData: () => Promise<void>;
  /** 从数据库刷新单个孩子（积分/星星变更后同步 UI） */
  refreshChildFromDb: (childId: string) => Promise<void>;
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      currentFamily: null,
      currentRole: 'child',
      currentChild: null,
      children: [],
      isAuthenticated: false,
      isSetupComplete: false,

      createFamily: async (name: string, parentPassword: string) => {
        const id = uuidv4();
        const salt = uuidv4().slice(0, 8);
        const hashedPassword = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          parentPassword + salt
        );
        const pinLength = parentPassword.length;
        const family: Family = {
          id,
          name,
          parent_password: `${salt}:${hashedPassword}`,
          parent_pin_length: pinLength,
          created_at: new Date().toISOString(),
        };
        await dbRun(
          'INSERT INTO family (id, name, parent_password, parent_pin_length) VALUES (?, ?, ?, ?)',
          [family.id, family.name, family.parent_password, family.parent_pin_length]
        );
        set({
          currentFamily: family,
          isSetupComplete: true,
          isAuthenticated: false,
          currentRole: 'child',
        });
        return family;
      },

      loadFamily: async (familyId: string) => {
        const family = await dbGetOne<Family>('SELECT * FROM family WHERE id = ?', [familyId]);
        if (family) {
          set({ currentFamily: family, isSetupComplete: true });
          await get().loadChildren(familyId);
        }
      },

      addChild: async (name: string, ageRange: string) => {
        const { currentFamily } = get();
        if (!currentFamily) throw new Error('No family selected');

        const id = uuidv4();
        const child: Child = {
          id,
          family_id: currentFamily.id,
          name,
          age_range: ageRange || '6-8',
          avatar: null,
          total_points: 0,
          current_points: 0,
          total_stars: 0,
          current_stars: 0,
          created_at: new Date().toISOString(),
        };

        await dbRun(
          `INSERT INTO children (id, family_id, name, age_range)
           VALUES (?, ?, ?, ?)`,
          [child.id, child.family_id, child.name, child.age_range]
        );

        set((state) => ({
          children: [...state.children, child],
        }));
        return child;
      },

      setRole: (role) => {
        set({ currentRole: role, isAuthenticated: role === 'child' });
      },

      selectChild: (childId: string) => {
        const { children } = get();
        const child = children.find((c) => c.id === childId) || null;
        set({ currentChild: child });
      },

      authenticateParent: async (password: string) => {
        const { currentFamily } = get();
        if (!currentFamily) {
          // 尝试从 DB 重新获取（persist 已过滤 password 字段）
          const family = await dbGetOne<Family>('SELECT id FROM family LIMIT 1');
          if (!family) return false;
          await get().loadFamily(family.id);
          const updated = get().currentFamily;
          if (!updated) return false;
          return get().authenticateParent(password);
        }

        // 从 DB 获取最新密码记录（内存中的 password 可能被 persist partialize 清空）
        const family = await dbGetOne<Family>('SELECT * FROM family WHERE id = ?', [currentFamily.id]);
        if (!family) return false;

        const stored = family.parent_password;
        const isHashed = stored.includes(':');

        if (isHashed) {
          const [salt, hash] = stored.split(':');
          const inputHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            password + salt
          );
          if (inputHash === hash) {
            set({ isAuthenticated: true, currentRole: 'parent' });
            return true;
          }
        } else {
          // 兼容旧版明文密码 → 自动迁移为哈希
          if (stored === password) {
            const salt = uuidv4().slice(0, 8);
            const hashedPassword = await Crypto.digestStringAsync(
              Crypto.CryptoDigestAlgorithm.SHA256,
              password + salt
            );
            const pinLen = stored.length;
            await dbRun(
              'UPDATE family SET parent_password = ?, parent_pin_length = ? WHERE id = ?',
              [`${salt}:${hashedPassword}`, pinLen, family.id]
            );
            set({ isAuthenticated: true, currentRole: 'parent' });
            return true;
          }
        }
        return false;
      },

      updateChild: async (childId: string, updates: Partial<Child>) => {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
        if (updates.age_range !== undefined) { fields.push('age_range = ?'); values.push(updates.age_range); }
        if (updates.avatar !== undefined) { fields.push('avatar = ?'); values.push(updates.avatar); }
        if (updates.total_points !== undefined) { fields.push('total_points = ?'); values.push(updates.total_points); }
        if (updates.current_points !== undefined) { fields.push('current_points = ?'); values.push(updates.current_points); }
        if (updates.total_stars !== undefined) { fields.push('total_stars = ?'); values.push(updates.total_stars); }
        if (updates.current_stars !== undefined) { fields.push('current_stars = ?'); values.push(updates.current_stars); }

        if (fields.length > 0) {
          values.push(childId);
          await dbRun(`UPDATE children SET ${fields.join(', ')} WHERE id = ?`, values);
        }

        set((state) => ({
          children: state.children.map((c) =>
            c.id === childId ? { ...c, ...updates } : c
          ),
          currentChild:
            state.currentChild?.id === childId
              ? { ...state.currentChild, ...updates }
              : state.currentChild,
        }));
      },

      loadChildren: async (familyId: string) => {
        const children = await dbGetAll<Child>('SELECT * FROM children WHERE family_id = ?', [familyId]);
        set({ children });
      },

      logout: () => {
        set({
          currentRole: 'child',
          isAuthenticated: false,
        });
      },

      resetFamily: () => {
        set({
          currentFamily: null,
          currentChild: null,
          children: [],
          currentRole: 'child',
          isAuthenticated: false,
          isSetupComplete: false,
        });
      },

      updateParentPassword: async (oldPassword: string, newPassword: string) => {
        const { currentFamily } = get();
        if (!currentFamily) return false;
        if (newPassword.length < 4) return false;

        // 从 DB 获取最新密码记录
        const family = await dbGetOne<Family>('SELECT * FROM family WHERE id = ?', [currentFamily.id]);
        if (!family) return false;

        // 验证旧密码（兼容新旧格式）
        const stored = family.parent_password;
        const isHashed = stored.includes(':');
        let valid = false;
        if (isHashed) {
          const [salt, hash] = stored.split(':');
          const inputHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            oldPassword + salt
          );
          valid = inputHash === hash;
        } else {
          valid = stored === oldPassword;
        }
        if (!valid) return false;

        // 哈希新密码
        const newSalt = uuidv4().slice(0, 8);
        const newHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          newPassword + newSalt
        );
        const hashedNew = `${newSalt}:${newHash}`;

        await dbRun(
          'UPDATE family SET parent_password = ?, parent_pin_length = ? WHERE id = ?',
          [hashedNew, newPassword.length, family.id]
        );
        set({
          currentFamily: { ...currentFamily, parent_password: hashedNew, parent_pin_length: newPassword.length },
        });
        return true;
      },

      purgeAllLocalData: async () => {
        await wipeAllUserData();
        get().resetFamily();
        await clearFamilySessionPersist();
      },

      refreshChildFromDb: async (childId: string) => {
        const row = await dbGetOne<Child>('SELECT * FROM children WHERE id = ?', [childId]);
        if (!row) return;
        set((state) => ({
          children: state.children.some((c) => c.id === childId)
            ? state.children.map((c) => (c.id === childId ? row : c))
            : [...state.children, row],
          currentChild:
            state.currentChild?.id === childId ? row : state.currentChild,
        }));
      },
    }),
    {
      name: 'family-storage',
      storage: createJSONStorage(() =>
        Platform.OS === 'web' ? webPersistStorage : sqlitePersistStorage
      ),
      partialize: (state) => ({
        currentFamily: state.currentFamily
          ? { ...state.currentFamily, parent_password: '' }  // BUG-11 修复：不持久化明文密码
          : null,
        currentRole: state.currentRole,
        currentChild: state.currentChild,
        isAuthenticated: state.isAuthenticated,
        isSetupComplete: state.isSetupComplete,
      }),
    }
  )
);
