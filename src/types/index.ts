// ============================================================
// 角色类型
// ============================================================
export type Role = 'parent' | 'child';

// ============================================================
// 宠物心情
// ============================================================
export type MoodType = 'excited' | 'happy' | 'normal' | 'unhappy' | 'sad';

export const MOOD_EMOJI: Record<MoodType, string> = {
  excited: '🤩',
  happy: '😄',
  normal: '🙂',
  unhappy: '😐',
  sad: '😢',
};

export const MOOD_COLORS: Record<MoodType, string> = {
  excited: '#FFD700',
  happy: '#4CAF50',
  normal: '#9E9E9E',
  unhappy: '#FF9800',
  sad: '#F44336',
};

// ============================================================
// 宠物身体状态
// ============================================================
export type HealthType = 'healthy' | 'hungry' | 'tired' | 'sick';

export const HEALTH_EMOJI: Record<HealthType, string> = {
  healthy: '💚',
  hungry: '🍖',
  tired: '😴',
  sick: '🤒',
};

export const HEALTH_COLORS: Record<HealthType, string> = {
  healthy: '#4CAF50',
  hungry: '#FF9800',
  tired: '#2196F3',
  sick: '#F44336',
};

// ============================================================
// 任务状态
// ============================================================
export type TaskStatus = 'draft' | 'active' | 'in_progress' | 'submitted' | 'completed' | 'overdue';

export const TASK_STATUS_EMOJI: Record<TaskStatus, string> = {
  draft: '📝',
  active: '⏳',
  in_progress: '🔥',
  submitted: '✅',
  completed: '🎉',
  overdue: '❌',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: '草稿',
  active: '待执行',
  in_progress: '进行中',
  submitted: '待确认',
  completed: '已完成',
  overdue: '已逾期',
};

// ============================================================
// 任务重复类型
// ============================================================
export type RepeatType = 'once' | 'daily' | 'weekly' | 'custom';

export const REPEAT_LABELS: Record<RepeatType, string> = {
  once: '一次性',
  daily: '每天',
  weekly: '每周',
  custom: '自定义',
};

// ============================================================
// 确认方式
// ============================================================
export type ConfirmMode = 'auto' | 'parent' | 'photo';

export const CONFIRM_MODE_LABELS: Record<ConfirmMode, string> = {
  auto: '自动确认',
  parent: '家长确认',
  photo: '拍照确认',
};

// ============================================================
// 任务优先级
// ============================================================
export type Priority = 'high' | 'medium' | 'low';

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#F44336',
  medium: '#FF9800',
  low: '#4CAF50',
};

// ============================================================
// 商品类型
// ============================================================
export type ItemType = 'gift' | 'cosmetic' | 'privilege';

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  gift: '礼物',
  cosmetic: '装扮',
  privilege: '特权',
};

export const ITEM_TYPE_EMOJI: Record<ItemType, string> = {
  gift: '🎁',
  cosmetic: '👗',
  privilege: '🎫',
};

// ============================================================
// 商品稀有度
// ============================================================
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_LABELS: Record<Rarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9E9E9E',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FF9800',
};

// ============================================================
// 货币类型
// ============================================================
export type CurrencyType = 'points' | 'stars';

export const CURRENCY_LABELS: Record<CurrencyType, string> = {
  points: '积分',
  stars: '星星',
};

export const CURRENCY_EMOJI: Record<CurrencyType, string> = {
  points: '⭐',
  stars: '🌟',
};

// ============================================================
// 核销状态
// ============================================================
export type RedemptionStatus = 'pending' | 'redeemed' | 'expired';

export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  pending: '待兑现',
  redeemed: '已兑现',
  expired: '已过期',
};

// ============================================================
// 装备槽位
// ============================================================
export type SlotType = 'hat' | 'clothes' | 'accessory' | 'background' | 'effect';

export const SLOT_LABELS: Record<SlotType, string> = {
  hat: '帽子',
  clothes: '衣服',
  accessory: '配饰',
  background: '背景',
  effect: '特效',
};

// ============================================================
// 数据库实体接口
// ============================================================
export interface Family {
  id: string;
  name: string;
  parent_password: string;
  created_at: string;
}

export interface Child {
  id: string;
  family_id: string;
  name: string;
  age_range: string;
  avatar: string | null;
  total_points: number;
  current_points: number;
  total_stars: number;
  current_stars: number;
  created_at: string;
}

export interface Pet {
  id: string;
  child_id: string;
  species_id: string;
  name: string;
  level: number;
  current_points: number;
  points_to_next_level: number;
  current_stage: number;
  mood_type: MoodType;
  mood_value: number;
  health_type: HealthType;
  hunger_value: number;
  clean_value: number;
  last_fed_at: string;
  last_bathed_at: string;
  last_played_at: string;
  last_rested_at: string | null;
  sick_since: string | null;
  consecutive_neglect_days: number;
  ran_away_at: string | null;
  created_at: string;
}

export interface EvolutionHistory {
  id: string;
  pet_id: string;
  stage: number;
  evolved_at: string;
}

/** 图鉴条目：满级宠物保存的快照 */
export interface CollectionEntry {
  id: string;
  child_id: string;
  pet_id: string;
  species_id: string;
  pet_name: string;
  species_emoji: string;
  species_display_name: string;
  saved_at: string;
}

export interface BehaviorCategory {
  id: string;
  family_id: string;
  name: string;
  icon: string | null;
  color: string;
  sort_order: number;
  is_preset: number;
  is_hidden: number;
}

export interface BehaviorRule {
  id: string;
  family_id: string;
  category_id: string;
  name: string;
  points: number;
  daily_limit: number;
  need_approve: number;
  is_preset: number;
  created_at: string;
}

export interface PointRecord {
  id: string;
  child_id: string;
  rule_id: string | null;
  task_id: string | null;
  points_change: number;
  currency_type: CurrencyType;
  reason: string;
  approved: number;
  created_at: string;
}

export interface TaskCategory {
  id: string;
  family_id: string;
  name: string;
  icon: string | null;
  color: string;
  sort_order: number;
  is_preset: number;
  is_hidden: number;
}

export interface TaskTemplate {
  id: string;
  family_id: string;
  category_id: string;
  title: string;
  description: string | null;
  default_points: number;
  default_confirm_mode: ConfirmMode;
  default_repeat: RepeatType;
  is_preset: number;
  created_at: string;
}

export interface Task {
  id: string;
  family_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  points_reward: number;
  stars_reward: number;
  deadline: string | null;
  start_time: string | null;
  repeat_type: RepeatType;
  repeat_config: string | null;
  confirm_mode: ConfirmMode;
  overdue_penalty: number;
  assignee_id: string;
  priority: Priority;
  status: TaskStatus;
  completion_proof: string | null;
  completed_at: string | null;
  confirmed_at: string | null;
  points_awarded: number;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  child_id: string;
  proof_data: string | null;
  approved: number;
  completed_at: string;
  confirmed_at: string | null;
}

export interface Streak {
  id: string;
  child_id: string;
  category_id: string | null;
  current_streak: number;
  best_streak: number;
  last_completion_date: string | null;
}

export interface ShopItem {
  id: string;
  family_id: string;
  name: string;
  description: string | null;
  item_type: ItemType;
  sub_type: string | null;
  price_type: CurrencyType;
  price: number;
  stock: number;
  image: string | null;
  rarity: Rarity;
  is_preset: number;
  parent_approval: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  child_id: string;
  item_id: string;
  redeem_code: string | null;
  status: RedemptionStatus;
  purchase_time: string;
  redeemed_at: string | null;
}

export interface PetEquipment {
  id: string;
  pet_id: string;
  slot_type: SlotType;
  item_id: string;
  equipped: number;
  acquired_at: string;
  /** JOIN shop_items 回来的商品名称 */
  item_name?: string;
  /** JOIN shop_items 回来的商品图片/emoji */
  item_image?: string | null;
}

export interface AIConfig {
  id: string;
  family_id: string;
  model_provider: string;
  model_name: string;
  api_key_encrypted: string | null;
  temperature: number;
  max_tokens: number;
  created_at: string;
}

export interface AISafetyConfig {
  id: string;
  family_id: string;
  topic_restriction: string | null;
  filter_level: 'strict' | 'standard' | 'relaxed';
  daily_message_limit: number;
  session_duration_limit: number;
  allowed_time_slots: string | null;
  blocked_keywords: string | null;
  save_history: number;
  enable_voice: number;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  pet_id: string;
  role: 'user' | 'assistant';
  content: string;
  mood_at_time: MoodType | null;
  pet_stage_at_time: number | null;
  created_at: string;
}

export interface DailySummary {
  id: string;
  child_id: string;
  date: string;
  points_earned: number;
  points_spent: number;
  stars_earned: number;
  stars_spent: number;
  tasks_completed: number;
  tasks_total: number;
}

// ============================================================
// 宠物进化阶段定义
// ============================================================
export interface PetEvolutionStage {
  stage: number;
  name: string;
  levelRange: [number, number];
  emoji: string;
  description: string;
  unlockAbilities: string[];
  evolved_at?: string;
}

// ============================================================
// UI 相关类型
// ============================================================
export interface TabItem {
  label: string;
  icon: string;
  screen: string;
}

// ============================================================
// 照顾操作
// ============================================================
export interface CareAction {
  type: 'feed' | 'bathe' | 'play' | 'rest' | 'treat' | 'pet';
  name: string;
  emoji: string;
  costPoints: number;
  costStars: number;
  cooldownHours: number;
  effect: string;
}

// ============================================================
// AI 对话相关
// ============================================================
export interface AIFallbackReply {
  keywords: string[];
  response: string;
}
