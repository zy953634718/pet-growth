// ============================================================
// 萌宠成长记 - 主题统一导出
// ============================================================

export { Colors, Typography, Spacing, BorderRadius, Shadows, Breakpoints, TouchTarget, TabBarConfig } from './tokens';
export { useResponsive, scale, moderateScaleStatic, fontSizeStatic, clamp } from './responsive';
export {
  ScreenContainer, ScrollContent, CardStyle, CardShadow,
  SectionTitle, PrimaryButton, PrimaryButtonText,
  SecondaryButton, SecondaryButtonText,
  TabActive, TabInactive, TabTextActive, TabTextInactive,
  EmptyText, ProgressBarBg, ProgressBarFill,
  ModalOverlay, ModalCard,
} from './components';

// wp/hp 快捷方式（用于 StyleSheet.create 外的场景）
import { Dimensions } from 'react-native';
export function wp(percentage: number): number {
  return (Dimensions.get('window').width * percentage) / 100;
}
export function hp(percentage: number): number {
  return (Dimensions.get('window').height * percentage) / 100;
}
