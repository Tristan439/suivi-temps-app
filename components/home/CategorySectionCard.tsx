import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fontSizes, spacing } from '../../styles/global';
import { CategorySection } from '../../constants/categories';
import HistoryList, { HistoryEntry } from './HistoryList';

export interface CategoryRowSummary {
  key: string;
  label: string;
  totalSeconds: number;
  interventionSeconds: number;
  evaluationSeconds: number;
}

interface CategorySectionCardProps {
  section: CategorySection;
  rows: CategoryRowSummary[];
  isExpanded: boolean;
  onToggle: (sectionId: string) => void;
  onStartTimer: (categoryKey: string) => void;
  onStartPomodoro: () => void;
  onOpenManual: (categoryKey: string) => void;
  showPomodoroAction: boolean;
  historyEntries: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
  formatTimestamp: (value: any) => string;
  formatDuration: (seconds: number) => string;
  resolveCategoryLabel: (category: string) => string;
  resolveSubCategoryLabel: (subCategory?: string) => string;
}

const CategorySectionCard: React.FC<CategorySectionCardProps> = ({
  section,
  rows,
  isExpanded,
  onToggle,
  onStartTimer,
  onStartPomodoro,
  onOpenManual,
  showPomodoroAction,
  historyEntries,
  onSelectEntry,
  formatTimestamp,
  formatDuration,
  resolveCategoryLabel,
  resolveSubCategoryLabel,
}) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <TouchableOpacity onPress={() => onToggle(section.id)} style={styles.sectionToggle}>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.darkGray} />
      </TouchableOpacity>
    </View>

    <View style={styles.sectionRows}>
      {rows.map((row) => (
        <View key={row.key} style={styles.sectionRow}>
          <View style={styles.rowInfo}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <View style={styles.rowActionsTop}>
                <TouchableOpacity
                  style={[styles.iconButton, styles.timerButton]}
                  onPress={() => onStartTimer(row.key)}
                >
                  <Ionicons name="timer-outline" size={18} color={colors.white} />
                </TouchableOpacity>
                {showPomodoroAction && (
                  <TouchableOpacity
                    style={[styles.iconButton, styles.pomodoroButton]}
                    onPress={onStartPomodoro}
                  >
                    <Ionicons name="flame-outline" size={18} color={colors.white} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.iconButton, styles.manualButton]}
                  onPress={() => onOpenManual(row.key)}
                >
                  <Ionicons name="add-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.rowSubTotals}>
              <View style={[styles.rowSubBadge, styles.rowSubBadgeIntervention]}>
                <Text style={[styles.rowSubBadgeLabel, styles.rowSubBadgeInterventionLabel]}>Intervention</Text>
                <Text style={[styles.rowSubBadgeValue, styles.rowSubBadgeInterventionValue]}>
                  {formatDuration(row.interventionSeconds)}
                </Text>
              </View>
              <View style={[styles.rowSubBadge, styles.rowSubBadgeEvaluation]}>
                <Text style={[styles.rowSubBadgeLabel, styles.rowSubBadgeEvaluationLabel]}>Évaluation</Text>
                <Text style={[styles.rowSubBadgeValue, styles.rowSubBadgeEvaluationValue]}>
                  {formatDuration(row.evaluationSeconds)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>

    {isExpanded && (
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Ionicons name="time-outline" size={18} color={colors.secondary} />
          <Text style={styles.historyTitle}>Historique</Text>
        </View>
        <HistoryList
          entries={historyEntries}
          onSelectEntry={onSelectEntry}
          formatTimestamp={formatTimestamp}
          formatDuration={formatDuration}
          resolveCategoryLabel={resolveCategoryLabel}
          resolveSubCategoryLabel={resolveSubCategoryLabel}
        />
      </View>
    )}
  </View>
);

export default CategorySectionCard;

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    gap: spacing.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.text,
  },
  sectionToggle: {
    padding: spacing.small,
  },
  sectionRows: {
    gap: spacing.medium,
  },
  sectionRow: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.medium,
  },
  rowInfo: {
    flex: 1,
    gap: spacing.small,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
    width: '100%',
  },
  rowLabel: {
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  rowActionsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  timerButton: {
    backgroundColor: colors.primary,
  },
  manualButton: {
    backgroundColor: colors.white,
  },
  pomodoroButton: {
    backgroundColor: '#f06595',
    borderColor: '#f06595',
  },
  rowSubTotals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
    marginTop: spacing.small,
  },
  rowSubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small / 2,
    paddingVertical: spacing.small / 2,
    paddingHorizontal: spacing.medium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowSubBadgeLabel: {
    fontSize: fontSizes.body,
    fontWeight: '500',
    color: colors.text,
  },
  rowSubBadgeValue: {
    fontSize: fontSizes.body,
    fontWeight: '700',
    color: colors.text,
  },
  rowSubBadgeIntervention: {
    backgroundColor: '#e7f1ff',
    borderColor: 'rgba(64, 123, 255, 0.25)',
  },
  rowSubBadgeInterventionLabel: {
    color: colors.primary,
  },
  rowSubBadgeInterventionValue: {
    color: colors.primary,
  },
  rowSubBadgeEvaluation: {
    backgroundColor: '#e6f4ea',
    borderColor: 'rgba(47, 158, 68, 0.25)',
  },
  rowSubBadgeEvaluationLabel: {
    color: '#2F9E44',
  },
  rowSubBadgeEvaluationValue: {
    color: '#2F9E44',
  },
  historyContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.medium,
    gap: spacing.small,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  historyTitle: {
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    color: colors.secondary,
  },
});
