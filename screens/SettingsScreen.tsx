import React, { useCallback } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { signOut } from 'firebase/auth';

import PreferencesCard from '../components/settings/PreferencesCard';
import StagesCard from '../components/settings/StagesCard';
import useSettings from '../hooks/useSettings';
import { colors, fontSizes, spacing, layout } from '../styles/global';
import { auth } from '../services/firebase';

const SettingsScreen = () => {
  const {
    loading,
    saving,
    stages,
    stageOptions,
    defaultStageId,
    setDefaultStageId,
    newStageName,
    setNewStageName,
    addingStage,
    editingStageId,
    editingStageName,
    setEditingStageName,
    stageActionLoading,
    handleAddStage,
    handleStartEditStage,
    handleCancelEditStage,
    handleUpdateStageName,
    handleDeleteStage,
    handleSave,
    handleReset,
    loadData,
  } = useSettings();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const confirmDeleteStage = useCallback(
    (stageId: string, stageName: string) => {
      void handleDeleteStage(stageId);
    },
    [handleDeleteStage],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Chargement des paramètres...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.large * 3 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PreferencesCard
          defaultStageId={defaultStageId}
          stageOptions={stageOptions}
          onStageChange={(value) => setDefaultStageId(value || undefined)}
        />

        <StagesCard
          stages={stages}
          newStageName={newStageName}
          onStageNameChange={setNewStageName}
          onAddStage={handleAddStage}
          addingStage={addingStage}
          editingStageId={editingStageId}
          editingStageName={editingStageName}
          onStartEditStage={handleStartEditStage}
          onChangeEditingStageName={setEditingStageName}
          onConfirmEditStage={handleUpdateStageName}
          onCancelEditStage={handleCancelEditStage}
          onDeleteStage={confirmDeleteStage}
          stageActionLoading={stageActionLoading}
        />

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, saving && styles.disabledButton]}
          onPress={handleReset}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.secondaryButtonText}>Réinitialiser</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutButton, signingOut && styles.disabledButton]}
          onPress={async () => {
            if (signingOut) {
              return;
            }
            setSigningOut(true);
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Erreur', "La déconnexion a échoué. Veuillez réessayer.");
            } finally {
              setSigningOut(false);
            }
          }}
          activeOpacity={0.85}
          disabled={signingOut}
        >
          <Text style={styles.logoutButtonText}>{signingOut ? 'Déconnexion...' : 'Se déconnecter'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium,
  },
  loaderText: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
  scrollContent: {
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.large,
    gap: spacing.large,
    alignItems: 'center',
    width: '100%',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.medium,
    alignItems: 'center',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.medium,
    alignItems: 'center',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  logoutButton: {
    marginTop: spacing.large,
    backgroundColor: '#dc3545',
    borderRadius: 14,
    paddingVertical: spacing.medium,
    alignItems: 'center',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
  },
});

export default SettingsScreen;
