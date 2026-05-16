import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { PointRecord } from '@/types';
import { dbGetAll } from '@/db/helpers';
import { Colors, Typography, Spacing, BorderRadius } from '@/theme';
import Modal from '@/components/Modal';

interface PointsHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  childId: string;
}

const PAGE_SIZE = 50;

export default function PointsHistoryModal({ visible, onClose, childId }: PointsHistoryModalProps) {
  const [records, setRecords] = useState<PointRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({ earned: 0, spent: 0, starsEarned: 0, starsSpent: 0 });

  const loadRecords = useCallback(async (reset = false) => {
    if (!childId) return;
    setLoading(true);
    const newOffset = reset ? 0 : offset;
    try {
      const rows = await dbGetAll<PointRecord>(
        'SELECT * FROM point_records WHERE child_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [childId, PAGE_SIZE, newOffset]
      );
      if (reset) {
        setRecords(rows);
      } else {
        setRecords((prev) => [...prev, ...rows]);
      }
      setHasMore(rows.length >= PAGE_SIZE);
      setOffset(newOffset + rows.length);

      // 计算汇总
      if (reset) {
        const allRows = await dbGetAll<PointRecord>(
          'SELECT * FROM point_records WHERE child_id = ? ORDER BY created_at DESC',
          [childId]
        );
        let earned = 0, spent = 0, starsEarned = 0, starsSpent = 0;
        for (const r of allRows) {
          if (r.currency_type === 'points') {
            if (r.points_change > 0) earned += r.points_change;
            else spent += Math.abs(r.points_change);
          } else {
            if (r.points_change > 0) starsEarned += r.points_change;
            else starsSpent += Math.abs(r.points_change);
          }
        }
        setStats({ earned, spent, starsEarned, starsSpent });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [childId, offset]);

  useEffect(() => {
    if (visible) {
      setOffset(0);
      setHasMore(true);
      void loadRecords(true);
    }
  }, [visible, childId]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      void loadRecords();
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="积分明细" scrollable maxWidth={420}>
      {/* 汇总卡片 */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>累计获取积分</Text>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>+{stats.earned}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>累计消耗积分</Text>
          <Text style={[styles.summaryValue, { color: Colors.warning }]}>-{stats.spent}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>星星</Text>
          <Text style={[styles.summaryValue, { color: Colors.star }]}>+{stats.starsEarned} / -{stats.starsSpent}</Text>
        </View>
      </View>

      {/* 明细列表 — 由 Modal 的 scrollable 提供滚动 */}
      {records.length === 0 && !loading && (
        <Text style={styles.emptyText}>暂无记录</Text>
      )}
      {records.map((r) => {
        const isPoints = r.currency_type === 'points';
        const isPositive = r.points_change > 0;
        return (
          <View key={r.id} style={styles.recordRow}>
            <View style={styles.recordLeft}>
              <Text style={styles.recordReason} numberOfLines={1}>{r.reason || (isPoints ? '积分变动' : '星星变动')}</Text>
              <Text style={styles.recordDate}>
                {new Date(r.created_at).toLocaleDateString('zh-CN', {
                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={[
              styles.recordAmount,
              { color: isPositive ? Colors.success : Colors.error },
            ]}>
              {isPositive ? '+' : ''}{r.points_change} {isPoints ? '积分' : '⭐'}
            </Text>
          </View>
        );
      })}
      {loading && <ActivityIndicator style={{ marginVertical: 16 }} color={Colors.primary500} />}
      {hasMore && !loading && (
        <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>加载更多</Text>
        </TouchableOpacity>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.neutral50,
    borderRadius: BorderRadius.lg,
    padding: 10,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: Typography.xs,
    color: Colors.neutral500,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  list: {
    maxHeight: 400,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  recordLeft: {
    flex: 1,
    marginRight: 12,
  },
  recordReason: {
    fontSize: Typography.sm,
    color: Colors.neutral800,
    fontWeight: '500',
  },
  recordDate: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    marginTop: 2,
  },
  recordAmount: {
    fontSize: Typography.base,
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.neutral400,
    fontSize: Typography.sm,
    paddingVertical: 40,
  },
  loadMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    color: Colors.primary500,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
});
