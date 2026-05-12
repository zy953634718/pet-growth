import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { getPointsToNextLevel, getStageForLevel, getStageInfo } from '../constants/evolution';
import { dbGetAll, dbGetOne, dbRun, dbRunTransaction } from '../db/helpers';
import { EvolutionHistory, HealthType, MoodType, Pet, PetEvolutionStage } from '../types';
import { useFamilyStore } from './useFamilyStore';

/** 照料消耗（与设计文档一致） */
const FEED_COST_POINTS = 2;
const BATHE_COST_POINTS = 1;
const PLAY_COST_POINTS = 1;   // BUG-08 修复：玩耍扣 1 积分
const HEAL_COST_STARS = 3;
const RETURN_HOME_POINTS = 100;

// ============================================================
// 统一心情阈值（BUG-09 修复）
// ============================================================
function calcMoodType(value: number): MoodType {
  if (value >= 90) return 'excited';
  if (value >= 70) return 'happy';
  if (value >= 50) return 'normal';
  if (value >= 30) return 'unhappy';
  return 'sad';
}

async function spendPointsForCare(childId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  // BUG-04 模式：原子扣减，余额不足时 rows affected = 0
  const db = (await import('../db/database')).getDatabase();
  const result = await db.runAsync(
    `UPDATE children SET current_points = current_points - ? WHERE id = ? AND current_points >= ?`,
    [amount, childId, amount]
  );
  if (result.changes === 0) throw new Error('积分不足');
  const ts = new Date().toISOString();
  await dbRun(
    `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
     VALUES (?, ?, NULL, NULL, ?, 'points', ?, 1, ?)`,
    [uuidv4(), childId, -amount, reason, ts]
  );
  await useFamilyStore.getState().refreshChildFromDb(childId);
}

async function spendStarsForCare(childId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  const db = (await import('../db/database')).getDatabase();
  const result = await db.runAsync(
    `UPDATE children SET current_stars = current_stars - ? WHERE id = ? AND current_stars >= ?`,
    [amount, childId, amount]
  );
  if (result.changes === 0) throw new Error('星星不足');
  const ts = new Date().toISOString();
  await dbRun(
    `INSERT INTO point_records (id, child_id, rule_id, task_id, points_change, currency_type, reason, approved, created_at)
     VALUES (?, ?, NULL, NULL, ?, 'stars', ?, 1, ?)`,
    [uuidv4(), childId, -amount, reason, ts]
  );
  await useFamilyStore.getState().refreshChildFromDb(childId);
}

function diffHours(from: string, to?: string): number {
  const fromTime = new Date(from).getTime();
  const toTime = (to ? new Date(to) : new Date()).getTime();
  return (toTime - fromTime) / (1000 * 60 * 60);
}

// ============================================================
// Pet store interface
// ============================================================
interface PetState {
  pet: Pet | null;
  evolutionHistory: PetEvolutionStage[];
  isLoading: boolean;
  justEvolved: boolean;
  evolvedToStage: number;

  loadPet: (childId: string) => Promise<void>;
  createPet: (childId: string, speciesId: string, name: string) => Promise<Pet>;
  renamePet: (petId: string, name: string) => Promise<void>;
  feedPet: () => Promise<void>;
  bathePet: () => Promise<void>;
  playWithPet: () => Promise<void>;
  restPet: () => Promise<void>;
  healPet: () => Promise<void>;
  petPet: () => Promise<void>;
  calculateDecay: () => Promise<void>;
  addPoints: (amount: number) => Promise<{ leveled: boolean; evolved: boolean; newLevel: number; newStage: number }>;
  checkEvolution: () => Promise<{ evolved: boolean; oldStage: number; newStage: number }>;
  triggerRunaway: () => Promise<void>;
  returnFromRunaway: (usePoints: boolean) => Promise<boolean>;
  clearEvolvedFlag: () => void;
  addPointsForChild: (childId: string, amount: number) => Promise<void>;
}

export const usePetStore = create<PetState>()((set, get) => ({
  pet: null,
  evolutionHistory: [],
  isLoading: false,
  justEvolved: false,
  evolvedToStage: 0,

  loadPet: async (childId: string) => {
    set({ isLoading: true });
    const pet = await dbGetOne<Pet>('SELECT * FROM pets WHERE child_id = ?', [childId]);
    if (pet) {
      const history = await dbGetAll<EvolutionHistory>(
        'SELECT * FROM evolution_history WHERE pet_id = ? ORDER BY stage',
        [pet.id]
      );
      const evolutionHistory: PetEvolutionStage[] = history.map((h) => ({
        ...getStageInfo(h.stage),
        stage: h.stage,
      }));
      set({ pet, evolutionHistory, isLoading: false });
    } else {
      set({ pet: null, evolutionHistory: [], isLoading: false });
    }
  },

  // BUG-03 修复：INSERT 显式写入所有非 NULL 字段，不依赖 DB DEFAULT
  createPet: async (childId: string, speciesId: string, name: string) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const pet: Pet = {
      id,
      child_id: childId,
      species_id: speciesId,
      name,
      level: 1,
      current_points: 0,
      points_to_next_level: getPointsToNextLevel(1),
      current_stage: 1,
      mood_type: 'normal' as MoodType,
      mood_value: 80,
      health_type: 'healthy' as HealthType,
      hunger_value: 80,
      clean_value: 80,
      last_fed_at: now,
      last_bathed_at: now,
      last_played_at: now,
      last_rested_at: null,
      sick_since: null,
      consecutive_neglect_days: 0,
      ran_away_at: null,
      created_at: now,
    };

    await dbRun(
      `INSERT INTO pets (
        id, child_id, species_id, name,
        level, current_points, points_to_next_level, current_stage,
        mood_type, mood_value, health_type,
        hunger_value, clean_value,
        last_fed_at, last_bathed_at, last_played_at,
        last_rested_at, sick_since, consecutive_neglect_days, ran_away_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pet.id, pet.child_id, pet.species_id, pet.name,
        pet.level, pet.current_points, pet.points_to_next_level, pet.current_stage,
        pet.mood_type, pet.mood_value, pet.health_type,
        pet.hunger_value, pet.clean_value,
        pet.last_fed_at, pet.last_bathed_at, pet.last_played_at,
        pet.last_rested_at, pet.sick_since, pet.consecutive_neglect_days, pet.ran_away_at,
        pet.created_at,
      ]
    );

    set({ pet });
    return pet;
  },

  renamePet: async (petId: string, name: string) => {
    await dbRun('UPDATE pets SET name = ? WHERE id = ?', [name, petId]);
    set((state) => ({
      pet: state.pet ? { ...state.pet, name } : null,
    }));
  },

  feedPet: async () => {
    const { pet } = get();
    if (!pet || pet.ran_away_at) return;
    const now = new Date().toISOString();
    await dbRunTransaction([
      () => spendPointsForCare(pet.child_id, FEED_COST_POINTS, '宠物喂食'),
      () => dbRun(
        `UPDATE pets SET hunger_value = MIN(100, hunger_value + 40),
          health_type = CASE WHEN health_type = 'sick' THEN 'healthy' ELSE health_type END,
          sick_since = CASE WHEN health_type = 'sick' THEN NULL ELSE sick_since END,
          last_fed_at = ?, consecutive_neglect_days = 0 WHERE id = ?`,
        [now, pet.id]
      ),
    ]);
    set((state) => ({
      pet: state.pet ? {
        ...state.pet,
        hunger_value: Math.min(100, state.pet.hunger_value + 40),
        health_type: state.pet.health_type === 'sick' ? 'healthy' : state.pet.health_type,
        sick_since: state.pet.health_type === 'sick' ? null : state.pet.sick_since,
        last_fed_at: now,
        consecutive_neglect_days: 0,
      } : null,
    }));
  },

  bathePet: async () => {
    const { pet } = get();
    if (!pet || pet.ran_away_at) return;
    const now = new Date().toISOString();
    await dbRunTransaction([
      () => spendPointsForCare(pet.child_id, BATHE_COST_POINTS, '宠物洗澡'),
      () => dbRun(
        `UPDATE pets SET clean_value = MIN(100, clean_value + 35),
          mood_value = MIN(100, mood_value + 5),
          last_bathed_at = ?, consecutive_neglect_days = 0 WHERE id = ?`,
        [now, pet.id]
      ),
    ]);
    const newMoodValue = Math.min(100, pet.mood_value + 5);
    set((state) => ({
      pet: state.pet ? {
        ...state.pet,
        clean_value: Math.min(100, state.pet.clean_value + 35),
        mood_value: newMoodValue,
        mood_type: calcMoodType(newMoodValue),
        last_bathed_at: now,
        consecutive_neglect_days: 0,
      } : null,
    }));
  },

  // BUG-08 修复：玩耍扣 1 积分；BUG-09 修复：使用统一心情阈值
  playWithPet: async () => {
    const { pet } = get();
    if (!pet || pet.ran_away_at) return;
    const now = new Date().toISOString();
    const newMoodValue = Math.min(100, pet.mood_value + 20);
    const newMoodType = calcMoodType(newMoodValue);

    // BUG-06 修复：玩耍不清除 sick 状态；过度玩耍在 healthy 状态下才设为 tired
    const hoursSinceLastRest = diffHours(pet.last_rested_at || pet.created_at);
    let newHealthType = pet.health_type as HealthType;
    if (pet.health_type === 'healthy' && hoursSinceLastRest > 4) {
      newHealthType = 'tired';
    }

    await dbRunTransaction([
      () => spendPointsForCare(pet.child_id, PLAY_COST_POINTS, '宠物玩耍'),
      () => dbRun(
        `UPDATE pets SET mood_value = ?, mood_type = ?, health_type = ?,
          last_played_at = ?, consecutive_neglect_days = 0 WHERE id = ?`,
        [newMoodValue, newMoodType, newHealthType, now, pet.id]
      ),
    ]);

    set((state) => ({
      pet: state.pet ? {
        ...state.pet,
        mood_value: newMoodValue,
        mood_type: newMoodType,
        health_type: newHealthType,
        last_played_at: now,
        consecutive_neglect_days: 0,
      } : null,
    }));
  },

  restPet: async () => {
    const { pet } = get();
    if (!pet || pet.ran_away_at) return;
    const now = new Date().toISOString();
    // BUG-06 修复：休息只恢复 tired，不覆盖 sick 状态
    const newHealthType: HealthType = pet.health_type === 'tired' ? 'healthy' : pet.health_type;
    const newMoodValue = Math.min(100, pet.mood_value + 10);
    const newMoodType = calcMoodType(newMoodValue);

    await dbRun(
      `UPDATE pets SET
        health_type = CASE WHEN health_type = 'tired' THEN 'healthy' ELSE health_type END,
        mood_value = MIN(100, mood_value + 10),
        mood_type = ?,
        last_rested_at = ?, consecutive_neglect_days = 0 WHERE id = ?`,
      [newMoodType, now, pet.id]
    );
    set((state) => ({
      pet: state.pet ? {
        ...state.pet,
        health_type: newHealthType,
        mood_value: newMoodValue,
        mood_type: newMoodType,
        last_rested_at: now,
        consecutive_neglect_days: 0,
      } : null,
    }));
  },

  healPet: async () => {
    const { pet } = get();
    if (!pet || pet.ran_away_at) throw new Error('当前无法治疗');
    if (pet.health_type !== 'sick') throw new Error('宠物未生病，无需治疗');
    const now = new Date().toISOString();
    await dbRunTransaction([
      () => spendStarsForCare(pet.child_id, HEAL_COST_STARS, '宠物治疗'),
      () => dbRun(
        `UPDATE pets SET health_type = 'healthy', sick_since = NULL,
          mood_type = 'normal', mood_value = 60,
          hunger_value = 80, clean_value = 80,
          last_fed_at = ?, last_bathed_at = ?, last_rested_at = ?
          WHERE id = ?`,
        [now, now, now, pet.id]
      ),
    ]);
    set((state) => ({
      pet: state.pet ? {
        ...state.pet,
        health_type: 'healthy',
        sick_since: null,
        mood_type: 'normal',
        mood_value: 60,
        hunger_value: 80,
        clean_value: 80,
        last_fed_at: now,
        last_bathed_at: now,
        last_rested_at: now,
      } : null,
    }));
  },

  petPet: async () => {
    const { pet } = get();
    if (!pet || pet.ran_away_at) return;
    const newMoodValue = Math.min(100, pet.mood_value + 5);
    const newMoodType = calcMoodType(newMoodValue);
    await dbRun(
      'UPDATE pets SET mood_value = ?, mood_type = ? WHERE id = ?',
      [newMoodValue, newMoodType, pet.id]
    );
    set((state) => ({
      pet: state.pet ? { ...state.pet, mood_value: newMoodValue, mood_type: newMoodType } : null,
    }));
  },

  // BUG-06 修复：状态机不降级；sick 优先于 tired 优先于 hungry
  calculateDecay: async () => {
    const { pet } = get();
    if (!pet || pet.ran_away_at) return;

    const hoursSinceFed = diffHours(pet.last_fed_at);
    const hoursSinceBath = diffHours(pet.last_bathed_at);
    const hoursSincePlay = diffHours(pet.last_played_at);
    const hoursSinceInteraction = Math.min(hoursSinceFed, hoursSincePlay, hoursSinceBath);

    // 只升级状态严重程度，不降级
    let newHealthType: HealthType = pet.health_type;
    if (hoursSinceFed >= 30 && newHealthType !== 'sick') {
      newHealthType = 'sick';
    } else if (hoursSinceFed >= 18 && newHealthType === 'healthy') {
      newHealthType = 'tired';
    } else if (hoursSinceFed >= 12 && newHealthType === 'healthy') {
      newHealthType = 'hungry';
    }

    const newHungerValue = Math.max(0, 100 - hoursSinceFed * 3);
    const newCleanValue = Math.max(0, 100 - hoursSinceBath * 2);

    let newMoodValue = pet.mood_value;
    if (hoursSinceInteraction >= 24) {
      newMoodValue = Math.max(0, pet.mood_value - hoursSinceInteraction * 2);
    } else if (hoursSinceInteraction >= 12) {
      newMoodValue = Math.max(20, pet.mood_value - hoursSinceInteraction * 3);
    } else if (hoursSinceInteraction >= 6) {
      newMoodValue = Math.max(40, pet.mood_value - hoursSinceInteraction * 2);
    }
    const newMoodType = calcMoodType(Math.round(newMoodValue));

    let newNeglectDays = pet.consecutive_neglect_days;
    if (hoursSinceFed >= 24 && hoursSincePlay >= 24) {
      newNeglectDays += 1;
    } else {
      newNeglectDays = 0;
    }

    const newSickSince = newHealthType === 'sick' && pet.health_type !== 'sick'
      ? new Date().toISOString()
      : pet.sick_since;

    let newRanAwayAt = pet.ran_away_at;
    if (newNeglectDays >= 7 && !pet.ran_away_at) {
      newRanAwayAt = new Date().toISOString();
    }

    await dbRun(
      `UPDATE pets SET
        hunger_value = ?, clean_value = ?,
        mood_type = ?, mood_value = ?,
        health_type = ?, sick_since = ?,
        consecutive_neglect_days = ?, ran_away_at = ?
        WHERE id = ?`,
      [
        Math.round(newHungerValue), Math.round(newCleanValue),
        newMoodType, Math.round(newMoodValue),
        newHealthType, newSickSince,
        newNeglectDays, newRanAwayAt,
        pet.id,
      ]
    );

    set((state) => ({
      pet: state.pet ? {
        ...state.pet,
        hunger_value: Math.round(newHungerValue),
        clean_value: Math.round(newCleanValue),
        mood_type: newMoodType,
        mood_value: Math.round(newMoodValue),
        health_type: newHealthType,
        sick_since: newSickSince,
        consecutive_neglect_days: newNeglectDays,
        ran_away_at: newRanAwayAt,
      } : null,
    }));
  },

  // BUG-10 修复：升级循环中逐级记录进化，不遗漏中间阶段
  addPoints: async (amount: number) => {
    const { pet } = get();
    if (!pet || pet.ran_away_at) {
      return { leveled: false, evolved: false, newLevel: pet?.level ?? 1, newStage: pet?.current_stage ?? 1 };
    }

    let newPoints = pet.current_points + amount;
    let newLevel = pet.level;
    let leveled = false;
    let evolved = false;
    const evolutionRecords: number[] = [];

    while (newLevel < 8) {
      const needed = getPointsToNextLevel(newLevel);
      if (needed === 0) break;
      if (newPoints >= needed) {
        newPoints -= needed;
        newLevel += 1;
        leveled = true;
        const prevStage = getStageForLevel(newLevel - 1);
        const nextStage = getStageForLevel(newLevel);
        if (nextStage > prevStage) {
          evolutionRecords.push(nextStage);
          evolved = true;
        }
      } else {
        break;
      }
    }

    if (newLevel >= 8) newPoints = 0;

    const newStage = getStageForLevel(newLevel);
    const newPointsToNext = getPointsToNextLevel(newLevel);

    await dbRun(
      `UPDATE pets SET current_points = ?, level = ?,
        points_to_next_level = ?, current_stage = ? WHERE id = ?`,
      [newPoints, newLevel, newPointsToNext, newStage, pet.id]
    );

    for (const stage of evolutionRecords) {
      await dbRun(
        'INSERT INTO evolution_history (id, pet_id, stage) VALUES (?, ?, ?)',
        [uuidv4(), pet.id, stage]
      );
    }

    const finalStage = evolutionRecords[evolutionRecords.length - 1] ?? newStage;

    set((state) => ({
      pet: state.pet ? {
        ...state.pet,
        current_points: newPoints,
        level: newLevel,
        points_to_next_level: newPointsToNext,
        current_stage: newStage,
      } : null,
      justEvolved: evolved,
      evolvedToStage: evolved ? finalStage : state.evolvedToStage,
    }));

    return { leveled, evolved, newLevel, newStage };
  },

  checkEvolution: async () => {
    const { pet } = get();
    if (!pet) return { evolved: false, oldStage: 1, newStage: 1 };
    const newStage = getStageForLevel(pet.level);
    const oldStage = pet.current_stage;
    if (newStage > oldStage) {
      await dbRun('UPDATE pets SET current_stage = ? WHERE id = ?', [newStage, pet.id]);
      await dbRun(
        'INSERT INTO evolution_history (id, pet_id, stage) VALUES (?, ?, ?)',
        [uuidv4(), pet.id, newStage]
      );
      set((state) => ({
        pet: state.pet ? { ...state.pet, current_stage: newStage } : null,
        justEvolved: true,
        evolvedToStage: newStage,
      }));
      return { evolved: true, oldStage, newStage };
    }
    return { evolved: false, oldStage, newStage };
  },

  triggerRunaway: async () => {
    const { pet } = get();
    if (!pet) return;
    const now = new Date().toISOString();
    await dbRun('UPDATE pets SET ran_away_at = ?, consecutive_neglect_days = 7 WHERE id = ?', [now, pet.id]);
    set((state) => ({
      pet: state.pet ? { ...state.pet, ran_away_at: now, consecutive_neglect_days: 7 } : null,
    }));
  },

  returnFromRunaway: async (usePoints: boolean) => {
    const { pet } = get();
    if (!pet || !pet.ran_away_at) return false;
    const now = new Date().toISOString();
    const ops: (() => Promise<void>)[] = [];
    if (usePoints) {
      ops.push(() => spendPointsForCare(pet.child_id, RETURN_HOME_POINTS, '宠物回家'));
    }
    ops.push(() => dbRun(
      `UPDATE pets SET ran_away_at = NULL, consecutive_neglect_days = 0,
        mood_type = 'normal', mood_value = 60,
        health_type = 'healthy', hunger_value = 80, clean_value = 80,
        last_fed_at = ?, last_bathed_at = ?, last_played_at = ?
        WHERE id = ?`,
      [now, now, now, pet.id]
    ));
    await dbRunTransaction(ops);
    set((state) => ({
      pet: state.pet ? {
        ...state.pet,
        ran_away_at: null,
        consecutive_neglect_days: 0,
        mood_type: 'normal' as MoodType,
        mood_value: 60,
        health_type: 'healthy' as HealthType,
        hunger_value: 80,
        clean_value: 80,
        last_fed_at: now,
        last_bathed_at: now,
        last_played_at: now,
      } : null,
    }));
    return true;
  },

  clearEvolvedFlag: () => {
    set({ justEvolved: false, evolvedToStage: 0 });
  },

  addPointsForChild: async (childId: string, amount: number) => {
    if (amount <= 0) return;
    const pet = await dbGetOne<Pet>('SELECT * FROM pets WHERE child_id = ?', [childId]);
    if (!pet || pet.ran_away_at) return;

    let newPoints = pet.current_points + amount;
    let newLevel = pet.level;
    let evolved = false;
    const evolutionRecords: number[] = [];

    while (newLevel < 8) {
      const needed = getPointsToNextLevel(newLevel);
      if (needed === 0) break;
      if (newPoints >= needed) {
        newPoints -= needed;
        newLevel += 1;
        const prevStage = getStageForLevel(newLevel - 1);
        const nextStage = getStageForLevel(newLevel);
        if (nextStage > prevStage) {
          evolutionRecords.push(nextStage);
          evolved = true;
        }
      } else {
        break;
      }
    }

    if (newLevel >= 8) newPoints = 0;

    const newStage = getStageForLevel(newLevel);
    const newPointsToNext = getPointsToNextLevel(newLevel);

    await dbRun(
      `UPDATE pets SET current_points = ?, level = ?,
        points_to_next_level = ?, current_stage = ? WHERE id = ?`,
      [newPoints, newLevel, newPointsToNext, newStage, pet.id]
    );

    for (const stage of evolutionRecords) {
      await dbRun(
        'INSERT INTO evolution_history (id, pet_id, stage) VALUES (?, ?, ?)',
        [uuidv4(), pet.id, stage]
      );
    }

    if (get().pet?.child_id === childId) {
      await get().loadPet(childId);
      if (evolved) {
        const finalStage = evolutionRecords[evolutionRecords.length - 1];
        set({ justEvolved: true, evolvedToStage: finalStage });
      }
    }
  },
}));
