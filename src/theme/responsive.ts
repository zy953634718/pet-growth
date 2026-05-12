// ============================================================
// 萌宠成长记 - 响应式工具函数
// 基于 React Native Dimensions + useWindowDimensions
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';
import { Breakpoints, Spacing, Typography } from './tokens';

// ─── 基准设计尺寸（以 375dp 为基准设计） ─────────────────
const DESIGN_WIDTH = 375;

/**
 * 获取屏幕信息
 */
export function getScreenInfo() {
  const { width, height } = Dimensions.get('window');
  return {
    width,
    height,
    isSmall: width < Breakpoints.sm,          // < 360dp (iPhone SE)
    isMedium: width >= Breakpoints.sm && width < Breakpoints.md, // 360-412dp
    isLarge: width >= Breakpoints.md && width < Breakpoints.lg,  // 412-480dp
    isTablet: width >= Breakpoints.lg,         // >= 480dp
    isMaxWidth: width >= Breakpoints.maxContentWidth,
    fontScale: PixelRatio.getFontScale(),
    pixelRatio: PixelRatio.get(),
  };
}

/**
 * useResponsive Hook
 * 返回响应式布局所需的屏幕信息和工具函数
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const info = getScreenInfoFromWidth(width);

  // 水平缩放因子（基于设计宽度 375dp）
  const horizontalScale = width / DESIGN_WIDTH;

  // 非线性缩放因子（小屏少缩、大屏多缩，避免极端情况）
  const moderateScale = useCallback(
    (size: number, factor: number = 0.5) => {
      return size + (horizontalScale - 1) * factor * size;
    },
    [horizontalScale],
  );

  // 响应式间距
  const sp = useCallback(
    (baseSpacing: number) => {
      if (info.isSmall) return Math.max(Spacing[1], baseSpacing * 0.85);
      if (info.isLarge) return baseSpacing * 1.1;
      return baseSpacing;
    },
    [info.isSmall, info.isLarge],
  );

  // 响应式字号
  const fontSize = useCallback(
    (baseFontSize: number) => {
      return moderateScale(baseFontSize, 0.3);
    },
    [moderateScale],
  );

  // 水平百分比宽度
  const wp = useCallback(
    (percentage: number) => (width * percentage) / 100,
    [width],
  );

  // 垂直百分比高度
  const hp = useCallback(
    (percentage: number) => (height * percentage) / 100,
    [height],
  );

  // 自适应水平内边距（小屏少、大屏多，最大不超过 maxContentWidth 的边距）
  const hPadding = useCallback(() => {
    if (width >= Breakpoints.maxContentWidth) {
      return (width - Breakpoints.maxContentWidth) / 2 + Spacing[4];
    }
    if (info.isSmall) return Spacing[3];
    return Spacing[4];
  }, [width, info.isSmall]);

  // 最大内容宽度样式
  const maxContentStyle = useCallback(() => {
    if (width <= Breakpoints.maxContentWidth) return {};
    return { maxWidth: Breakpoints.maxContentWidth, alignSelf: 'center' as const, width: '100%' };
  }, [width]);

  return {
    width,
    height,
    ...info,
    horizontalScale,
    moderateScale,
    sp,
    fontSize,
    wp,
    hp,
    hPadding,
    maxContentStyle,
  };
}

// ─── 非 Hook 版工具函数（用于 StyleSheet.create） ────────

function getScreenInfoFromWidth(width: number) {
  return {
    isSmall: width < Breakpoints.sm,
    isMedium: width >= Breakpoints.sm && width < Breakpoints.md,
    isLarge: width >= Breakpoints.md && width < Breakpoints.lg,
    isTablet: width >= Breakpoints.lg,
    isMaxWidth: width >= Breakpoints.maxContentWidth,
  };
}

/**
 * 将数值限制在 [min, max] 范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 基于 screen width 的 scale（用于非 Hook 场景如 StyleSheet）
 * 注意：这是静态值，不会随屏幕旋转更新
 */
export function scale(size: number): number {
  const { width } = Dimensions.get('window');
  return (size * width) / DESIGN_WIDTH;
}

/**
 * moderateScale 的静态版本
 */
export function moderateScaleStatic(size: number, factor: number = 0.5): number {
  return size + (scale(size) / size - 1) * factor * size;
}

/**
 * 响应式字号（静态版）
 */
export function fontSizeStatic(base: number): number {
  return moderateScaleStatic(base, 0.3);
}
