import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PointRecord } from '@/types';
import { dbGetAll } from '@/db/helpers';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

const PAGE_SIZE = 50;

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PointsHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ childId: string }>();
  const childId = params.childId ?? '';

  const [records, setRecords] = useState<PointRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({ earned: 0, spent: 0, starsEarned: 0, starsSpent: 0 });

  const loadRecords = useCallback(async (reset = false) => {
    if (!childId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const rows = await dbGetAll<PointRecord>(
        'SELECT * FROM point_records WHERE child_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [childId, PAGE_SIZE, newOffset]
      );
      if (reset) {
        setRecords(rows);
        setOffset(rows.length);
      } else {
        setRecords((prev) => prev.concat(rows));
        setOffset(newOffset + rows.length);
      }
      setHasMore(rows.length >= PAGE_SIZE);

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
    setOffset(0);
    setHasMore(true);
    void loadRecords(true);
  }, [childId]);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => router.back()}
        style={styles.backBtn}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.neutral800} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>积分明细</Text>
      <View style={styles.headerRight} />
    </View>
  );

  const renderSummary = () => (
    <View style={styles.summaryRow}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>累计获取积分</Text>
        <Text style={[styles.summaryValue, { color: Colors.success }]}>
          +{stats.earned}
        </Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>累计消耗积分</Text>
        <Text style={[styles.summaryValue, { color: Colors.warning }]}>
          -{stats.spent}
        </Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>星星</Text>
        <Text style={[styles.summaryValue, { color: Colors.star }]}>
          +{stats.starsEarned} / -{stats.starsSpent}
        </Text>
      </View>
    </View>
  );

  const renderRecord = (r: PointRecord) => {
    const isPoints = r.currency_type === 'points';
    const isPositive = r.points_change > 0;
    return (
      <View key={r.id} style={styles.recordRow}>
        <View style={styles.recordLeft}>
          <Text style={styles.recordReason} numberOfLines={1}>
            {r.reason || (isPoints ? '积分变动' : '星星变动')}
          </Text>
          <Text style={styles.recordDate}>{formatTime(r.created_at)}</Text>
        </View>
        <Text style={[styles.recordAmount, { color: isPositive ? Colors.success : Colors.error }]}>
          {isPositive ? '+' : ''}{r.points_change} {isPoints ? '积分' : '⭐'}
        </Text>
      </View>
    );
  };

  const renderList = () => {
    if (!childId) {
      return <Text style={styles.emptyText}>缺少用户信息</Text>;
    }
    if (records.length === 0 && !loading) {
      return <Text style={styles.emptyText}>暂无记录</Text>;
    }
    return (
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {records.map(renderRecord)}
        {loading && (
          <ActivityIndicator style={styles.loadingMore} color={Colors.primary500} />
        )}
        {hasMore && !loading && (
          <TouchableOpacity style={styles.loadMore} onPress={() => void loadRecords()}>
            <Text style={styles.loadMoreText}>加载更多</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {renderHeader()}
      {renderSummary()}
      {renderList()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  headerRight: {
    width: 40,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: 10,
    alignItems: 'center',
    ...Shadows.xs,
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
  listContent: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[6],
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: Colors.neutral400,
    fontSize: Typography.sm,
    paddingTop: 100,
  },
  loadingMore: {
    marginVertical: 16,
  },
  loadMore: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  loadMoreText: {
    color: Colors.primary500,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
});
