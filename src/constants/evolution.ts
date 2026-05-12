import { PetEvolutionStage } from '@/types';
import { ImageSourcePropType } from 'react-native';
import { PET_IMAGES } from '../../assets/images/petImages';

export const PET_EVOLUTION_STAGES: PetEvolutionStage[] = [
  {
    stage: 1,
    name: '神秘蛋',
    levelRange: [1, 1],
    emoji: '🥚',
    description: '一颗带裂纹的蛋，有微弱光晕。你能感受到里面生命的脉动...',
    unlockAbilities: ['基础互动'],
  },
  {
    stage: 2,
    name: '小萌崽',
    levelRange: [2, 3],
    emoji: '🐣',
    description: '圆滚滚的幼年形态，大眼睛好奇地打量着世界，小短腿走路摇摇晃晃~',
    unlockAbilities: ['基础对话', '简单表情'],
  },
  {
    stage: 3,
    name: '活力少年',
    levelRange: [4, 5],
    emoji: '🦊',
    description: '身体变得修长矫健，开始出现独特的特征（翅膀/尾巴/角），活泼好动！',
    unlockAbilities: ['丰富对话', '情绪表达'],
  },
  {
    stage: 4,
    name: '威风伙伴',
    levelRange: [6, 7],
    emoji: '🦁',
    description: '完整体态，特征成熟可靠，眼神坚定而温柔，是小主人最可靠的伙伴~',
    unlockAbilities: ['深度对话', '学习辅导'],
  },
  {
    stage: 5,
    name: '传说精灵',
    levelRange: [8, 8],
    emoji: '🐉',
    description: '全身散发着神圣的光芒，头顶有耀眼的光环，是宠物中的传奇存在！',
    unlockAbilities: ['全部能力', '专属称号'],
  },
];

export const POINTS_TABLE: number[] = [
  0,    // Lv.1 -> Lv.2 需要 100 积分
  100,  // Lv.2 -> Lv.3 需要 150 积分 (累计250)
  250,  // Lv.3 -> Lv.4 需要 200 积分 (累计450)
  450,  // Lv.4 -> Lv.5 需要 250 积分 (累计700)
  700,  // Lv.5 -> Lv.6 需要 300 积分 (累计1000)
  1000, // Lv.6 -> Lv.7 需要 400 积分 (累计1400)
  1400, // Lv.7 -> Lv.8 需要 600 积分 (累计2000)
  2000, // Lv.8 满级
];

// 计算升级所需积分值（当前等级到下一级）
export function getPointsToNextLevel(currentLevel: number): number {
  if (currentLevel >= 8) return 0;
  return POINTS_TABLE[currentLevel];
}

// 获取当前等级总积分值
export function getTotalPointsForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > 8) level = 8;
  return POINTS_TABLE[level - 1];
}

export const PET_SPECIES = [
  { id: 'dragon', name: '小龙', emoji: '🐉', color: '#FF6B6B', description: '火焰精灵，热情似火' },
  { id: 'cat', name: '小猫', emoji: '🐱', color: '#FFD93D', description: '温柔可爱，乖巧粘人' },
  { id: 'dog', name: '小狗', emoji: '🐶', color: '#6BCB77', description: '忠诚可靠，活泼好动' },
  { id: 'rabbit', name: '小兔', emoji: '🐰', color: '#FF9EBB', description: '软萌乖巧，安静温柔' },
  { id: 'panda', name: '小熊猫', emoji: '🐼', color: '#4A4A4A', description: '憨态可掬，悠闲自在' },
  { id: 'fox', name: '小狐狸', emoji: '🦊', color: '#FF8C42', description: '聪明机灵，古灵精怪' },
];

export function getStageForLevel(level: number): number {
  for (let i = PET_EVOLUTION_STAGES.length - 1; i >= 0; i--) {
    const [min] = PET_EVOLUTION_STAGES[i].levelRange;
    if (level >= min) return PET_EVOLUTION_STAGES[i].stage;
  }
  return 1;
}

export function getStageInfo(stage: number): PetEvolutionStage {
  return PET_EVOLUTION_STAGES.find(s => s.stage === stage) || PET_EVOLUTION_STAGES[0];
}

export function getSpeciesInfo(speciesId: string) {
  return PET_SPECIES.find(s => s.id === speciesId) || PET_SPECIES[0];
}

// 计算是否满足进化条件（基于积分）
export function checkEvolution(petLevel: number, newPoints: number): boolean {
  const totalPoints = getTotalPointsForLevel(petLevel) + newPoints;
  const nextStageLevel = petLevel + 1;
  const currentStage = getStageForLevel(petLevel);
  const nextStage = getStageForLevel(nextStageLevel);
  return nextStage > currentStage;
}

// 进化动画配置
export const EVOLUTION_ANIMATIONS = [
  { from: 1, to: 2, duration: 5000, description: '蛋壳震动加剧 → 裂纹扩散 → 碎裂飞散 → 幼崽探出头' },
  { from: 2, to: 3, duration: 5000, description: '身体发出光芒 → 身体拉长 → 特征长出 → 旋转亮相' },
  { from: 3, to: 4, duration: 6000, description: '能量汇聚 → 全身闪光 → 蜕变 → 展翅/威风姿态' },
  { from: 4, to: 5, duration: 8000, description: '天空变暗 → 星光汇聚 → 神圣光环 → 粒子爆发 → 最终形态' },
];

// 连续奖励配置
export const STREAK_REWARDS = [
  { days: 3, pointsReward: 5, starsReward: 0, description: '连续3天奖励' },
  { days: 7, pointsReward: 0, starsReward: 1, description: '连续7天奖励' },
  { days: 14, pointsReward: 0, starsReward: 3, description: '连续14天奖励', cosmetic: '稀有装扮碎片×1' },
  { days: 30, pointsReward: 0, starsReward: 5, description: '连续30天奖励', cosmetic: '传说装扮碎片×1' },
];

export function getStreakReward(days: number) {
  // 找到满足条件的最长奖励
  const rewards = STREAK_REWARDS.filter(r => days >= r.days);
  if (rewards.length === 0) return null;
  return rewards.sort((a, b) => b.days - a.days)[0];
}

// ============================================================
// 宠物图片映射（通过 assets/images/petImages.ts 集中管理，符合 P6 原则）
// ============================================================
const PET_IMAGE_MAP: Record<string, Record<number, ImageSourcePropType>> = PET_IMAGES;

/**
 * 获取宠物图片的 require 源，供 <Image source={...} /> 使用。
 * @param speciesId - 宠物种类（dragon|cat|dog|rabbit|panda|fox）
 * @param stage - 进化阶段 1-5
 * @returns ImageSourcePropType | null
 */
export function getPetImageSource(speciesId: string, stage: number): ImageSourcePropType | null {
  const safeStage = Math.max(1, Math.min(5, stage || 1));
  return PET_IMAGE_MAP[speciesId]?.[safeStage] ?? null;
}

/**
 * 获取宠物图片的静态路径（用于不易变动的场景）
 */
export function getPetImagePath(speciesId: string, stage: number): string {
  const safeStage = Math.max(1, Math.min(5, stage || 1));
  return `@/assets/images/pets/${speciesId}_stage${safeStage}.png`;
}

