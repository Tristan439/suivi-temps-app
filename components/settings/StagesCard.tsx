import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fontSizes, spacing, layout } from '../../styles/global';

interface StageItem {
  id: string;
  nom: string;
}

interface StagesCardProps {
  stages: StageItem[];
  newStageName: string;
  onStageNameChange: (value: string) => void;
  onAddStage: () => void;
  addingStage: boolean;
  editingStageId?: string;
  editingStageName: string;
  onStartEditStage: (stageId: string, stageName: string) => void;
  onChangeEditingStageName: (value: string) => void;
  onConfirmEditStage: () => void;
  onCancelEditStage: () => void;
  onDeleteStage: (stageId: string, stageName: string) => void;
  stageActionLoading: boolean;
}

const StagesCard: React.FC<StagesCardProps> = ({
  stages,
  newStageName,
  onStageNameChange,
  onAddStage,
  addingStage,
  editingStageId,
  editingStageName,
  onStartEditStage,
  onChangeEditingStageName,
  onConfirmEditStage,
  onCancelEditStage,
  onDeleteStage,
  stageActionLoading,
}) => {
  const isAddDisabled = addingStage || stageActionLoading || newStageName.trim() === '';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Stages</Text>
      <Text style={styles.cardSubtitle}>Ajoutez un nouveau stage pour qu&apos;il soit disponible partout.</Text>
      <View style={styles.stageForm}>
        <TextInput
          style={styles.stageInput}
          placeholder="Nom du stage"
          value={newStageName}
          onChangeText={onStageNameChange}
        />
        <TouchableOpacity
          style={[styles.stageAddButton, isAddDisabled && styles.disabledButton]}
          onPress={onAddStage}
          activeOpacity={0.85}
          disabled={isAddDisabled}
        >
          <Text style={styles.stageAddButtonText}>{addingStage ? 'Ajout...' : 'Ajouter'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.stageList}>
        {stages.length === 0 ? (
          <Text style={styles.stageEmptyText}>Aucun stage enregistré pour le moment.</Text>
        ) : (
          stages.map((stage) => (
            <View key={stage.id} style={styles.stageListItem}>
              {editingStageId === stage.id ? (
                <View style={styles.editRow}>
                  <TextInput
                    value={editingStageName}
                    onChangeText={onChangeEditingStageName}
                    style={styles.stageEditInput}
                    placeholder="Nom du stage"
                    editable={!stageActionLoading}
                  />
                  <View style={styles.stageActions}>
                    <TouchableOpacity
                      style={[styles.iconButton, styles.confirmButton, (stageActionLoading || editingStageName.trim() === '') && styles.disabledButton]}
                      onPress={onConfirmEditStage}
                      disabled={stageActionLoading || editingStageName.trim() === ''}
                    >
                      <Ionicons name="checkmark" size={18} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconButton, styles.cancelButton]}
                      onPress={onCancelEditStage}
                      disabled={stageActionLoading}
                    >
                      <Ionicons name="close" size={18} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.displayRow}>
                  <Text style={styles.stageListText}>{stage.nom}</Text>
                  <View style={styles.stageActions}>
                    <TouchableOpacity
                      style={[styles.iconButton, styles.editButton]}
                      onPress={() => onStartEditStage(stage.id, stage.nom)}
                      disabled={stageActionLoading}
                    >
                      <Ionicons name="pencil" size={18} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconButton, styles.deleteButton]}
                      onPress={() => onDeleteStage(stage.id, stage.nom)}
                      disabled={stageActionLoading}
                    >
                      <Ionicons name="trash" size={18} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
};

export default StagesCard;

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
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
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
  stageForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  stageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
  stageAddButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  stageAddButtonText: {
    color: colors.white,
    fontSize: fontSizes.body,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  stageList: {
    gap: spacing.small,
  },
  stageListItem: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    gap: spacing.small,
  },
  stageListText: {
    fontSize: fontSizes.body,
    color: colors.text,
  },
  stageEmptyText: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
  displayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.small,
  },
  stageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButton: {
    backgroundColor: colors.secondary,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  stageEditInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
});
