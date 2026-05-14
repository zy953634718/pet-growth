import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { ShopItem, Purchase, PetEquipment, CurrencyType, SlotType, RedemptionStatus } from '../types';
import { dbGetAll, dbGetOne, dbRun, dbRunTransaction } from '../db/helpers';
import { getDatabase } from '../db/database';
import { useFamilyStore } from './useFamilyStore';

const COSMETIC_SLOTS: SlotType[] = ['hat', 'clothes', 'accessory', 'background', 'effect'];

function slotFromSubType(sub: string | null): SlotType | null {
  if (!sub) return null;
  return COSMETIC_SLOTS.includes(sub as SlotType) ? (sub as SlotType) : null;
}

// BUG-04 修复：原子扣减货币，余额不足时 changes = 0
async function deductForPurchase(childId: string, priceType: CurrencyType, amount: number, reason: string) {
  if (amount <= 0) return;
  const ts = new Date().toISOString();
  const rid = uuidv4();
  const db = getDatabase();

  if (priceType === 'points') {
    const result = await db.runAsync(
      `UPDATE children SET current_points = current_points - ? WHERE id = ? AND current_points >= ?`,
      [amount, childId, amount]
    );
    if (result.changes === 0) throw new Error('积分不足');
    await dbRun(
      `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
       VALUES (?, ?, NULL, NULL, ?, 'points', ?, 1, ?)`,
      [rid, childId, -amount, reason, ts]
    );
  } else {
    const result = await db.runAsync(
      `UPDATE children SET current_stars = current_stars - ? WHERE id = ? AND current_stars >= ?`,
      [amount, childId, amount]
    );
    if (result.changes === 0) throw new Error('星星不足');
    await dbRun(
      `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
       VALUES (?, ?, NULL, NULL, ?, 'stars', ?, 1, ?)`,
      [rid, childId, -amount, reason, ts]
    );
  }
}

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
  loadOwnedEquipments: (petId: string) => Promise<void>;
}

export const useShopStore = create<ShopState>()((set) => ({
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
      `SELECT pe.*, si.name as item_name, si.image as item_image
       FROM pet_equipments pe
       LEFT JOIN shop_items si ON pe.item_id = si.id
       WHERE pe.pet_id = ?`,
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
    const values: (string | number | null)[] = [];

    const updateFields: (keyof ShopItem)[] = ['name', 'description', 'item_type', 'sub_type',
      'price_type', 'price', 'stock', 'image', 'rarity', 'parent_approval'];

    for (const field of updateFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field] as string | number | null);
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

  // BUG-04 修复：整个购买流程包裹在事务中，库存原子扣减
  purchaseItem: async (childId: string, itemId: string, opts?: { asParent?: boolean }) => {
    const item = await dbGetOne<ShopItem>('SELECT * FROM shop_items WHERE id = ?', [itemId]);
    if (!item) throw new Error('商品不存在');

    if (item.parent_approval === 1 && !opts?.asParent) {
      throw new Error('该商品需由家长在家长端代为兑换');
    }

    let petIdForEquip: string | null = null;
    if (item.item_type === 'cosmetic') {
      const slot = slotFromSubType(item.sub_type);
      if (!slot) throw new Error('装扮类型无效');
      // 查询活跃宠物（排除已保存到图鉴的），与 loadPet 逻辑一致
      const allPets = await dbGetAll<{ id: string }>('SELECT id FROM pets WHERE child_id = ? ORDER BY created_at DESC', [childId]);
      const collectedRows = await dbGetAll<{ pet_id: string }>(
        'SELECT pet_id FROM pet_collection WHERE child_id = ?', [childId]
      );
      const collectedPetIds = new Set(collectedRows.map(r => r.pet_id));
      const activePet = allPets.find(p => !collectedPetIds.has(p.id)) || null;
      if (!activePet) throw new Error('请先完成宠物档案');
      petIdForEquip = activePet.id;
      const owned = await dbGetOne<{ id: string }>(
        'SELECT id FROM pet_equipments WHERE pet_id = ? AND item_id = ?',
        [activePet.id, itemId]
      );
      if (owned) throw new Error('已拥有该装扮');
    }

    const reason = `商城兑换：${item.name}`;
    const isGift = item.item_type === 'gift';
    const now = new Date().toISOString();
    const purchaseId = uuidv4();
    const redeemCode = isGift ? generateRedeemCode() : null;
    const status: RedemptionStatus = isGift ? 'pending' : 'redeemed';
    let newEquipment: PetEquipment | null = null;
    const eqId = uuidv4();

    await dbRunTransaction([
      // 原子货币扣减
      () => deductForPurchase(childId, item.price_type, item.price, reason),
      // 原子库存扣减：库存为 -1 表示无限
      async () => {
        if (item.stock !== -1) {
          const db = getDatabase();
          const result = await db.runAsync(
            'UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock > 0',
            [itemId]
          );
          if (result.changes === 0) throw new Error('该商品已售罄');
        }
      },
      // 写入购买记录
      () => dbRun(
        `INSERT INTO purchases (id, child_id, item_id, redeem_code, status, purchase_time, redeemed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [purchaseId, childId, itemId, redeemCode, status, now, isGift ? null : now]
      ),
      // 装扮类商品写入装备槽并自动穿戴（同槽位旧装备卸下）
      async () => {
        if (item.item_type === 'cosmetic' && petIdForEquip) {
          const slot = slotFromSubType(item.sub_type)!;
          // 卸下同槽位已装备的旧装备
          await dbRun(
            'UPDATE pet_equipments SET equipped = 0 WHERE pet_id = ? AND slot_type = ? AND equipped = 1',
            [petIdForEquip, slot]
          );
          // 新装备直接穿戴
          await dbRun(
            `INSERT INTO pet_equipments (id, pet_id, slot_type, item_id, equipped) VALUES (?, ?, ?, ?, 1)`,
            [eqId, petIdForEquip, slot, itemId]
          );
        }
      },
    ]);

    if (item.item_type === 'cosmetic' && petIdForEquip) {
      newEquipment = await dbGetOne<PetEquipment>(
        `SELECT pe.*, si.name as item_name, si.image as item_image
         FROM pet_equipments pe
         LEFT JOIN shop_items si ON pe.item_id = si.id
         WHERE pe.id = ?`,
        [eqId]
      );
    }

    await useFamilyStore.getState().refreshChildFromDb(childId);

    const purchase: Purchase = {
      id: purchaseId,
      child_id: childId,
      item_id: itemId,
      redeem_code: redeemCode,
      status,
      purchase_time: now,
      redeemed_at: isGift ? null : now,
    };

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
    await dbRun(
      'UPDATE pet_equipments SET equipped = 0 WHERE pet_id = ? AND slot_type = ? AND equipped = 1',
      [petId, slotType]
    );
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
    const params: (string | number | null)[] = [petId];
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

  loadOwnedEquipments: async (petId: string) => {
    const equipments = await dbGetAll<PetEquipment>(
      `SELECT pe.*, si.name as item_name, si.image as item_image
       FROM pet_equipments pe
       LEFT JOIN shop_items si ON pe.item_id = si.id
       WHERE pe.pet_id = ?
       ORDER BY pe.slot_type, pe.equipped DESC`,
      [petId]
    );
    set({ equipments });
  },
}));
