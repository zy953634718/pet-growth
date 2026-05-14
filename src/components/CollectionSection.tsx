import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { CollectionEntry } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

interface Props {
  entries: CollectionEntry[];
}

export default function CollectionSection({ entries }: Props) {
  if (entries.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📖 我的图鉴</Text>
        <Text style={styles.sectionCount}>共 {entries.length} 只</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {entries.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emoji}>{entry.species_emoji}</Text>
            </View>
            <Text style={styles.petName} numberOfLines={1}>{entry.pet_name}</Text>
            <Text style={styles.speciesName} numberOfLines={1}>{entry.species_display_name}</Text>
            <Text style={styles.date}>
              {new Date(entry.saved_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['4.5'],
    marginBottom: Spacing['3.5'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing['3.5'],
  },
  sectionTitle: {
    fontSize: Typography.lg + 1,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  sectionCount: {
    fontSize: Typography.sm,
    color: Colors.neutral400,
    fontWeight: '600',
  },
  cardRow: {
    gap: Spacing['2.5'],
    paddingRight: Spacing[2],
  },
  card: {
    width: 100,
    backgroundColor: Colors.bgPrimary,
    borderRadius: BorderRadius.lg,
    padding: Spacing['2.5'],
    alignItems: 'center',
    ...Shadows.sm,
  },
  emojiCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgPeachSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  emoji: {
    fontSize: 30,
  },
  petName: {
    fontSize: Typography.sm + 1,
    fontWeight: '700',
    color: Colors.neutral900,
    marginBottom: 1,
  },
  speciesName: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    marginBottom: Spacing[1],
  },
  date: {
    fontSize: Typography.xs - 1,
    color: Colors.neutral300,
  },
});
