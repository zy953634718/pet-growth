// ============================================================
// 萌宠成长记 - 设计令牌 (Design Tokens)
// 所有颜色、字号、间距、圆角、阴影的单一事实来源
// ============================================================

// ─── 色彩系统 ─────────────────────────────────────────────
export const Colors = {
  // 主色（珊瑚红系）
  primary50: '#FFF5F5',
  primary100: '#FFE0E0',
  primary200: '#FFD1D1',
  primary300: '#FFB3B3',
  primary400: '#FF8E8E',
  primary500: '#FF6B6B',   // 主色
  primary600: '#E85555',
  primary700: '#C94040',
  primary800: '#A03030',
  primary900: '#7A2020',

  // 辅色（青绿系）
  secondary50: '#E6FAF9',
  secondary100: '#B3F0ED',
  secondary200: '#80E8E3',
  secondary300: '#4ECDC4',   // 辅色
  secondary400: '#3BBAB2',
  secondary500: '#2DA39C',
  secondary600: '#1F8C86',
  secondary700: '#15756F',
  secondary800: '#0B5E59',
  secondary900: '#034743',

  // 功能色
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  warningDark: '#E65100',
  warningDeepDark: '#BF360C',
  warningBorder: '#FFE0B2',
  warningBgSoft: '#FFFBF5',
  error: '#F44336',
  errorLight: '#FFEBEE',
  info: '#2196F3',
  infoLight: '#E3F2FD',
  infoDark: '#4A90D9',

  // 星星金色
  star: '#FFD700',
  starLight: '#FFFEF0',
  starBorder: '#FFE066',

  // 中性色
  neutral0: '#FFFFFF',
  neutral50: '#FAFBFC',
  neutral100: '#F5F5F5',
  neutral200: '#EEEEEE',
  neutral300: '#DDDDDD',
  neutral400: '#AAAAAA',
  neutral500: '#888888',
  neutral600: '#666666',
  neutral700: '#555555',
  neutral800: '#444444',
  neutral900: '#333333',
  neutral950: '#222222',

  // 语义背景
  bgPrimary: '#FAFBFC',
  bgCard: '#FFFFFF',
  bgOverlay: 'rgba(0, 0, 0, 0.45)',
  overlay: 'rgba(0, 0, 0, 0.45)',
  bgPetCircle: '#FFF9F5',        // 宠物头像底色
  bgPinkSoft: '#FFF0F5',         // 浅粉背景
  bgPeachSoft: '#FFF5F0',        // 浅桃色背景
  bgCoralSoft: '#FFF0E6',        // 浅珊瑚背景
  bgBlueSoft: '#F0FAFF',         // 浅蓝背景
  bgCreamSoft: '#FFF9E6',        // 浅奶油背景
  bgPinkLight: '#FFF5F7',        // 浅粉载入背景
  bgCreamWarm: '#FFF9F0',        // 暖米色背景
  textCreamWarm: '#997A33',      // 暖米色背景上的文字

  // 边框
  borderLight: '#F0E6E6',
  borderDefault: '#EEE',
  borderInput: '#E0E0E0',        // 输入框边框
  borderDivider: '#F0F0F0',      // 分隔线/静态进度底
  borderMuted: '#ECECEC',        // 次级分隔
  borderMint: '#B8F5E8',         // 薄荷卡片边框
  borderCoral: '#FFD1CC',        // 珊瑚卡片边框
} as const;

// ─── 分类色板（行为规则默认色） ──────────────────────────
export const CategoryPalette = {
  study: '#4A90D9',
  chore: '#6BCB77',
  habit: '#FFD93D',
  social: '#9C7BCE',
} as const;

// ─── 排版系统 ─────────────────────────────────────────────
export const Typography = {
  // 字号层级（基于 16px 基准）
  xs: 10,     // 标签、角标
  sm: 12,     // 辅助信息
  base: 14,   // 正文
  lg: 16,     // 小标题
  xl: 18,     // 页面标题
  '2xl': 20,  // 区块标题
  '3xl': 24,  // 大标题
  '4xl': 28,  // 弹窗标题
  '5xl': 36,  // 欢迎页主标题

  // 字重
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // 行高
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  // 字间距
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1,
    wider: 2,
  },
} as const;

// ─── 间距系统 ─────────────────────────────────────────────
export const Spacing = {
  0: 0,
  1: 4,    // 微间距
  2: 8,    // 紧凑
  3: 12,   // 小
  4: 16,   // 标准
  5: 20,   // 舒适
  6: 24,   // 中等
  7: 28,
  8: 32,   // 大
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,

  // 语义化别名
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,

  // 场景化
  screenPadding: 16,
  modalPadding: 24,

  // 半级粒度（消除 N+2 反模式）
  '1.5': 6,
  '2.5': 10,
  '3.5': 14,
  '4.5': 18,
  '5.5': 22,
  '6.5': 26,
} as const;

// ─── 圆角系统 ─────────────────────────────────────────────
export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 16,
  '2xl': 18,
  '3xl': 22,
  full: 999,

  // 语义化别名
  chip: 14,
  button: 12,
  input: 12,
  tab: 12,
  card: 14,
  modal: 22,
} as const;

// ─── 阴影系统 ─────────────────────────────────────────────
export const Shadows = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;

// ─── 断点系统 ─────────────────────────────────────────────
export const Breakpoints = {
  /** 超小屏 (iPhone SE, 320dp) */
  xs: 320,
  /** 小屏 (主流安卓 360dp) */
  sm: 360,
  /** 标准屏 (大多数现代手机 375-412dp) */
  md: 412,
  /** 大屏 (Plus/Max 428dp+) */
  lg: 480,
  /** 平板 */
  xl: 600,
  /** 最大内容宽度（超出后居中） */
  maxContentWidth: 480,
} as const;

// ─── 触摸目标最小尺寸 ─────────────────────────────────────
export const TouchTarget = {
  minWidth: 44,
  minHeight: 44,
} as const;

// ─── TabBar 配置 ──────────────────────────────────────────
export const TabBarConfig = {
  height: 50,
  labelFontSize: 10,
  iconSize: 22,
} as const;
