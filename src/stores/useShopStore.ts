import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { ShopItem, Purchase, PetEquipment, CurrencyType, SlotType, RedemptionStatus } from '../types';
import { getDatabase } from '../db/database';
import { useFamilyStore } from './useFamilyStore';

// ============================================================
// DB helpers
// ============================================================
async function dbRun(sql: string, params: any[] = []) {
  const db = await getDatabase();
  await db.runAsync(sql, params);
}

async function dbGetAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDatabase();
  return (await db.getAllAsync<T>(sql, params)) ?? [];
}

async function dbGetOne<T>(sql: string, params: any[] = []): Promise<T | null> {
  const db = await getDatabase();
  return (await db.getFirstAsync<T>(sql, params)) ?? null;
}

const COSMETIC_SLOTS: SlotType[] = ['hat', 'clothes', 'accessory', 'background', 'effect'];

function slotFromSubType(sub: string | null): SlotType | null {
  if (!sub) return null;
  return COSMETIC_SLOTS.includes(sub as SlotType) ? (sub as SlotType) : null;
}

async function deductForPurchase(childId: string, priceType: CurrencyType, amount: number, reason: string) {
  if (amount <= 0) return;
  const ts = new Date().toISOString();
  const rid = uuidv4();
  if (priceType === 'points') {
    const row = await dbGetOne<{ current_points: number }>('SELECT current_points FROM children WHERE id = ?', [childId]);
    if (!row || row.current_points < amount) throw new Error('积分不足');
    await dbRun(`UPDATE children SET current_points = current_points - ? WHERE id = ?`, [amount, childId]);
    await dbRun(
      `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
       VALUES (?, ?, NULL, NULL, ?, 'points', ?, 1, ?)`,
      [rid, childId, -amount, reason, ts]
    );
  } else {
    const row = await dbGetOne<{ current_stars: number }>('SELECT current_stars FROM children WHERE id = ?', [childId]);
    if (!row || row.current_stars < amount) throw new Error('星星不足');
    await dbRun(`UPDATE children SET current_stars = current_stars - ? WHERE id = ?`, [amount, childId]);
    await dbRun(
      `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
       VALUES (?, ?, NULL, NULL, ?, 'stars', ?, 1, ?)`,
      [rid, childId, -amount, reason, ts]
    );
  }
}

// ============================================================
// Generate 6-digit redeem code
// ============================================================
function generateRedeemCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ============================================================
// Store interface
// ============================================================
interface ShopState {
  items: ShopItem[];
  purchases: Purchase[];
  equipments: PetEquipment[];
  isLoading: boolean;

  // Actions
  loadItems: (familyId: string) => Promise<void>;
  loadPurchases: (childId: string) => Promise<void>;
  loadEquipments: (petId: string) => Promise<void>;
  addItem: (item: Omit<ShopItem, 'id' | 'created_at'>) => Promise<ShopItem>;
  updateItem: (itemId: string, updates: Partial<ShopItem>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  purchaseItem: (childId: string, itemId: string, opts?: { asParent?: boolean }) => Promise<Purchase>;
  redeemPurchase: (purchaseId: string) => Promise<void>;
  equipItem: (petId: string, itemId: string, slotType: SlotType) => Promise<void>;
  unequipItem: (equipmentId: string) => Promise<void>;
  getOwnedItems: (petId: string, slotType?: SlotType) => Promise<PetEquipment[]>;
  getEquippedItems: (petId: string) => Promise<PetEquipment[]>;
}

export const useShopStore = create<ShopState>()((set, get) => ({
  items: [],
  purchases: [],
  equipments: [],
  isLoading: false,

  loadItems: async (familyId: string) => {
    set({ isLoading: true });
    const items = await dbGetAll<ShopItem>(
      'SELECT * FROM shop_items WHERE family_id = ? ORDER BY created_at DESC',
      [familyId]
    );
    set({ items, isLoading: false });
  },

  loadPurchases: async (childId: string) => {
    const purchases = await dbGetAll<Purchase>(
      'SELECT * FROM purchases WHERE child_id = ? ORDER BY purchase_time DESC',
      [childId]
    );
    set({ purchases });
  },

  loadEquipments: async (petId: string) => {
    const equipments = await dbGetAll<PetEquipment>(
      'SELECT * FROM pet_equipments WHERE pet_id = ?',
      [petId]
    );
    set({ equipments });
  },

  addItem: async (itemInput) => {
    const id = uuidv4();
    const item: ShopItem = {
      ...itemInput,
      id,
      created_at: new Date().toISOString(),
    };
    await dbRun(
      `INSERT INTO shop_items (id, family_id, name, description, item_type, sub_type,
        price_type, price, stock, image, rarity, is_preset, parent_approval)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.family_id, item.name, item.description, item.item_type, item.sub_type,
        item.price_type, item.price, item.stock, item.image, item.rarity, item.is_preset, item.parent_approval]
    );
    set((state) => ({ items: [item, ...state.items] }));
    return item;
  },

  updateItem: async (itemId: string, updates: Partial<ShopItem>) => {
    const fields: string[] = [];
    const values: any[] = [];

    const updateFields: (keyof ShopItem)[] = ['name', 'description', 'item_type', 'sub_type',
      'price_type', 'price', 'stock', 'image', 'rarity', 'parent_approval'];

    for (const field of updateFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (fields.length > 0) {
      values.push(itemId);
      await dbRun(`UPDATE shop_items SET ${fields.join(', ')} WHERE id = ?`, values);
      set((state) => ({
        items: state.items.map((i) => i.id === itemId ? { ...i, ...updates } : i),
      }));
    }
  },

  deleteItem: async (itemId: string) => {
    await dbRun('DELETE FROM shop_items WHERE id = ?', [itemId]);
    set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
  },

  purchaseItem: async (childId: string, itemId: string, opts?: { asParent?: boolean }) => {
    const item = await dbGetOne<ShopItem>('SELECT * FROM shop_items WHERE id = ?', [itemId]);
    if (!item) throw new Error('商品不存在');

    if (item.parent_approval === 1 && !opts?.asParent) {
      throw new Error('该商品需由家长在家长端代为兑换');
    }

    if (item.stock !== -1 && item.stock <= 0) {
      throw new Error('该商品已售罄');
    }

    let petIdForEquip: string | null = null;
    if (item.item_type === 'cosmetic') {
      const slot = slotFromSubType(item.sub_type);
      if (!slot) throw new Error('装扮类型无效');

      const pet = await dbGetOne<{ id: string }>('SELECT id FROM pets WHERE child_id = ?', [childId]);
      if (!pet) throw new Error('请先完成宠物档案');
      petIdForEquip = pet.id;

      const owned = await dbGetOne<{ id: string }>(
        'SELECT id FROM pet_equipments WHERE pet_id = ? AND item_id = ?',
        [pet.id, itemId]
      );
      if (owned) throw new Error('已拥有该装扮');
    }

    const reason = `商城兑换：${item.name}`;
    await deductForPurchase(childId, item.price_type, item.price, reason);

    const isGift = item.item_type === 'gift';
    const now = new Date().toISOString();
    const purchase: Purchase = {
      id: uuidv4(),
      child_id: childId,
      item_id: itemId,
      redeem_code: isGift ? generateRedeemCode() : null,
      status: (isGift ? 'pending' : 'redeemed') as RedemptionStatus,
      purchase_time: now,
      redeemed_at: isGift ? null : now,
    };

    await dbRun(
      `INSERT INTO purchases (id, child_id, item_id, redeem_code, status, purchase_time, redeemed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        purchase.id,
        purchase.child_id,
        purchase.item_id,
        purchase.redeem_code,
        purchase.status,
        purchase.purchase_time,
        purchase.redeemed_at,
      ]
    );

    if (item.stock !== -1) {
      await dbRun('UPDATE shop_items SET stock = stock - 1 WHERE id = ?', [itemId]);
    }

    let newEquipment: PetEquipment | null = null;
    if (item.item_type === 'cosmetic' && petIdForEquip) {
      const slot = slotFromSubType(item.sub_type)!;
      const eqId = uuidv4();
      await dbRun(
        `INSERT INTO pet_equipments (id, pet_id, slot_type, item_id, equipped)
         VALUES (?, ?, ?, ?, 0)`,
        [eqId, petIdForEquip, slot, itemId]
      );
      newEquipment = await dbGetOne<PetEquipment>('SELECT * FROM pet_equipments WHERE id = ?', [eqId]);
    }

    await useFamilyStore.getState().refreshChildFromDb(childId);

    set((state) => ({
      purchases: [purchase, ...state.purchases],
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, stock: i.stock === -1 ? -1 : Math.max(0, i.stock - 1) } : i
      ),
      equipments: newEquipment ? [...state.equipments, newEquipment] : state.equipments,
    }));

    return purchase;
  },

  redeemPurchase: async (purchaseId: string) => {
    const now = new Date().toISOString();
    await dbRun(
      'UPDATE purchases SET status = ?, redeemed_at = ? WHERE id = ?',
      ['redeemed', now, purchaseId]
    );
    set((state) => ({
      purchases: state.purchases.map((p) =>
        p.id === purchaseId ? { ...p, status: 'redeemed' as RedemptionStatus, redeemed_at: now } : p
      ),
    }));
  },

  equipItem: async (petId: string, itemId: string, slotType: SlotType) => {
    // Unequip current item in the same slot
    await dbRun(
      'UPDATE pet_equipments SET equipped = 0 WHERE pet_id = ? AND slot_type = ? AND equipped = 1',
      [petId, slotType]
    );

    // Equip the new item
    await dbRun(
      'UPDATE pet_equipments SET equipped = 1 WHERE pet_id = ? AND item_id = ?',
      [petId, itemId]
    );

    set((state) => ({
      equipments: state.equipments.map((e) => {
        if (e.pet_id !== petId) return e;
        if (e.slot_type === slotType) {
          return { ...e, equipped: e.item_id === itemId ? 1 : 0 };
        }
        return e;
      }),
    }));
  },

  unequipItem: async (equipmentId: string) => {
    await dbRun('UPDATE pet_equipments SET equipped = 0 WHERE id = ?', [equipmentId]);
    set((state) => ({
      equipments: state.equipments.map((e) =>
        e.id === equipmentId ? { ...e, equipped: 0 } : e
      ),
    }));
  },

  getOwnedItems: async (petId: string, slotType?: SlotType) => {
    let sql = 'SELECT * FROM pet_equipments WHERE pet_id = ?';
    const params: any[] = [petId];
    if (slotType) {
      sql += ' AND slot_type = ?';
      params.push(slotType);
    }
    return dbGetAll<PetEquipment>(sql, params);
  },

  getEquippedItems: async (petId: string) => {
    return dbGetAll<PetEquipment>(
      'SELECT * FROM pet_equipments WHERE pet_id = ? AND equipped = 1',
      [petId]
    );
  },
}));
