import { useState, useCallback } from 'react';

export type ModalAction = {
  text: string;
  onPress?: () => void;
  primary?: boolean;
  danger?: boolean;
};

export type ModalState = {
  visible: boolean;
  title: string;
  message: string;
  actions: ModalAction[];
};

const DEFAULT_STATE: ModalState = {
  visible: false,
  title: '',
  message: '',
  actions: [{ text: '知道了', primary: true }],
};

/**
 * 通用弹窗 hook，替代 Alert.alert
 *
 * 用法：
 *   const { modal, showModal, hideModal } = useModal();
 *   showModal('标题', '内容');
 *   showModal('确认删除', '...', [
 *     { text: '取消' },
 *     { text: '删除', danger: true, onPress: () => doDelete() },
 *   ]);
 *
 *   // 在 JSX 中渲染：
 *   <AppModal state={modal} onClose={hideModal} />
 */
export function useModal() {
  const [modal, setModal] = useState<ModalState>(DEFAULT_STATE);

  const showModal = useCallback(
    (title: string, message: string, actions?: ModalAction[]) => {
      setModal({
        visible: true,
        title,
        message,
        actions: actions ?? [{ text: '知道了', primary: true }],
      });
    },
    []
  );

  const hideModal = useCallback(() => {
    setModal((prev) => ({ ...prev, visible: false }));
  }, []);

  return { modal, showModal, hideModal };
}
