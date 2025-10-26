import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { SelectOption } from '../components/SelectInput';
import { addStage, deleteStage, getStages, updateStage } from '../services/firebase';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../services/settings';

interface Stage {
  id: string;
  nom: string;
}

export interface UseSettingsReturn {
  loading: boolean;
  saving: boolean;
  stages: Stage[];
  stageOptions: SelectOption[];
  defaultStageId?: string;
  setDefaultStageId: (value?: string) => void;
  newStageName: string;
  setNewStageName: (value: string) => void;
  addingStage: boolean;
  editingStageId?: string;
  editingStageName: string;
  setEditingStageName: (value: string) => void;
  stageActionLoading: boolean;
  handleAddStage: () => Promise<void>;
  handleStartEditStage: (stageId: string, stageName: string) => void;
  handleCancelEditStage: () => void;
  handleUpdateStageName: () => Promise<void>;
  handleDeleteStage: (stageId: string) => Promise<void>;
  handleSave: () => Promise<void>;
  handleReset: () => Promise<void>;
  loadData: () => Promise<void>;
}

const useSettings = (): UseSettingsReturn => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingStage, setAddingStage] = useState(false);
  const [stageActionLoading, setStageActionLoading] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>(DEFAULT_SETTINGS.defaultStageId);
  const [newStageName, setNewStageName] = useState('');
  const [editingStageId, setEditingStageId] = useState<string | undefined>();
  const [editingStageName, setEditingStageName] = useState('');

  const stageOptions = useMemo<SelectOption[]>(() => {
    const baseOptions = stages.map((stage) => ({ label: stage.nom, value: stage.id }));
    return [{ label: 'Aucun (choisir à la main)', value: '' }, ...baseOptions];
  }, [stages]);

  const refreshStages = useCallback(async () => {
    const fetchedStages = await getStages();
    const typedStages = (Array.isArray(fetchedStages) ? fetchedStages : []) as Stage[];
    setStages(typedStages);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedSettings = await loadSettings();
      setSettings(fetchedSettings);
      setDefaultStageId(fetchedSettings.defaultStageId);
      await refreshStages();
    } catch (error) {
      console.error('Error loading settings data:', error);
      Alert.alert('Erreur', 'Impossible de charger les paramètres.');
    } finally {
      setLoading(false);
    }
  }, [refreshStages]);

  const handleSave = useCallback(async () => {
    const nextSettings: AppSettings = {
      ...settings,
      defaultStageId: defaultStageId ? defaultStageId : undefined,
    };

    setSaving(true);
    try {
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      Alert.alert('Succès', 'Paramètres enregistrés.');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer les paramètres.");
    } finally {
      setSaving(false);
    }
  }, [defaultStageId, settings]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    try {
      await saveSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
      setDefaultStageId(DEFAULT_SETTINGS.defaultStageId);
      Alert.alert('Paramètres réinitialisés', 'Les valeurs par défaut ont été restaurées.');
    } catch (error) {
      console.error('Error resetting settings:', error);
      Alert.alert('Erreur', "Impossible de réinitialiser les paramètres.");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleAddStage = useCallback(async () => {
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
  }, [newStageName, refreshStages]);

  const handleStartEditStage = useCallback((stageId: string, stageName: string) => {
    setEditingStageId(stageId);
    setEditingStageName(stageName);
  }, []);

  const handleCancelEditStage = useCallback(() => {
    setEditingStageId(undefined);
    setEditingStageName('');
  }, []);

  const handleUpdateStageName = useCallback(async () => {
    if (!editingStageId) {
      return;
    }
    const trimmed = editingStageName.trim();
    if (trimmed === '') {
      Alert.alert('Nom manquant', 'Veuillez entrer un nom de stage valide.');
      return;
    }
    setStageActionLoading(true);
    try {
      await updateStage(editingStageId, trimmed);
      await refreshStages();
      handleCancelEditStage();
      Alert.alert('Succès', 'Le stage a été mis à jour.');
    } catch (error) {
      console.error('Error updating stage:', error);
      Alert.alert('Erreur', "Impossible de mettre à jour le stage.");
    } finally {
      setStageActionLoading(false);
    }
  }, [editingStageId, editingStageName, refreshStages, handleCancelEditStage]);

  const handleDeleteStage = useCallback(
    async (stageId: string) => {
      setStageActionLoading(true);
      try {
        await deleteStage(stageId);
        await refreshStages();
        if (defaultStageId === stageId) {
          const updatedSettings = { ...settings, defaultStageId: undefined };
          setDefaultStageId(undefined);
          setSettings(updatedSettings);
          await saveSettings(updatedSettings);
        }
        if (editingStageId === stageId) {
          handleCancelEditStage();
        }
        Alert.alert('Stage supprimé', 'Le stage a bien été supprimé.');
      } catch (error) {
        console.error('Error deleting stage:', error);
        Alert.alert('Erreur', "Impossible de supprimer le stage.");
      } finally {
        setStageActionLoading(false);
      }
    },
    [defaultStageId, settings, refreshStages, editingStageId, handleCancelEditStage],
  );

  return {
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
  };
};

export default useSettings;
