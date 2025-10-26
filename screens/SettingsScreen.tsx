import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, fontSizes, spacing } from '../styles/global';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { addStage, getStages } from '../services/firebase';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '../services/settings';

interface Stage {
  id: string;
  nom: string;
}

const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [defaultStageId, setDefaultStageId] = useState<string | undefined>(DEFAULT_SETTINGS.defaultStageId);
  const [newStageName, setNewStageName] = useState('');
  const [addingStage, setAddingStage] = useState(false);

  const stageOptions = useMemo<SelectOption[]>(() => {
    const baseOptions = stages.map((stage) => ({ label: stage.nom, value: stage.id }));
    return [{ label: 'Aucun (choisir à la main)', value: '' }, ...baseOptions];
  }, [stages]);

  const syncInputsFromSettings = useCallback((nextSettings: AppSettings) => {
    setDefaultStageId(nextSettings.defaultStageId);
  }, []);

  const refreshStages = useCallback(async () => {
    const fetchedStages = await getStages();
    const typedStages = (Array.isArray(fetchedStages) ? fetchedStages : []) as Stage[];
    setStages(typedStages);
    return typedStages;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedSettings = await loadSettings();
      setSettings(fetchedSettings);
      syncInputsFromSettings(fetchedSettings);
      await refreshStages();
    } catch (error) {
      console.error('Error loading settings data:', error);
      Alert.alert('Erreur', 'Impossible de charger les paramètres.');
    } finally {
      setLoading(false);
    }
  }, [refreshStages, syncInputsFromSettings]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleSave = async () => {
    const nextSettings: AppSettings = {
      ...settings,
      defaultStageId: defaultStageId ? defaultStageId : undefined,
    };

    setSaving(true);
    try {
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      syncInputsFromSettings(nextSettings);
      Alert.alert('Succès', 'Paramètres enregistrés.');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer les paramètres.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStage = async () => {
    const trimmed = newStageName.trim();
    if (trimmed === '') {
      Alert.alert('Nom manquant', 'Veuillez entrer un nom de stage.');
      return;
    }

    setAddingStage(true);
    try {
      await addStage(trimmed);
      setNewStageName('');
      await refreshStages();
      Alert.alert('Succès', 'Le stage a été ajouté.');
    } catch (error) {
      console.error('Error adding stage:', error);
      Alert.alert('Erreur', "Impossible d'ajouter le stage.");
    } finally {
      setAddingStage(false);
    }
  };

  const handleReset = async () => {
    syncInputsFromSettings(DEFAULT_SETTINGS);
    setSaving(true);
    try {
      await saveSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
      Alert.alert('Paramètres réinitialisés', 'Les valeurs par défaut ont été restaurées.');
    } catch (error) {
      console.error('Error resetting settings:', error);
      Alert.alert('Erreur', "Impossible de réinitialiser les paramètres.");
    } finally {
      setSaving(false);
    }
  };

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
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Préférences</Text>
          <Text style={styles.cardSubtitle}>
            Choisissez les paramètres par défaut utilisés lors de la création d&apos;une session.
          </Text>
          <Text style={styles.inputLabel}>Stage par défaut</Text>
          <SelectInput
            value={defaultStageId ?? ''}
            onValueChange={(value) => setDefaultStageId(value || undefined)}
            options={stageOptions}
            placeholder="Aucun (choisir à la main)"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stages</Text>
          <Text style={styles.cardSubtitle}>Ajoutez un nouveau stage pour qu&apos;il soit disponible partout.</Text>
          <View style={styles.stageForm}>
            <TextInput
              style={styles.stageInput}
              placeholder="Nom du stage"
              value={newStageName}
              onChangeText={setNewStageName}
            />
            <TouchableOpacity
              style={[
                styles.stageAddButton,
                (addingStage || newStageName.trim() === '') && styles.disabledButton,
              ]}
              onPress={handleAddStage}
              activeOpacity={0.85}
              disabled={addingStage || newStageName.trim() === ''}
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
                  <Text style={styles.stageListText}>{stage.nom}</Text>
                </View>
              ))
            )}
          </View>
        </View>

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
  },
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
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.medium,
    alignItems: 'center',
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
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
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
  stageList: {
    gap: spacing.small,
  },
  stageListItem: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  stageListText: {
    fontSize: fontSizes.body,
    color: colors.text,
  },
  stageEmptyText: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
});

export default SettingsScreen;
