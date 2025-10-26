import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import SelectInput, { SelectOption } from '../SelectInput';
import { colors, fontSizes, spacing } from '../../styles/global';

interface PreferencesCardProps {
  defaultStageId?: string;
  stageOptions: SelectOption[];
  onStageChange: (value: string) => void;
}

const PreferencesCard: React.FC<PreferencesCardProps> = ({ defaultStageId, stageOptions, onStageChange }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Préférences</Text>
    <Text style={styles.cardSubtitle}>
      Choisissez les paramètres par défaut utilisés lors de la création d&apos;une session.
    </Text>
    <Text style={styles.inputLabel}>Stage par défaut</Text>
    <SelectInput
      value={defaultStageId ?? ''}
      onValueChange={onStageChange}
      options={stageOptions}
      placeholder="Aucun (choisir à la main)"
    />
  </View>
);

export default PreferencesCard;

const styles = StyleSheet.create({
  card: {
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
  cardTitle: {
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
  inputLabel: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    fontWeight: '600',
  },
});
