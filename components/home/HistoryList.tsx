import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontSizes, spacing } from '../../styles/global';
import { SubCategoryKey } from '../../constants/categories';

export interface HistoryEntry {
  id: string;
  date: any;
  description?: string;
  dureeSecondes: number;
  categorie: string;
  subCategorie?: SubCategoryKey;
}

interface HistoryListProps {
  entries: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
  formatTimestamp: (value: any) => string;
  formatDuration: (seconds: number) => string;
  resolveCategoryLabel: (category: string) => string;
  resolveSubCategoryLabel: (subCategory?: string) => string;
}

const HistoryList: React.FC<HistoryListProps> = ({
  entries,
  onSelectEntry,
  formatTimestamp,
  formatDuration,
  resolveCategoryLabel,
  resolveSubCategoryLabel,
}) => {
  if (entries.length === 0) {
    return <Text style={styles.emptyHistoryText}>Aucune activité enregistrée encore.</Text>;
  }

  return (
    <>
      {entries.map((entry) => (
        <TouchableOpacity
          key={entry.id}
          style={styles.historyRow}
          activeOpacity={0.8}
          onPress={() => onSelectEntry(entry)}
        >
          <View style={styles.historyTextGroup}>
            <Text style={styles.historyLabel}>{formatTimestamp(entry.date)}</Text>
            <Text style={styles.historyDescription}>{entry.description || 'Sans description'}</Text>
          </View>
          <View style={styles.historyMeta}>
            <Text style={styles.historyDuration}>{formatDuration(entry.dureeSecondes)}</Text>
            <View style={styles.historyCategoryContainer}>
              <Text style={styles.historyCategory}>{resolveCategoryLabel(entry.categorie)}</Text>
              <Text style={styles.historySubCategory}>{resolveSubCategoryLabel(entry.subCategorie)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
};

export default HistoryList;

const styles = StyleSheet.create({
  historyRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightGray,
  },
  historyTextGroup: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.medium,
    gap: 4,
  },
  historyLabel: {
    fontSize: fontSizes.body,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  historyDescription: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    flexShrink: 1,
  },
  historyMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyDuration: {
    fontSize: fontSizes.body,
    fontWeight: '600',
    color: colors.primary,
  },
  historyCategoryContainer: {
    alignItems: 'flex-end',
  },
  historyCategory: {
    fontSize: fontSizes.body,
    color: colors.text,
    fontWeight: '600',
  },
  historySubCategory: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
  emptyHistoryText: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
});
