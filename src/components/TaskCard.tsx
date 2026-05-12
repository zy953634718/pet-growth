import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Task, TASK_STATUS_EMOJI, TASK_STATUS_LABELS, PRIORITY_COLORS, REPEAT_LABELS, CONFIRM_MODE_LABELS } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

interface TaskCardProps {
  task: Task;
  onPress?: () => void;
  onSubmit?: () => void;
  showStatus?: boolean;
}

export default function TaskCard({ task, onPress, onSubmit, showStatus = true }: TaskCardProps) {
  const isCompleted = task.status === 'completed' || task.status === 'submitted';
  const isActive = task.status === 'active' || task.status === 'in_progress';
  const isOverdue = task.status === 'overdue';

  return (
    <TouchableOpacity
      style={[styles.card, isOverdue && styles.overdueCard, isCompleted && styles.completedCard]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress && !onSubmit}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{task.title}</Text>
        {showStatus && (
          <View style={[styles.statusBadge, { backgroundColor: PRIORITY_COLORS[task.priority] + '22' }]}>
            <Text style={[styles.statusText, { color: PRIORITY_COLORS[task.priority] }]}>
              {TASK_STATUS_EMOJI[task.status]} {TASK_STATUS_LABELS[task.status]}
            </Text>
          </View>
        )}
      </View>

      {task.description ? (
        <Text style={styles.desc} numberOfLines={2}>{task.description}</Text>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.reward}>⭐ +{task.points_reward}</Text>
          {task.stars_reward > 0 && (
            <Text style={styles.starReward}> 🌟 +{task.stars_reward}</Text>
          )}
        </View>

        <View style={styles.tags}>
          <Text style={styles.tag}>
            {REPEAT_LABELS[task.repeat_type]}
          </Text>
          <Text style={styles.tag}>
            {CONFIRM_MODE_LABELS[task.confirm_mode]}
          </Text>
        </View>
      </View>

      {isActive && onSubmit && (
        <TouchableOpacity style={styles.submitBtn} onPress={onSubmit}>
          <Text style={styles.submitBtnText}>
            {task.confirm_mode === 'photo' ? '📷 选图并提交' : '✅ 提交完成'}
          </Text>
        </TouchableOpacity>
      )}

      {isCompleted && !task.points_awarded && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>⏳ 等待确认中...</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  overdueCard: {
    borderColor: '#FFCDD2',
    backgroundColor: Colors.primary50,
  },
  completedCard: {
    opacity: 0.75,
    backgroundColor: '#FAFCFA',
    borderColor: '#D0EAD0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral900,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  desc: {
    fontSize: 13,
    color: Colors.neutral500,
    marginBottom: 8,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reward: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary500,
  },
  starReward: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.star,
  },
  tags: {
    flexDirection: 'row',
    gap: 5,
  },
  tag: {
    fontSize: 10,
    color: Colors.neutral400,
    backgroundColor: Colors.neutral100,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  submitBtn: {
    marginTop: 10,
    backgroundColor: Colors.secondary300,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: {
    color: Colors.bgCard,
    fontSize: 14,
    fontWeight: '600',
  },
  pendingBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  pendingText: {
    fontSize: 12,
    color: Colors.warning,
    fontStyle: 'italic',
  },
});
