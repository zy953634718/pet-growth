import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Modal, Alert } from 'react-native';
import PointBadge from '@/components/PointBadge';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { useShopStore } from '@/stores/useShopStore';
import { ShopItem, ITEM_TYPE_EMOJI } from '@/types';

type ShopTab = 'gift' | 'cosmetic' | 'privilege';

const TAB_CONFIG: Array<{ key: ShopTab; label: string; icon: string }> = [
  { key: 'gift', label: '礼物', icon: '🎁' },
  { key: 'cosmetic', label: '装扮', icon: '👗' },
  { key: 'privilege', label: '特权', icon: '🎫' },
];

export default function ShopScreen() {
  const { currentChild, currentFamily } = useFamilyStore();
  const { items, loadItems, purchaseItem } = useShopStore();
  const [tab, setTab] = useState<ShopTab>('gift');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

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
    purchaseItem(currentChild.id, selectedItem.id)
      .then(() => {
        setSelectedItem(null);
        Alert.alert('成功', `已兑换「${selectedItem.name}」！`);
      })
      .catch((err: Error) => {
        Alert.alert('提示', err.message);
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
            const canAfford = item.price_type === 'points'
              ? balance >= item.price
              : stars >= item.price;

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemCard, !canAfford && styles.itemDisabled]}
                onPress={() => canAfford && setSelectedItem(item)}
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
                  {!canAfford && <Text style={styles.notEnough}>不足</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 购买确认弹窗 */}
      <Modal visible={!!selectedItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>
              {selectedItem?.image || (selectedItem ? ITEM_TYPE_EMOJI[selectedItem.item_type] : '🎁')}
            </Text>
            <Text style={styles.modalTitle}>确认兑换</Text>
            <Text style={styles.modalName}>{selectedItem?.name}</Text>
            {selectedItem && (
              <PointBadge type={selectedItem.price_type} amount={selectedItem.price} size="large" />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setSelectedItem(null)}
              >
                <Text style={styles.cancelModalText}>再想想</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmModalBtn}
                onPress={handlePurchase}
              >
                <Text style={styles.confirmModalText}>确认购买 ✨</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  balanceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 7,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 12,
    gap: 8,
    padding: 4,
    backgroundColor: '#F0EFEF',
    borderRadius: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 13,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tabEmoji: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabLabelActive: {
    color: '#FF6B6B',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 10,
    paddingTop: 4,
  },
  itemCard: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  itemDisabled: {
    opacity: 0.55,
  },
  itemImageArea: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF9F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  itemEmoji: {
    fontSize: 36,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notEnough: {
    fontSize: 10,
    color: '#F44336',
    fontWeight: '600',
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#CCC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 56,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    color: '#888',
    marginBottom: 4,
  },
  modalName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  cancelModalText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
  },
  confirmModalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
  },
  confirmModalText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: 'bold',
  },
});
