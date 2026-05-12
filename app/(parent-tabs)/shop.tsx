import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShopStore } from '@/stores/useShopStore';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { ShopItem, ItemType } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal, { ModalStyles } from '@/components/Modal';

type ShopTab = 'gift' | 'cosmetic' | 'privilege' | 'records';

// Map tab to item_type
const TAB_TO_TYPE: Record<string, ItemType> = {
  gift: 'gift',
  cosmetic: 'cosmetic',
  privilege: 'privilege',
};

const TYPE_TO_TAB: Record<ItemType, string> = {
  gift: 'gift',
  cosmetic: 'cosmetic',
  privilege: 'privilege',
};

// Emoji mapping for item types
const TYPE_EMOJI: Record<ItemType, string> = {
  gift: '🎁',
  cosmetic: '👗',
  privilege: '🎫',
};

export default function ShopManageScreen() {
  const [tab, setTab] = useState<ShopTab>('gift');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);

  // Form state for add/edit modal
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemPriceType, setItemPriceType] = useState<'points' | 'stars'>('points');
  const [itemStock, setItemStock] = useState('-1'); // -1 means unlimited
  const [itemEmoji, setItemEmoji] = useState('🎁');
  const [itemNeedsParent, setItemNeedsParent] = useState(false);
  const [proxyItem, setProxyItem] = useState<ShopItem | null>(null);

  // Store hooks
  const {
    items,
    purchases,
    isLoading,
    loadItems,
    loadPurchases,
    addItem,
    updateItem,
    deleteItem,
    redeemPurchase,
    purchaseItem,
  } = useShopStore();
  const { currentFamily, currentChild, children } = useFamilyStore();

  // Load data on mount and when family/children change
  useEffect(() => {
    if (!currentFamily) return;

    loadItems(currentFamily.id);

    // Load purchases for all children
    children.forEach((child) => {
      loadPurchases(child.id);
    });
  }, [currentFamily, children, loadItems, loadPurchases]);

  // Filter items by current tab
  const filteredItems = items.filter((item) => {
    const raw = item.item_type;
    const itemType: ItemType =
      raw === 'gift' || raw === 'cosmetic' || raw === 'privilege' ? raw : 'gift';
    return TYPE_TO_TAB[itemType] === tab;
  });

  // Format date for display
  const formatDate = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Get child name by ID
  const getChildName = (childId: string) => {
    const child = children.find((c) => c.id === childId);
    return child?.name || '未知';
  };

  // Get item name by ID
  const getItemName = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    return item?.name || '未知商品';
  };

  // Open add modal
  const openAddModal = () => {
    setEditingItem(null);
    setItemName('');
    setItemDesc('');
    setItemPrice('');
    setItemPriceType('points');
    setItemStock('-1');
    setItemNeedsParent(false);
    setItemEmoji(TAB_TO_TYPE[tab] ? TYPE_EMOJI[TAB_TO_TYPE[tab]] : '🎁');
    setShowAddModal(true);
  };

  // Open edit modal
  const openEditModal = (item: ShopItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDesc(item.description || '');
    setItemPrice(String(item.price));
    setItemPriceType(item.price_type);
    setItemStock(String(item.stock ?? -1));
    setItemNeedsParent(item.parent_approval === 1);
    setItemEmoji(item.image || TYPE_EMOJI[item.item_type] || '🎁');
    setShowAddModal(true);
  };

  const handleProxyPurchase = async (childId: string) => {
    if (!proxyItem || !currentFamily) return;
    const snap = proxyItem;
    try {
      await purchaseItem(childId, snap.id, { asParent: true });
      setProxyItem(null);
      await loadItems(currentFamily.id);
      children.forEach((ch) => {
        void loadPurchases(ch.id);
      });
      const name = children.find((c) => c.id === childId)?.name ?? '';
      Alert.alert('成功', `已为「${name}」兑换「${snap.name}」`);
    } catch (e) {
      Alert.alert('提示', e instanceof Error ? e.message : '兑换失败');
    }
  };

  // Handle save item (add or update)
  const handleSaveItem = async () => {
    if (!itemName.trim()) {
      Alert.alert('提示', '请输入商品名称');
      return;
    }
    if (!itemPrice || isNaN(Number(itemPrice)) || Number(itemPrice) < 0) {
      Alert.alert('提示', '请输入有效的价格');
      return;
    }
    if (!currentFamily) {
      Alert.alert('提示', '未找到家庭信息');
      return;
    }

    const itemData = {
      family_id: currentFamily.id,
      name: itemName.trim(),
      description: itemDesc.trim() || null,
      item_type: TAB_TO_TYPE[tab] || 'gift',
      sub_type: editingItem?.sub_type ?? null,
      price_type: itemPriceType,
      price: Number(itemPrice),
      stock: itemStock === '-1' ? -1 : (parseInt(itemStock, 10) || 0),
      image: itemEmoji,
      rarity: 'common' as const,
      is_preset: 0,
      parent_approval: itemNeedsParent ? 1 : 0,
    };

    try {
      if (editingItem) {
        await updateItem(editingItem.id, itemData);
        Alert.alert('成功', '商品已更新');
      } else {
        await addItem(itemData);
        Alert.alert('成功', '商品已添加');
      }
      setShowAddModal(false);
      // Reload items
      await loadItems(currentFamily.id);
    } catch (error) {
      Alert.alert('错误', '保存失败，请重试');
      console.error('Save item error:', error);
    }
  };

  // Handle delete item
  const handleDeleteItem = async (item: ShopItem) => {
    Alert.alert('确认删除', `确定要删除商品「${item.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(item.id);
            if (currentFamily) {
              await loadItems(currentFamily.id);
            }
          } catch (error) {
            Alert.alert('错误', '删除失败');
          }
        },
      },
    ]);
  };

  // Handle redeem code submission
  const handleRedeemSubmit = async () => {
    if (redeemCode.length !== 6) return;

    // Find purchase by redeem code
    const purchase = purchases.find(
      (p) => p.redeem_code?.toUpperCase() === redeemCode.toUpperCase() && p.status === 'pending'
    );

    if (!purchase) {
      Alert.alert('提示', '未找到该核销码，或已兑换');
      return;
    }

    try {
      await redeemPurchase(purchase.id);
      Alert.alert('成功', '核销码已确认为已兑现！');
      setShowRedeemModal(false);
      setRedeemCode('');
      // Reload purchases
      if (currentChild) {
        await loadPurchases(currentChild.id);
      }
    } catch (error) {
      Alert.alert('错误', '核销失败，请重试');
    }
  };

  // Handle manual confirm redeem from list
  const handleConfirmRedeem = async (purchaseId: string) => {
    Alert.alert('确认兑现', '确认该商品已兑现给用户？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          try {
            await redeemPurchase(purchaseId);
            if (currentChild) {
              await loadPurchases(currentChild.id);
            }
          } catch (error) {
            Alert.alert('错误', '核销失败');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🛍️ 商城管理</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Text style={styles.addBtnText}>+ 添加商品</Text>
        </TouchableOpacity>
      </View>

      {/* Tab 栏 */}
      <View style={styles.tabRow}>
        {(['gift', 'cosmetic', 'privilege'] as ShopTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, styles.tabFlex, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'gift' ? '🎁 礼物' : t === 'cosmetic' ? '👗 装扮' : '🎫 特权'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.tab, styles.tabRecords, tab === 'records' && styles.tabActive]}
          onPress={() => setTab('records')}
        >
          <Text style={[styles.tabText, styles.tabRecordsText, tab === 'records' && styles.tabTextActive]}>📋 记录</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Loading state */}
        {isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>加载中...</Text>
          </View>
        ) : (
          <>
            {/* 商品列表 */}
        {tab !== 'records' && (
          <>
            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>暂无商品</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={openAddModal}>
                  <Text style={styles.emptyBtnText}>添加第一个商品</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemEmoji}>{item.image || TYPE_EMOJI[item.item_type] || '🎁'}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.parent_approval === 1 ? (
                      <Text style={styles.parentOnlyTag}>仅家长代兑换</Text>
                    ) : null}
                    <Text style={styles.itemPrice}>
                      {item.price_type === 'stars' ? '⭐' : '💎'}{item.price}
                      {item.price_type === 'stars' ? ' 星星' : ' 积分'}
                      {item.stock === -1 ? ' · 无限库存' : item.stock > 0 ? ` · 库存${item.stock}` : ' · 售罄'}
                    </Text>
                    {item.description && (
                      <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                    )}
                  </View>
                  <View style={styles.itemActionsCol}>
                    {children.length > 0 ? (
                      <TouchableOpacity style={styles.proxyBtn} onPress={() => setProxyItem(item)} activeOpacity={0.8}>
                        <Text style={styles.proxyBtnText}>代兑换</Text>
                      </TouchableOpacity>
                    ) : null}
                    <View style={styles.itemActions}>
                      <TouchableOpacity style={styles.editMini} onPress={() => openEditModal(item)}>
                        <Text style={styles.editText}>编辑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editMini, styles.deleteBtn]}
                        onPress={() => handleDeleteItem(item)}
                      >
                        <Text style={styles.deleteText}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* 兑换记录 */}
        {tab === 'records' && (
          <>
            <TouchableOpacity
              style={styles.redeemEntry}
              onPress={() => setShowRedeemModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.redeemIcon}>🔑</Text>
              <Text style={styles.redeemLabel}>输入核销码确认兑现</Text>
              <Text style={styles.redeemArrow}>›</Text>
            </TouchableOpacity>

            {purchases.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>暂无兑换记录</Text>
              </View>
            ) : (
              purchases.map((p) => (
                <View key={p.id} style={[styles.recordCard, p.status === 'pending' && styles.recordPending]}>
                  <View style={styles.recordLeft}>
                    <Text style={styles.recordChild}>{getChildName(p.child_id)}</Text>
                    <Text style={styles.recordItem}>{getItemName(p.item_id)}</Text>
                  </View>
                  <View style={styles.recordRight}>
                    {p.redeem_code && <Text style={styles.codeText}>码: {p.redeem_code}</Text>}
                    <Text style={[
                      p.status === 'pending' ? styles.pendingTag : styles.redeemedTag,
                    ]}>
                      {p.status === 'pending' ? '待兑现' : '已兑现'}
                    </Text>
                    <Text style={styles.dateText}>{formatDate(p.purchase_time)}</Text>
                  </View>

                  {p.status === 'pending' && p.redeem_code && (
                    <TouchableOpacity
                      style={styles.confirmRedeemBtn}
                      onPress={() => handleConfirmRedeem(p.id)}
                    >
                      <Text style={styles.confirmRedeemText}>确认兑现</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}
        <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* 添加/编辑商品弹窗 */}
      <Modal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingItem ? '编辑商品' : '添加商品'}
        scrollable
      >
        <View>
          <Text style={ModalStyles.fieldLabel}>商品名称 *</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="例如：去游乐园"
            value={itemName}
            onChangeText={setItemName}
          />
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>描述（可选）</Text>
          <TextInput
            style={[ModalStyles.input, ModalStyles.textArea]}
            placeholder="详细说明..."
            value={itemDesc}
            onChangeText={setItemDesc}
            multiline
            numberOfLines={2}
          />
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>价格 *</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="例如：50"
            value={itemPrice}
            onChangeText={(t) => t.replace(/[^0-9]/g, '')}
            keyboardType="number-pad"
          />
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>价格类型</Text>
          <View style={styles.priceTypeRow}>
            <TouchableOpacity
              style={[styles.priceTypeBtn, itemPriceType === 'points' && styles.priceTypeActive]}
              onPress={() => setItemPriceType('points')}
            >
              <Text style={[styles.priceTypeText, itemPriceType === 'points' && styles.priceTypeTextActive]}>
                💎 积分
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priceTypeBtn, itemPriceType === 'stars' && styles.priceTypeActive]}
              onPress={() => setItemPriceType('stars')}
            >
              <Text style={[styles.priceTypeText, itemPriceType === 'stars' && styles.priceTypeTextActive]}>
                ⭐ 星星
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>库存（-1 表示无限）</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="-1"
            value={itemStock}
            onChangeText={(t) => t.replace(/[^0-9-]/g, '')}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View>
          <Text style={ModalStyles.fieldLabel}>图标 Emoji</Text>
          <TextInput
            style={ModalStyles.input}
            placeholder="🎁"
            value={itemEmoji}
            onChangeText={setItemEmoji}
            maxLength={2}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={ModalStyles.fieldLabel}>仅家长代兑换</Text>
            <Text style={styles.switchHint}>开启后孩子端无法自购，需在此「代兑换」</Text>
          </View>
          <Switch
            value={itemNeedsParent}
            onValueChange={setItemNeedsParent}
            trackColor={{ false: Colors.neutral300, true: Colors.primary100 }}
            thumbColor={itemNeedsParent ? Colors.primary500 : Colors.neutral100}
          />
        </View>

        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setShowAddModal(false)}>
            <Text style={ModalStyles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ModalStyles.confirmButton} onPress={handleSaveItem}>
            <Text style={ModalStyles.confirmButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 核销码弹窗 */}
      <Modal
        visible={showRedeemModal}
        onClose={() => { setShowRedeemModal(false); setRedeemCode(''); }}
        title="核销码确认"
      >
        <Text style={ModalStyles.fieldLabel}>请输入6位核销码</Text>
        <TextInput
          style={[ModalStyles.input, styles.codeInput]}
          placeholder="A7K2M9"
          value={redeemCode}
          onChangeText={(t) => setRedeemCode(t.toUpperCase().slice(0, 6).replace(/[^A-Z0-9]/g, ''))}
          maxLength={6}
          textAlign="center"
          autoCapitalize="characters"
        />
        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity
            style={ModalStyles.cancelButton}
            onPress={() => {
              setShowRedeemModal(false);
              setRedeemCode('');
            }}
          >
            <Text style={ModalStyles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ModalStyles.confirmButton, redeemCode.length !== 6 && { opacity: 0.5 }]}
            onPress={handleRedeemSubmit}
            disabled={redeemCode.length !== 6}
          >
            <Text style={[ModalStyles.confirmButtonText, redeemCode.length !== 6 && { color: Colors.neutral400 }]}>
              确认兑现
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={!!proxyItem}
        onClose={() => setProxyItem(null)}
        title="代孩子兑换"
        showCloseButton={true}
      >
        <Text style={styles.proxyIntro}>
          {proxyItem ? `「${proxyItem.name}」将扣除所选孩子账户内的${proxyItem.price_type === 'stars' ? '星星' : '积分'}。` : ''}
        </Text>
        <ScrollView style={styles.proxyList} keyboardShouldPersistTaps="handled">
          {children.map((ch) => (
            <TouchableOpacity
              key={ch.id}
              style={styles.proxyChildRow}
              onPress={() => void handleProxyPurchase(ch.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.proxyChildName}>{ch.name}</Text>
              <Text style={styles.proxyChildBal}>
                💎{ch.current_points} · ⭐{ch.current_stars}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setProxyItem(null)}>
          <Text style={ModalStyles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.neutral900 },
  addBtn: { backgroundColor: Colors.primary500, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.chip },
  addBtnText: { color: Colors.bgCard, fontSize: 13, fontWeight: '600' },
  tabRow: { flexDirection: 'row', marginHorizontal: Spacing.screenPadding, gap: Spacing.xs, marginBottom: Spacing.md },
  tab: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.tab, backgroundColor: Colors.neutral200 },
  tabFlex: { flex: 1 },
  tabRecords: { paddingHorizontal: Spacing.sm + 2 },
  tabRecordsText: { fontSize: Typography.xs },
  tabActive: { backgroundColor: Colors.bgCard, ...Shadows.sm },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.neutral400 },
  tabTextActive: { color: Colors.neutral900 },
  content: { paddingHorizontal: Spacing.screenPadding },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.card, padding: Spacing.md, marginBottom: Spacing.xs,
    ...Shadows.xs,
  },
  itemEmoji: { fontSize: 32 },
  itemInfo: { flex: 1, marginLeft: Spacing.sm },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.neutral900 },
  itemPrice: { fontSize: 12, color: Colors.neutral400, marginTop: 2 },
  itemDesc: { fontSize: 11, color: Colors.neutral400, marginTop: 2 },
  parentOnlyTag: {
    fontSize: 10,
    color: Colors.error,
    fontWeight: '700',
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningLight,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.chip,
    overflow: 'hidden',
  },
  itemActionsCol: { alignItems: 'flex-end', gap: Spacing.xs },
  proxyBtn: {
    backgroundColor: Colors.primary500,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.button,
  },
  proxyBtnText: { color: Colors.bgCard, fontSize: 12, fontWeight: '700' },
  itemActions: { flexDirection: 'row', gap: Spacing.xs },
  editMini: { borderWidth: 1, borderColor: Colors.neutral300, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.chip },
  editText: { fontSize: 11, color: Colors.neutral500, fontWeight: '500' },
  deleteBtn: { borderColor: Colors.errorLight },
  deleteText: { fontSize: 11, color: Colors.error, fontWeight: '500' },

  // 兑换记录
  redeemEntry: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.card, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.infoLight,
  },
  redeemIcon: { fontSize: 22 },
  redeemLabel: { flex: 1, marginLeft: Spacing.sm, fontSize: 14, color: Colors.info, fontWeight: '500' },
  redeemArrow: { fontSize: 24, color: Colors.info },
  recordCard: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.card, padding: Spacing.md, marginBottom: Spacing.xs,
    ...Shadows.xs,
  },
  recordPending: { borderColor: Colors.warningLight, borderWidth: 1.5, backgroundColor: '#FFFBF5' },
  recordLeft: {},
  recordChild: { fontSize: 15, fontWeight: 'bold', color: Colors.neutral900 },
  recordItem: { fontSize: 13, color: Colors.neutral600, marginTop: 2 },
  recordRight: { alignItems: 'flex-end', marginTop: Spacing.xs },
  codeText: { fontSize: 15, fontWeight: 'bold', color: Colors.primary500, letterSpacing: 2 },
  pendingTag: { fontSize: 12, color: Colors.warning, fontWeight: '600' },
  redeemedTag: { fontSize: 12, color: Colors.neutral400 },
  dateText: { fontSize: 11, color: Colors.neutral300, marginTop: 2 },
  confirmRedeemBtn: {
    marginTop: Spacing.xs, backgroundColor: Colors.secondary300, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.button, alignSelf: 'flex-end',
  },
  confirmRedeemText: { color: Colors.bgCard, fontWeight: '600', fontSize: 13 },

  // 空状态
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: Colors.neutral400, marginBottom: Spacing.sm },
  emptyBtn: { backgroundColor: Colors.secondary300, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.button },
  emptyBtnText: { color: Colors.bgCard, fontWeight: '600' },

  // 弹窗特有样式
  codeInput: { letterSpacing: 8, fontSize: 22, fontWeight: 'bold' },
  priceTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  priceTypeBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.button, alignItems: 'center', backgroundColor: Colors.neutral100, borderWidth: 1, borderColor: Colors.neutral200 },
  priceTypeActive: { borderColor: Colors.primary500, backgroundColor: Colors.primary50 },
  priceTypeText: { fontSize: 14, color: Colors.neutral500 },
  priceTypeTextActive: { color: Colors.primary500, fontWeight: '600' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  switchHint: { fontSize: 11, color: Colors.neutral400, marginTop: Spacing.xs },

  proxyIntro: { fontSize: 13, color: Colors.neutral600, marginBottom: Spacing.md, lineHeight: 18 },
  proxyList: { maxHeight: 260 },
  proxyChildRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  proxyChildName: { fontSize: 16, fontWeight: '600', color: Colors.neutral900 },
  proxyChildBal: { fontSize: 13, color: Colors.neutral500 },
});
