import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShopStore } from '@/stores/useShopStore';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { ShopItem, ItemType } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal, { ModalStyles } from '@/components/Modal';
import AppModal from '@/components/AppModal';
import { useModal } from '@/hooks/useModal';

type ShopTab = 'gift' | 'cosmetic' | 'privilege' | 'records';

const TAB_TO_TYPE: Record<string, ItemType> = { gift: 'gift', cosmetic: 'cosmetic', privilege: 'privilege' };
const TYPE_TO_TAB: Record<ItemType, string> = { gift: 'gift', cosmetic: 'cosmetic', privilege: 'privilege' };
const TYPE_EMOJI: Record<ItemType, string> = { gift: '🎁', cosmetic: '👗', privilege: '🎫' };

const TAB_CONFIG: { key: ShopTab; label: string; icon: string }[] = [
  { key: 'gift',      label: '礼物',  icon: '🎁' },
  { key: 'cosmetic',  label: '装扮',  icon: '👗' },
  { key: 'privilege', label: '特权',  icon: '🎫' },
  { key: 'records',   label: '记录',  icon: '📋' },
];

export default function ShopManageScreen() {
  const [tab, setTab] = useState<ShopTab>('gift');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const { modal, showModal, hideModal } = useModal();

  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemPriceType, setItemPriceType] = useState<'points' | 'stars'>('points');
  const [itemStock, setItemStock] = useState('-1');
  const [itemEmoji, setItemEmoji] = useState('🎁');
  const [itemNeedsParent, setItemNeedsParent] = useState(false);
  const [proxyItem, setProxyItem] = useState<ShopItem | null>(null);

  const { items, purchases, isLoading, loadItems, loadPurchases, addItem, updateItem, deleteItem, redeemPurchase, purchaseItem } = useShopStore();
  const { currentFamily, currentChild, children } = useFamilyStore();

  useEffect(() => {
    if (!currentFamily) return;
    loadItems(currentFamily.id);
    children.forEach((child) => loadPurchases(child.id));
  }, [currentFamily, children, loadItems, loadPurchases]);

  const filteredItems = items.filter((item) => {
    const raw = item.item_type;
    const itemType: ItemType = raw === 'gift' || raw === 'cosmetic' || raw === 'privilege' ? raw : 'gift';
    return TYPE_TO_TAB[itemType] === tab;
  });

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getChildName = (childId: string) => children.find((c) => c.id === childId)?.name || '未知';
  const getItemName = (itemId: string) => items.find((i) => i.id === itemId)?.name || '未知商品';

  const openAddModal = () => {
    setEditingItem(null); setItemName(''); setItemDesc(''); setItemPrice('');
    setItemPriceType('points'); setItemStock('-1'); setItemNeedsParent(false);
    setItemEmoji(TAB_TO_TYPE[tab] ? TYPE_EMOJI[TAB_TO_TYPE[tab]] : '🎁');
    setShowAddModal(true);
  };

  const openEditModal = (item: ShopItem) => {
    setEditingItem(item); setItemName(item.name); setItemDesc(item.description || '');
    setItemPrice(String(item.price)); setItemPriceType(item.price_type);
    setItemStock(String(item.stock ?? -1)); setItemNeedsParent(item.parent_approval === 1);
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
      children.forEach((ch) => { void loadPurchases(ch.id); });
      const name = children.find((c) => c.id === childId)?.name ?? '';
      showModal('成功', `已为「${name}」兑换「${snap.name}」`);
    } catch (e) {
      showModal('提示', e instanceof Error ? e.message : '兑换失败');
    }
  };

  const handleSaveItem = async () => {
    if (!itemName.trim()) { showModal('提示', '请输入商品名称'); return; }
    if (!itemPrice || isNaN(Number(itemPrice)) || Number(itemPrice) < 0) { showModal('提示', '请输入有效的价格'); return; }
    if (!currentFamily) { showModal('提示', '未找到家庭信息'); return; }
    const itemData = {
      family_id: currentFamily.id, name: itemName.trim(), description: itemDesc.trim() || null,
      item_type: TAB_TO_TYPE[tab] || 'gift', sub_type: editingItem?.sub_type ?? null,
      price_type: itemPriceType, price: Number(itemPrice),
      stock: itemStock === '-1' ? -1 : (parseInt(itemStock, 10) || 0),
      image: itemEmoji, rarity: 'common' as const, is_preset: 0,
      parent_approval: itemNeedsParent ? 1 : 0,
    };
    try {
      if (editingItem) { await updateItem(editingItem.id, itemData); showModal('成功', '商品已更新'); }
      else { await addItem(itemData); showModal('成功', '商品已添加'); }
      setShowAddModal(false);
      await loadItems(currentFamily.id);
    } catch { showModal('错误', '保存失败，请重试'); }
  };

  const handleDeleteItem = async (item: ShopItem) => {
    showModal('确认删除', `确定要删除商品「${item.name}」吗？`, [
      { text: '取消' },
      { text: '删除', danger: true, onPress: async () => {
        try { await deleteItem(item.id); if (currentFamily) await loadItems(currentFamily.id); }
        catch { showModal('错误', '删除失败'); }
      }},
    ]);
  };

  const handleRedeemSubmit = async () => {
    if (redeemCode.length !== 6) return;
    const purchase = purchases.find(p => p.redeem_code?.toUpperCase() === redeemCode.toUpperCase() && p.status === 'pending');
    if (!purchase) { showModal('提示', '未找到该核销码，或已兑换'); return; }
    try {
      await redeemPurchase(purchase.id);
      showModal('成功', '核销码已确认为已兑现！');
      setShowRedeemModal(false); setRedeemCode('');
      if (currentChild) await loadPurchases(currentChild.id);
    } catch { showModal('错误', '核销失败，请重试'); }
  };

  const handleConfirmRedeem = async (purchaseId: string) => {
    showModal('确认兑现', '确认该商品已兑现给用户？', [
      { text: '取消' },
      { text: '确认', primary: true, onPress: async () => {
        try { await redeemPurchase(purchaseId); if (currentChild) await loadPurchases(currentChild.id); }
        catch { showModal('错误', '核销失败'); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab 栏 */}
      <View style={styles.tabBar}>
        {TAB_CONFIG.map(({ key, label, icon }) => (
          <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setTab(key)} activeOpacity={0.7}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {icon} {label}
            </Text>
            {tab === key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>加载中...</Text></View>
        ) : (
          <>
            {/* 商品列表 */}
            {tab !== 'records' && (
              filteredItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>{TYPE_EMOJI[TAB_TO_TYPE[tab] as ItemType] || '🛍️'}</Text>
                  <Text style={styles.emptyText}>暂无商品</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={openAddModal}>
                    <Ionicons name="add" size={14} color={Colors.bgCard} />
                    <Text style={styles.emptyBtnText}>添加第一个商品</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredItems.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemEmojiWrap}>
                      <Text style={styles.itemEmoji}>{item.image || TYPE_EMOJI[item.item_type] || '🎁'}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemPriceRow}>
                        <Text style={styles.itemPrice}>
                          {item.price_type === 'stars' ? '⭐' : '💎'} {item.price}
                          {item.price_type === 'stars' ? ' 星星' : ' 积分'}
                        </Text>
                        <Text style={styles.itemStock}>
                          {item.stock === -1 ? '∞ 无限' : item.stock > 0 ? `库存 ${item.stock}` : '售罄'}
                        </Text>
                      </View>
                      {item.parent_approval === 1 && (
                        <View style={styles.parentTag}><Text style={styles.parentTagText}>仅家长代兑</Text></View>
                      )}
                      {item.description ? <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text> : null}
                    </View>
                    <View style={styles.itemActions}>
                      {children.length > 0 && (
                        <TouchableOpacity style={styles.proxyBtn} onPress={() => setProxyItem(item)}>
                          <Text style={styles.proxyBtnText}>代兑换</Text>
                        </TouchableOpacity>
                      )}
                      <View style={styles.itemBtns}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(item)}>
                          <Ionicons name="pencil-outline" size={14} color={Colors.neutral500} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconBtn, styles.iconBtnDanger]} onPress={() => handleDeleteItem(item)}>
                          <Ionicons name="trash-outline" size={14} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )
            )}

            {/* 兑换记录 */}
            {tab === 'records' && (
              <>
                <TouchableOpacity style={styles.redeemEntry} onPress={() => setShowRedeemModal(true)} activeOpacity={0.8}>
                  <View style={styles.redeemIconWrap}><Ionicons name="key-outline" size={20} color={Colors.info} /></View>
                  <Text style={styles.redeemLabel}>输入核销码确认兑现</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.info} />
                </TouchableOpacity>

                {purchases.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyText}>暂无兑换记录</Text>
                  </View>
                ) : (
                  purchases.map((p) => (
                    <View key={p.id} style={[styles.recordCard, p.status === 'pending' && styles.recordPending]}>
                      <View style={styles.recordTop}>
                        <Text style={styles.recordChild}>{getChildName(p.child_id)}</Text>
                        <View style={[styles.statusChip, p.status === 'pending' ? styles.chipPending : styles.chipDone]}>
                          <Text style={[styles.chipText, { color: p.status === 'pending' ? Colors.warning : Colors.neutral400 }]}>
                            {p.status === 'pending' ? '待兑现' : '已兑现'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.recordItem}>{getItemName(p.item_id)}</Text>
                      <View style={styles.recordBottom}>
                        {p.redeem_code && <Text style={styles.codeText}>{p.redeem_code}</Text>}
                        <Text style={styles.dateText}>{formatDate(p.purchase_time)}</Text>
                      </View>
                      {p.status === 'pending' && p.redeem_code && (
                        <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirmRedeem(p.id)}>
                          <Ionicons name="checkmark" size={13} color={Colors.bgCard} />
                          <Text style={styles.confirmBtnText}>确认兑现</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* 添加商品 FAB */}
      {tab !== 'records' && (
        <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color={Colors.bgCard} />
        </TouchableOpacity>
      )}

      {/* 添加/编辑商品弹窗 */}
      <Modal visible={showAddModal} onClose={() => setShowAddModal(false)} title={editingItem ? '编辑商品' : '添加商品'} scrollable>
        <View>
          <Text style={ModalStyles.fieldLabel}>商品名称 *</Text>
          <TextInput style={ModalStyles.input} placeholder="例如：去游乐园" value={itemName} onChangeText={setItemName} />
        </View>
        <View>
          <Text style={ModalStyles.fieldLabel}>描述（可选）</Text>
          <TextInput style={[ModalStyles.input, ModalStyles.textArea]} placeholder="详细说明..." value={itemDesc} onChangeText={setItemDesc} multiline numberOfLines={2} />
        </View>
        <View>
          <Text style={ModalStyles.fieldLabel}>价格 *</Text>
          <TextInput style={ModalStyles.input} placeholder="例如：50" value={itemPrice} onChangeText={(t) => setItemPrice(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        </View>
        <View>
          <Text style={ModalStyles.fieldLabel}>价格类型</Text>
          <View style={styles.priceTypeRow}>
            {(['points', 'stars'] as const).map((pt) => (
              <TouchableOpacity key={pt} style={[styles.priceTypeBtn, itemPriceType === pt && styles.priceTypeActive]} onPress={() => setItemPriceType(pt)}>
                <Text style={[styles.priceTypeText, itemPriceType === pt && styles.priceTypeTextActive]}>
                  {pt === 'points' ? '💎 积分' : '⭐ 星星'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View>
          <Text style={ModalStyles.fieldLabel}>库存（-1 表示无限）</Text>
          <TextInput style={ModalStyles.input} placeholder="-1" value={itemStock} onChangeText={(t) => setItemStock(t.replace(/[^0-9-]/g, ''))} keyboardType="numbers-and-punctuation" />
        </View>
        <View>
          <Text style={ModalStyles.fieldLabel}>图标 Emoji</Text>
          <TextInput style={ModalStyles.input} placeholder="🎁" value={itemEmoji} onChangeText={setItemEmoji} maxLength={2} />
        </View>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={ModalStyles.fieldLabel}>仅家长代兑换</Text>
            <Text style={styles.switchHint}>开启后孩子端无法自购</Text>
          </View>
          <Switch value={itemNeedsParent} onValueChange={setItemNeedsParent} trackColor={{ false: Colors.neutral300, true: Colors.primary100 }} thumbColor={itemNeedsParent ? Colors.primary500 : Colors.neutral100} />
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
      <Modal visible={showRedeemModal} onClose={() => { setShowRedeemModal(false); setRedeemCode(''); }} title="核销码确认">
        <Text style={ModalStyles.fieldLabel}>请输入 6 位核销码</Text>
        <TextInput style={[ModalStyles.input, styles.codeInput]} placeholder="A7K2M9" value={redeemCode} onChangeText={(t) => setRedeemCode(t.toUpperCase().slice(0, 6).replace(/[^A-Z0-9]/g, ''))} maxLength={6} textAlign="center" autoCapitalize="characters" />
        <View style={ModalStyles.buttonRow}>
          <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => { setShowRedeemModal(false); setRedeemCode(''); }}>
            <Text style={ModalStyles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ModalStyles.confirmButton, redeemCode.length !== 6 && { opacity: 0.5 }]} onPress={handleRedeemSubmit} disabled={redeemCode.length !== 6}>
            <Text style={ModalStyles.confirmButtonText}>确认兑现</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 代兑换弹窗 */}
      <Modal visible={!!proxyItem} onClose={() => setProxyItem(null)} title="代孩子兑换" showCloseButton>
        <Text style={styles.proxyIntro}>
          {proxyItem ? `「${proxyItem.name}」将扣除所选孩子账户内的${proxyItem.price_type === 'stars' ? '星星' : '积分'}。` : ''}
        </Text>
        <ScrollView style={styles.proxyList} keyboardShouldPersistTaps="handled">
          {children.map((ch) => (
            <TouchableOpacity key={ch.id} style={styles.proxyChildRow} onPress={() => void handleProxyPurchase(ch.id)} activeOpacity={0.75}>
              <Text style={styles.proxyChildName}>{ch.avatar || '👦'} {ch.name}</Text>
              <Text style={styles.proxyChildBal}>💎{ch.current_points} · ⭐{ch.current_stars}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={ModalStyles.cancelButton} onPress={() => setProxyItem(null)}>
          <Text style={ModalStyles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
      </Modal>

      <AppModal state={modal} onClose={hideModal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
    paddingHorizontal: Spacing[2],
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing[3], position: 'relative' },
  tabText: { fontSize: Typography.xs + 1, fontWeight: '600', color: Colors.neutral400 },
  tabTextActive: { color: Colors.primary500 },
  tabIndicator: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, backgroundColor: Colors.primary500, borderRadius: 1 },

  content: { padding: Spacing[4] },

  itemCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius['2xl'],
    padding: Spacing[3] + 2, marginBottom: Spacing[2],
    gap: Spacing[3], ...Shadows.sm,
  },
  itemEmojiWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.bgPrimary, alignItems: 'center', justifyContent: 'center' },
  itemEmoji: { fontSize: 28 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: Typography.base, fontWeight: '700', color: Colors.neutral900, marginBottom: 3 },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemPrice: { fontSize: Typography.sm, color: Colors.primary500, fontWeight: '600' },
  itemStock: { fontSize: Typography.xs, color: Colors.neutral400 },
  itemDesc: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: 2 },
  parentTag: { alignSelf: 'flex-start', backgroundColor: Colors.errorLight, paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.xs, marginTop: 3 },
  parentTagText: { fontSize: Typography.xs - 1, color: Colors.error, fontWeight: '700' },
  itemActions: { alignItems: 'flex-end', gap: Spacing.xs },
  proxyBtn: { backgroundColor: Colors.primary500, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.button },
  proxyBtnText: { color: Colors.bgCard, fontSize: Typography.xs + 1, fontWeight: '700' },
  itemBtns: { flexDirection: 'row', gap: Spacing.xs },
  iconBtn: { width: 30, height: 30, borderRadius: BorderRadius.sm, backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { backgroundColor: Colors.errorLight },

  redeemEntry: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.infoLight, borderRadius: BorderRadius['2xl'],
    padding: Spacing[3] + 2, marginBottom: Spacing[3],
    borderWidth: 1, borderColor: Colors.infoLight,
  },
  redeemIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  redeemLabel: { flex: 1, fontSize: Typography.sm + 1, color: Colors.info, fontWeight: '600' },

  recordCard: { backgroundColor: Colors.bgCard, borderRadius: BorderRadius['2xl'], padding: Spacing[3] + 2, marginBottom: Spacing[2], ...Shadows.xs },
  recordPending: { borderWidth: 1.5, borderColor: Colors.warningBorder, backgroundColor: Colors.warningBgSoft },
  recordTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  recordChild: { fontSize: Typography.base, fontWeight: '700', color: Colors.neutral900 },
  statusChip: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.chip },
  chipPending: { backgroundColor: Colors.warningLight },
  chipDone: { backgroundColor: Colors.neutral100 },
  chipText: { fontSize: Typography.xs, fontWeight: '700' },
  recordItem: { fontSize: Typography.sm + 1, color: Colors.neutral600, marginBottom: Spacing.xs },
  recordBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeText: { fontSize: Typography.base, fontWeight: '800', color: Colors.primary500, letterSpacing: 3 },
  dateText: { fontSize: Typography.xs, color: Colors.neutral400 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: Spacing.sm, backgroundColor: Colors.secondary300, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 1, borderRadius: BorderRadius.button },
  confirmBtnText: { color: Colors.bgCard, fontWeight: '700', fontSize: Typography.xs + 1 },

  emptyState: { paddingVertical: 60, alignItems: 'center', gap: Spacing[2] },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: Typography.base, color: Colors.neutral400 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary500, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.button, marginTop: Spacing[1] },
  emptyBtnText: { color: Colors.bgCard, fontWeight: '600', fontSize: Typography.sm + 1 },

  fab: { position: 'absolute', right: Spacing[5], bottom: Spacing[6], width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary500, alignItems: 'center', justifyContent: 'center', ...Shadows.lg },

  codeInput: { letterSpacing: 8, fontSize: 22, fontWeight: 'bold' },
  priceTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  priceTypeBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.button, alignItems: 'center', backgroundColor: Colors.neutral100, borderWidth: 1, borderColor: Colors.neutral200 },
  priceTypeActive: { borderColor: Colors.primary500, backgroundColor: Colors.primary50 },
  priceTypeText: { fontSize: Typography.sm + 1, color: Colors.neutral500 },
  priceTypeTextActive: { color: Colors.primary500, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, gap: Spacing.sm },
  switchHint: { fontSize: Typography.xs, color: Colors.neutral400, marginTop: 2 },
  proxyIntro: { fontSize: Typography.sm + 1, color: Colors.neutral600, marginBottom: Spacing.md, lineHeight: 20 },
  proxyList: { maxHeight: 260 },
  proxyChildRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.neutral200 },
  proxyChildName: { fontSize: Typography.base + 1, fontWeight: '600', color: Colors.neutral900 },
  proxyChildBal: { fontSize: Typography.sm, color: Colors.neutral500 },
});
