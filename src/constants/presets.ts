import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Preset Behavior Categories
// ============================================================
export const PRESET_BEHAVIOR_CATEGORIES = [
  { name: '学习', icon: '📚', color: '#4CAF50', sort_order: 0 },
  { name: '家务', icon: '🧹', color: '#FF9800', sort_order: 1 },
  { name: '运动', icon: '🏃', color: '#2196F3', sort_order: 2 },
  { name: '习惯', icon: '😊', color: '#9C27B0', sort_order: 3 },
  { name: '社交', icon: '🤝', color: '#E91E63', sort_order: 4 },
  { name: '纠正', icon: '⚠️', color: '#F44336', sort_order: 5 },
];

// ============================================================
// Preset Behavior Rules (key = category name)
// ============================================================
export const PRESET_BEHAVIOR_RULES: Record<string, { name: string; points: number }[]> = {
  '学习': [
    { name: '完成作业', points: 10 },
    { name: '课外阅读30分钟', points: 8 },
    { name: '背诵课文', points: 5 },
    { name: '预习/复习', points: 6 },
    { name: '兴趣班练习', points: 8 },
  ],
  '家务': [
    { name: '扫地/拖地', points: 5 },
    { name: '洗碗/擦桌', points: 8 },
    { name: '整理房间', points: 10 },
    { name: '倒垃圾', points: 3 },
    { name: '洗衣服', points: 6 },
  ],
  '运动': [
    { name: '运动30分钟', points: 8 },
    { name: '跳绳100个', points: 5 },
    { name: '户外活动', points: 6 },
    { name: '球类运动', points: 8 },
    { name: '体能训练', points: 10 },
  ],
  '习惯': [
    { name: '按时睡觉', points: 5 },
    { name: '早起', points: 5 },
    { name: '刷牙洗脸', points: 3 },
    { name: '自己穿衣', points: 3 },
    { name: '收拾书包', points: 4 },
  ],
  '社交': [
    { name: '帮助他人', points: 5 },
    { name: '礼貌用语', points: 3 },
    { name: '分享', points: 5 },
    { name: '合作完成', points: 6 },
  ],
  '纠正': [
    { name: '打架', points: -10 },
    { name: '说谎', points: -8 },
    { name: '沉迷游戏', points: -5 },
    { name: '挑食', points: -3 },
    { name: '顶嘴', points: -3 },
  ],
};

// ============================================================
// Preset Task Categories
// ============================================================
export const PRESET_TASK_CATEGORIES = [
  { name: '学习任务', icon: '📚', color: '#4CAF50', sort_order: 0 },
  { name: '家务任务', icon: '🧹', color: '#FF9800', sort_order: 1 },
  { name: '运动任务', icon: '🏃', color: '#2196F3', sort_order: 2 },
  { name: '阅读任务', icon: '📖', color: '#00BCD4', sort_order: 3 },
  { name: '社交任务', icon: '🤝', color: '#E91E63', sort_order: 4 },
  { name: '习惯养成', icon: '⭐', color: '#9C27B0', sort_order: 5 },
];

// ============================================================
// Preset Task Templates (key = category name)
// ============================================================
export const PRESET_TASK_TEMPLATES: Record<string, {
  title: string;
  description: string;
  default_points: number;
  default_confirm_mode: 'auto' | 'parent' | 'photo';
  default_repeat: 'once' | 'daily' | 'weekly';
}[]> = {
  '学习任务': [
    { title: '完成{科目}作业', description: '认真完成今天的{科目}作业', default_points: 10, default_confirm_mode: 'parent', default_repeat: 'daily' },
    { title: '阅读{分钟}分钟', description: '安静阅读课外书{分钟}分钟', default_points: 8, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '背诵{课文}', description: '熟练背诵{课文}', default_points: 5, default_confirm_mode: 'parent', default_repeat: 'once' },
    { title: '预习明天课程', description: '提前预习明天的课程内容', default_points: 6, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '兴趣班练习', description: '完成今天的兴趣班练习', default_points: 8, default_confirm_mode: 'parent', default_repeat: 'daily' },
  ],
  '家务任务': [
    { title: '整理房间', description: '把房间收拾干净整齐', default_points: 10, default_confirm_mode: 'photo', default_repeat: 'daily' },
    { title: '洗碗', description: '把碗筷洗干净放好', default_points: 5, default_confirm_mode: 'photo', default_repeat: 'daily' },
    { title: '扫地/拖地', description: '把地面打扫干净', default_points: 5, default_confirm_mode: 'photo', default_repeat: 'daily' },
    { title: '倒垃圾', description: '把垃圾袋拿到楼下扔掉', default_points: 3, default_confirm_mode: 'auto', default_repeat: 'daily' },
  ],
  '运动任务': [
    { title: '运动30分钟', description: '户外运动或室内运动30分钟', default_points: 8, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '跳绳{个数}个', description: '连续跳绳{个数}个', default_points: 5, default_confirm_mode: 'parent', default_repeat: 'daily' },
    { title: '球类运动', description: '打篮球/踢足球/打羽毛球等', default_points: 8, default_confirm_mode: 'auto', default_repeat: 'daily' },
  ],
  '阅读任务': [
    { title: '每日阅读', description: '阅读课外书至少20分钟', default_points: 8, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '写读书笔记', description: '为今天读的内容写一段感想', default_points: 10, default_confirm_mode: 'parent', default_repeat: 'weekly' },
    { title: '给家人讲故事', description: '把读到的故事讲给家人听', default_points: 8, default_confirm_mode: 'parent', default_repeat: 'weekly' },
  ],
  '社交任务': [
    { title: '帮助他人', description: '今天帮助了一个需要帮助的人', default_points: 5, default_confirm_mode: 'parent', default_repeat: 'daily' },
    { title: '用礼貌用语', description: '全天使用礼貌用语', default_points: 3, default_confirm_mode: 'parent', default_repeat: 'daily' },
    { title: '主动分享', description: '主动和小伙伴分享东西', default_points: 5, default_confirm_mode: 'parent', default_repeat: 'daily' },
  ],
  '习惯养成': [
    { title: '按时起床', description: '在规定时间前起床', default_points: 5, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '按时睡觉', description: '在规定时间前上床睡觉', default_points: 5, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '刷牙洗脸', description: '早晚各刷牙洗脸一次', default_points: 3, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '自己穿衣', description: '自己穿好衣服整理好', default_points: 3, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '收拾书包', description: '睡前整理好明天的书包', default_points: 4, default_confirm_mode: 'auto', default_repeat: 'daily' },
    { title: '控制屏幕时间', description: '今天使用电子设备不超过规定时间', default_points: 5, default_confirm_mode: 'parent', default_repeat: 'daily' },
  ],
};

// ============================================================
// Preset Shop Items (Cosmetics)
// ============================================================
export const PRESET_SHOP_COSMETICS = [
  // Hats
  { name: '小红帽', emoji: '🧢', item_type: 'cosmetic' as const, sub_type: 'hat', price_type: 'points' as const, price: 30, rarity: 'common' as const },
  { name: '王冠', emoji: '👑', item_type: 'cosmetic' as const, sub_type: 'hat', price_type: 'stars' as const, price: 2, rarity: 'rare' as const },
  { name: '猫耳发箍', emoji: '🐱', item_type: 'cosmetic' as const, sub_type: 'hat', price_type: 'points' as const, price: 50, rarity: 'common' as const },
  { name: '星星头饰', emoji: '⭐', item_type: 'cosmetic' as const, sub_type: 'hat', price_type: 'stars' as const, price: 3, rarity: 'epic' as const },

  // Clothes
  { name: '彩虹披风', emoji: '🌈', item_type: 'cosmetic' as const, sub_type: 'clothes', price_type: 'points' as const, price: 60, rarity: 'common' as const },
  { name: '小西装', emoji: '🤵', item_type: 'cosmetic' as const, sub_type: 'clothes', price_type: 'stars' as const, price: 3, rarity: 'rare' as const },
  { name: '超人斗篷', emoji: '🦸', item_type: 'cosmetic' as const, sub_type: 'clothes', price_type: 'stars' as const, price: 5, rarity: 'legendary' as const },

  // Accessories
  { name: '小眼镜', emoji: '👓', item_type: 'cosmetic' as const, sub_type: 'accessory', price_type: 'points' as const, price: 25, rarity: 'common' as const },
  { name: '蝴蝶结', emoji: '🎀', item_type: 'cosmetic' as const, sub_type: 'accessory', price_type: 'points' as const, price: 20, rarity: 'common' as const },
  { name: '金色项链', emoji: '📿', item_type: 'cosmetic' as const, sub_type: 'accessory', price_type: 'stars' as const, price: 2, rarity: 'rare' as const },

  // Backgrounds
  { name: '绿色草原', emoji: '🌿', item_type: 'cosmetic' as const, sub_type: 'background', price_type: 'points' as const, price: 40, rarity: 'common' as const },
  { name: '海滩日落', emoji: '🏖️', item_type: 'cosmetic' as const, sub_type: 'background', price_type: 'stars' as const, price: 2, rarity: 'rare' as const },
  { name: '星空夜空', emoji: '🌌', item_type: 'cosmetic' as const, sub_type: 'background', price_type: 'stars' as const, price: 4, rarity: 'epic' as const },

  // Effects
  { name: '小星星拖尾', emoji: '✨', item_type: 'cosmetic' as const, sub_type: 'effect', price_type: 'points' as const, price: 80, rarity: 'common' as const },
  { name: '彩虹光环', emoji: '💫', item_type: 'cosmetic' as const, sub_type: 'effect', price_type: 'stars' as const, price: 5, rarity: 'legendary' as const },
];

// ============================================================
// Helper: Generate preset data for a family
// ============================================================
export function generatePresetBehaviorCategories(familyId: string) {
  return PRESET_BEHAVIOR_CATEGORIES.map((cat, index) => ({
    id: uuidv4(),
    family_id: familyId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    sort_order: cat.sort_order,
    is_preset: 1,
    is_hidden: 0,
  }));
}

export function generatePresetBehaviorRules(familyId: string, categoryMap: Record<string, string>) {
  const rules: {
    id: string;
    family_id: string;
    category_id: string;
    name: string;
    points: number;
    daily_limit: number;
    need_approve: number;
    is_preset: number;
    created_at: string;
  }[] = [];

  for (const [categoryName, categoryId] of Object.entries(categoryMap)) {
    const categoryRules = PRESET_BEHAVIOR_RULES[categoryName] || [];
    for (const rule of categoryRules) {
      rules.push({
        id: uuidv4(),
        family_id: familyId,
        category_id: categoryId,
        name: rule.name,
        points: rule.points,
        daily_limit: 0,
        need_approve: rule.points < 0 ? 1 : 0,
        is_preset: 1,
        created_at: new Date().toISOString(),
      });
    }
  }

  return rules;
}

export function generatePresetTaskCategories(familyId: string) {
  return PRESET_TASK_CATEGORIES.map((cat) => ({
    id: uuidv4(),
    family_id: familyId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    sort_order: cat.sort_order,
    is_preset: 1,
    is_hidden: 0,
  }));
}

export function generatePresetTaskTemplates(familyId: string, categoryMap: Record<string, string>) {
  const templates: {
    id: string;
    family_id: string;
    category_id: string;
    title: string;
    description: string;
    default_points: number;
    default_confirm_mode: 'auto' | 'parent' | 'photo';
    default_repeat: 'once' | 'daily' | 'weekly';
    is_preset: number;
    created_at: string;
  }[] = [];

  for (const [categoryName, categoryId] of Object.entries(categoryMap)) {
    const categoryTemplates = PRESET_TASK_TEMPLATES[categoryName] || [];
    for (const tpl of categoryTemplates) {
      templates.push({
        id: uuidv4(),
        family_id: familyId,
        category_id: categoryId,
        title: tpl.title,
        description: tpl.description,
        default_points: tpl.default_points,
        default_confirm_mode: tpl.default_confirm_mode,
        default_repeat: tpl.default_repeat,
        is_preset: 1,
        created_at: new Date().toISOString(),
      });
    }
  }

  return templates;
}

export function generatePresetCosmetics(familyId: string) {
  return PRESET_SHOP_COSMETICS.map((item) => ({
    id: uuidv4(),
    family_id: familyId,
    name: item.name,
    description: null,
    item_type: item.item_type,
    sub_type: item.sub_type,
    price_type: item.price_type,
    price: item.price,
    stock: -1,
    image: item.emoji,
    rarity: item.rarity,
    is_preset: 1,
    parent_approval: 0,
    created_at: new Date().toISOString(),
  }));
}
