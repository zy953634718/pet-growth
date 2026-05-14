import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PointBadge from '@/components/PointBadge';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useShopStore } from '@/stores/useShopStore';
import { usePetStore } from '@/stores/usePetStore';
import { ShopItem, ITEM_TYPE_EMOJI } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal, { ModalStyles } from '@/components/Modal';

type ShopTab = 'gift' | 'cosmetic' | 'privilege';

const TAB_CONFIG: Array<{ key: ShopTab; label: string; icon: string }> = [
  { key: 'gift', label: '礼物', icon: '🎁' },
  { key: 'cosmetic', label: '装扮', icon: '👗' },
  { key: 'privilege', label: '特权', icon: '🎫' },
];

export default function ShopScreen() {
  const { currentChild, currentFamily } = useFamilyStore();
  const { items, loadItems, purchaseItem, loadEquipments } = useShopStore();
  const [tab, setTab] = useState<ShopTab>('gift');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  // 提示弹窗状态
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (title: string, message: string) => {
    setToastTitle(title);
    setToastMessage(message);
    setToastVisible(true);
  };

  useEffect(() => {
    if (currentFamily) {
      loadItems(currentFamily.id);
    }
  }, [currentFamily?.id]);

  const filteredItems = items.filter(i => i.item_type === tab);
  const balance = currentChild?.current_points ?? 0;
  const stars = currentChild?.current_stars ?? 0;

  const handlePurchase = () => {
    if (!selectedItem || !currentChild) return;
    const itemSnapshot = selectedItem;
    const childId = currentChild.id;
    purchaseItem(childId, itemSnapshot.id)
      .then(async () => {
        const pet = usePetStore.getState().pet;
        if (itemSnapshot.item_type === 'cosmetic' && pet?.child_id === childId) {
          await loadEquipments(pet.id);
        }
        setSelectedItem(null);
        showToast('成功', `已兑换「${itemSnapshot.name}」！`);
      })
      .catch((err: Error) => {
        showToast('提示', err.message);
      });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部余额 */}
      <View style={styles.balanceBar}>
        <Text style={styles.headerTitle}>🛍️ 兑换商城</Text>
        <View style={styles.badgeRow}>
          <PointBadge type="points" amount={balance} size="small" />
          <PointBadge type="stars" amount={stars} size="small" />
        </View>
      </View>

      {/* Tab 栏 */}
      <View style={styles.tabRow}>
        {TAB_CONFIG.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={styles.tabEmoji}>{t.icon}</Text>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 商品网格 */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎁</Text>
            <Text style={styles.emptyText}>该分类暂无商品</Text>
          </View>
        ) : (
          filteredItems.map((item) => {
            const needsParent = item.parent_approval === 1;
            const outOfStock = item.stock !== -1 && item.stock <= 0;
            const canAfford =
              !needsParent &&
              !outOfStock &&
              (item.price_type === 'points' ? balance >= item.price : stars >= item.price);

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemCard, !canAfford && styles.itemDisabled]}
                onPress={() => {
                  if (needsParent) {
                    showToast('提示', '该商品需由家长在家长端代为兑换');
                    return;
                  }
                  if (outOfStock) {
                    showToast('提示', '该商品已售罄');
                    return;
                  }
                  if (canAfford) setSelectedItem(item);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.itemImageArea}>
                  <Text style={styles.itemEmoji}>{item.image || ITEM_TYPE_EMOJI[item.item_type]}</Text>
                </View>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.priceRow}>
                  <PointBadge
                    type={item.price_type}
                    amount={item.price}
                    size="small"
                  />
                  {needsParent ? (
                    <Text style={styles.notEnough}>家长兑换</Text>
                  ) : outOfStock ? (
                    <Text style={styles.notEnough}>售罄</Text>
                  ) : (
                    !canAfford && <Text style={styles.notEnough}>不足</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 提示弹窗 */}
      <Modal
        visible={toastVisible}
        onClose={() => setToastVisible(false)}
        title={toastTitle}
        showCloseButton={false}
        maxWidth={300}
      >
        <Text style={{ fontSize: 15, color: Colors.neutral600, textAlign: 'center', marginBottom: 20 }}>
          {toastMessage}
        </Text>
        <TouchableOpacity
          style={[ModalStyles.confirmButton, { marginTop: 4 }]}
          onPress={() => setToastVisible(false)}
        >
          <Text style={ModalStyles.confirmButtonText}>知道了</Text>
        </TouchableOpacity>
      </Modal>

      {/* 购买确认弹窗 */}
      <Modal
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        showCloseButton={false}
        maxWidth={320}
      >
        <Text style={styles.modalEmoji}>
          {selectedItem?.image || (selectedItem ? ITEM_TYPE_EMOJI[selectedItem.item_type] : '🎁')}
        </Text>
        <Text style={styles.modalSubtitle}>确认兑换</Text>
        <Text style={styles.modalName}>{selectedItem?.name}</Text>
        {selectedItem && (
          <PointBadge type={selectedItem.price_type} amount={selectedItem.price} size="large" />
        )}

        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity
            style={ModalStyles.cancelButton}
            onPress={() => setSelectedItem(null)}
          >
            <Text style={ModalStyles.cancelButtonText}>再想想</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={ModalStyles.confirmButton}
            onPress={handlePurchase}
          >
            <Text style={ModalStyles.confirmButtonText}>确认购买 ✨</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  balanceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    padding: Spacing.xs,
    backgroundColor: Colors.neutral200,
    borderRadius: BorderRadius.xl,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  tabBtnActive: {
    backgroundColor: Colors.bgCard,
    ...Shadows.sm,
  },
  tabEmoji: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral400,
  },
  tabLabelActive: {
    color: Colors.primary500,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  itemCard: {
    width: '47%',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  itemDisabled: {
    opacity: 0.55,
  },
  itemImageArea: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  itemEmoji: {
    fontSize: 36,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral800,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notEnough: {
    fontSize: 10,
    color: Colors.error,
    fontWeight: '600',
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.neutral300,
  },
  // 弹窗内特有样式
  modalEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 17,
    color: Colors.neutral500,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  modalName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.neutral900,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
});
