import React, { ReactNode } from 'react';
import { View, Modal as RNModal, StyleSheet, TouchableOpacity, ScrollView, Text } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showCloseButton?: boolean;
  scrollable?: boolean;
  maxWidth?: number;
}

/**
 * 统一的项目弹窗组件
 * 提供一致的视觉风格和交互体验
 */
export default function Modal({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  scrollable = false,
  maxWidth = 360,
}: ModalProps) {
  const ContentWrapper = scrollable ? ScrollView : View;
  const wrapperProps = scrollable
    ? { showsVerticalScrollIndicator: false, contentContainerStyle: styles.modalCard, stickyHeaderIndices: title ? [0] : undefined }
    : { style: [styles.modalCard, styles.modalCardNonScrollable] };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.modalContainer, { maxWidth }]}
        >
          {/* 标题栏 */}
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title && <View style={styles.titleFlex}><Text style={styles.title}>{title}</Text></View>}
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 内容区域 */}
          <ContentWrapper {...wrapperProps}>
            {children}
          </ContentWrapper>
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screenPadding,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.modal,
    overflow: 'hidden',
  },
  modalCard: {
    padding: Spacing.modalPadding,
  },
  modalCardNonScrollable: {
    padding: Spacing.modalPadding,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.modalPadding,
    paddingTop: Spacing.modalPadding,
    paddingBottom: 0,
  },
  titleFlex: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  closeText: {
    fontSize: 16,
    color: Colors.neutral500,
    fontWeight: '600',
  },
});

// 导出样式常量供其他组件使用
export const ModalStyles = StyleSheet.create({
  // 表单字段标签
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral700,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },

  // 输入框
  input: {
    borderWidth: 1.5,
    borderColor: Colors.neutral300,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    color: Colors.neutral900,
    backgroundColor: Colors.neutral50,
  },

  // 文本区域
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },

  // 选择行
  selectRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },

  // 选择芯片
  selectChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.chip,
    backgroundColor: Colors.neutral100,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  selectedChip: {
    backgroundColor: Colors.primary50,
    borderColor: Colors.primary500,
  },

  selectChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.neutral500,
  },

  selectedChipText: {
    color: Colors.primary500,
    fontWeight: '700',
  },

  // 按钮行
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },

  // 取消按钮
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
    borderWidth: 1.5,
    borderColor: Colors.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 15,
    color: Colors.neutral500,
    fontWeight: '500',
  },

  // 确认按钮
  confirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
    backgroundColor: Colors.primary500,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmButtonText: {
    fontSize: 15,
    color: Colors.bgCard,
    fontWeight: 'bold',
  },

  // 次要确认按钮（如家长端特有操作）
  secondaryConfirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
    backgroundColor: Colors.secondary300,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryConfirmButtonText: {
    fontSize: 15,
    color: Colors.bgCard,
    fontWeight: 'bold',
  },

  // 危险按钮（删除、驳回等）
  dangerButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
    borderWidth: 1.5,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
  },

  dangerButtonText: {
    fontSize: 15,
    color: Colors.error,
    fontWeight: '600',
  },
});
