// ============================================================
// 萌宠成长记 - 通用组件样式预设
// 基于 tokens 的可复用样式对象
// ============================================================

import { Colors, Spacing, Typography, BorderRadius, Shadows, TouchTarget } from './tokens';

// ─── 容器样式 ─────────────────────────────────────────────
export const ScreenContainer = {
  flex: 1,
  backgroundColor: Colors.bgPrimary,
} as const;

export const ScrollContent = {
  paddingHorizontal: Spacing[4],
  paddingBottom: Spacing[6],
} as const;

// ─── 卡片样式 ─────────────────────────────────────────────
export const CardStyle = {
  backgroundColor: Colors.bgCard,
  borderRadius: BorderRadius.xl,
  padding: Spacing[4],
  ...Shadows.sm,
} as const;

export const CardShadow = {
  backgroundColor: Colors.bgCard,
  borderRadius: BorderRadius.xl,
  padding: Spacing[4],
  ...Shadows.md,
} as const;

// ─── 区块标题 ─────────────────────────────────────────────
export const SectionTitle = {
  fontSize: Typography.lg,
  fontWeight: '700' as const,
  color: Colors.neutral900,
} as const;

// ─── 按钮样式 ─────────────────────────────────────────────
export const PrimaryButton = {
  backgroundColor: Colors.primary500,
  paddingVertical: Spacing[3],
  borderRadius: BorderRadius.lg,
  alignItems: 'center' as const,
  minHeight: TouchTarget.minHeight,
} as const;

export const PrimaryButtonText = {
  color: Colors.neutral0,
  fontSize: Typography.lg,
  fontWeight: '600' as const,
} as const;

export const SecondaryButton = {
  paddingVertical: Spacing[3],
  borderRadius: BorderRadius.lg,
  borderWidth: 1.5,
  borderColor: Colors.neutral300,
  backgroundColor: Colors.neutral0,
  alignItems: 'center' as const,
  minHeight: TouchTarget.minHeight,
} as const;

export const SecondaryButtonText = {
  color: Colors.neutral500,
  fontSize: Typography.base,
  fontWeight: '500' as const,
} as const;

// ─── Tab 样式 ──────────────────────────────────────────────
export const TabActive = {
  backgroundColor: Colors.primary500,
} as const;

export const TabInactive = {
  backgroundColor: Colors.neutral200,
} as const;

export const TabTextActive = {
  color: Colors.neutral0,
} as const;

export const TabTextInactive = {
  color: Colors.neutral500,
} as const;

// ─── 空状态样式 ─────────────────────────────────────────────
export const EmptyText = {
  fontSize: Typography.base,
  color: Colors.neutral400,
  textAlign: 'center' as const,
  paddingVertical: Spacing[5],
} as const;

// ─── 进度条样式 ─────────────────────────────────────────────
export const ProgressBarBg = {
  height: 10,
  backgroundColor: Colors.neutral100,
  borderRadius: BorderRadius.sm,
  overflow: 'hidden' as const,
} as const;

export const ProgressBarFill = {
  height: 10,
  backgroundColor: Colors.secondary300,
  borderRadius: BorderRadius.sm,
} as const;

// ─── Modal 样式 ─────────────────────────────────────────────
export const ModalOverlay = {
  flex: 1,
  backgroundColor: Colors.bgOverlay,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  padding: Spacing[6],
} as const;

export const ModalCard = {
  width: '100%' as const,
  backgroundColor: Colors.bgCard,
  borderRadius: BorderRadius['3xl'],
  padding: Spacing[6],
  alignItems: 'center' as const,
} as const;
