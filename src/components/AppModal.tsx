import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Modal, { ModalStyles } from '@/components/Modal';
import { Colors } from '@/theme';
import type { ModalState } from '@/hooks/useModal';

interface AppModalProps {
  state: ModalState;
  onClose: () => void;
}

/**
 * 配合 useModal hook 使用的通用弹窗渲染组件。
 *
 * 用法：
 *   const { modal, showModal, hideModal } = useModal();
 *   ...
 *   <AppModal state={modal} onClose={hideModal} />
 */
export default function AppModal({ state, onClose }: AppModalProps) {
  return (
    <Modal
      visible={state.visible}
      onClose={onClose}
      title={state.title}
      showCloseButton={state.actions.length <= 1}
    >
      {!!state.message && (
        <Text
          style={{
            fontSize: 15,
            color: Colors.neutral600,
            lineHeight: 22,
            marginBottom: 20,
            textAlign: state.actions.length <= 1 ? 'center' : 'left',
          }}
        >
          {state.message}
        </Text>
      )}
      <View style={[ModalStyles.buttonRow, { marginTop: 4 }]}>
        {state.actions.map((action, idx) => {
          const style = action.danger
            ? ModalStyles.dangerButton
            : action.primary
            ? ModalStyles.confirmButton
            : ModalStyles.cancelButton;
          const textStyle = action.danger
            ? ModalStyles.dangerButtonText
            : action.primary
            ? ModalStyles.confirmButtonText
            : ModalStyles.cancelButtonText;

          return (
            <TouchableOpacity
              key={idx}
              style={style}
              onPress={() => {
                onClose();
                action.onPress?.();
              }}
            >
              <Text style={textStyle}>{action.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
}
