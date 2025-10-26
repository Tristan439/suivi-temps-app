import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import {
  addEntreeTemps,
  deleteEntreeTemps,
  getCumulsParCategorie,
  getEntreesParMois,
  getStages,
  updateEntreeTemps,
} from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import {
  CATEGORY_KEYS,
  CATEGORY_OPTIONS,
  CATEGORY_SECTIONS,
  CategorySection,
  getAdditionalKeysForSection,
  getCategoryLabel,
  getSectionForCategory,
} from '../constants/categories';
import { colors, fontSizes, spacing } from '../styles/global';

interface Stage {
  id: string;
  nom: string;
}

interface Entree {
  id: string;
  categorie: string;
  description?: string;
  dureeSecondes: number;
  date: any;
  stageId?: string;
  type?: string;
}

const ensureSelectOptions = (options: SelectOption[], value?: string) => {
  if (value && !options.some((option) => option.value === value)) {
    return [...options, { label: value, value }];
  }
  return options;
};

const toDate = (value: any) => {
  if (value instanceof Date) {
    return value;
  }
  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }
  return new Date(value);
};

const secondsToHuman = (seconds = 0) => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
};

const minutesInputToSeconds = (value: string) => {
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 60);
};

const formatEntryTimestamp = (value: any) => {
  const date = toDate(value);
  return `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const HomeScreen = () => {
  const navigation = useNavigation<any>();

  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const [cumuls, setCumuls] = useState<{ [key: string]: number }>({});
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualDuree, setManualDuree] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategorie, setManualCategorie] = useState<string>(CATEGORY_OPTIONS[0]?.value ?? '');

  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entree | null>(null);
  const [entryDescription, setEntryDescription] = useState('');
  const [entryCategorie, setEntryCategorie] = useState<string>(CATEGORY_OPTIONS[0]?.value ?? '');
  const [entryDuree, setEntryDuree] = useState('');
  const [entryStage, setEntryStage] = useState<string | undefined>();
  const [entryDateInfo, setEntryDateInfo] = useState('');

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    supervision: true,
    client: true,
    autres: true,
  });

  const categoryOptions = useMemo<SelectOption[]>(
    () => CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

  const manualCategoryOptions = useMemo(
    () => ensureSelectOptions(categoryOptions, manualCategorie),
    [categoryOptions, manualCategorie],
  );

  const entryCategoryOptions = useMemo(
    () => ensureSelectOptions(categoryOptions, entryCategorie),
    [categoryOptions, entryCategorie],
  );

  const fetchData = async () => {
    setLoading(true);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    try {
      const [fetchedEntrees, fetchedCumuls, fetchedStages] = await Promise.all([
        getEntreesParMois(year, month, selectedStage),
        getCumulsParCategorie(year, month, selectedStage),
        getStages(),
      ]);

      setEntrees(fetchedEntrees as Entree[]);
      setCumuls(fetchedCumuls);
      const typedStages = (Array.isArray(fetchedStages) ? fetchedStages : []) as Stage[];
      setStages(typedStages);

      if (typedStages.length > 0) {
        if (!selectedStage) {
          setSelectedStage(typedStages[0].id);
        } else if (!typedStages.some((stage) => stage.id === selectedStage)) {
          setSelectedStage(typedStages[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les données.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [date, selectedStage]),
  );

  const totalSeconds = useMemo(
    () => Object.values(cumuls).reduce((acc, value) => acc + (value || 0), 0),
    [cumuls],
  );

  const sortedEntries = useMemo(
    () =>
      [...entrees].sort((a, b) => {
        const dateB = toDate(b.date).getTime();
        const dateA = toDate(a.date).getTime();
        return dateB - dateA;
      }),
    [entrees],
  );

  const sectionEntries = useMemo(() => {
    const map: Record<string, Entree[]> = {};
    CATEGORY_SECTIONS.forEach((section) => {
      map[section.id] = [];
    });
    sortedEntries.forEach((entry) => {
      const section = getSectionForCategory(entry.categorie);
      if (section) {
        map[section.id].push(entry);
      }
    });
    return map;
  }, [sortedEntries]);

  const unknownEntries = useMemo(
    () => sortedEntries.filter((entry) => !CATEGORY_KEYS.has(entry.categorie)),
    [sortedEntries],
  );

  const unknownCumuls = useMemo(
    () =>
      Object.entries(cumuls).filter(
        ([key]) => !CATEGORY_KEYS.has(key),
      ) as Array<[string, number]>,
    [cumuls],
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const changeMonth = (increment: number) => {
    setDate((prevDate) => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + increment);
      return newDate;
    });
  };

  const openManualModal = (category?: string) => {
    setManualCategorie(category || CATEGORY_OPTIONS[0]?.value || '');
    setManualDuree('');
    setManualDescription('');
    setManualModalVisible(true);
  };

  const closeEntryModal = () => {
    setEntryModalVisible(false);
    setSelectedEntry(null);
    setEntryDescription('');
    setEntryCategorie(CATEGORY_OPTIONS[0]?.value ?? '');
    setEntryDuree('');
    setEntryStage(undefined);
    setEntryDateInfo('');
  };

  const openEntryModal = (entry: Entree) => {
    const minutesValue = entry.dureeSecondes ? entry.dureeSecondes / 60 : 0;
    const formattedMinutes = Number.isInteger(minutesValue)
      ? String(minutesValue)
      : minutesValue.toFixed(2);
    const entryDate = toDate(entry.date);

    setSelectedEntry(entry);
    setEntryDescription(entry.description || '');
    setEntryCategorie(entry.categorie || CATEGORY_OPTIONS[0]?.value || '');
    setEntryDuree(formattedMinutes);
    setEntryStage(entry.stageId || selectedStage);
    setEntryDateInfo(`${entryDate.toLocaleDateString()} à ${entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    setEntryModalVisible(true);
  };

  const handleStartTimer = (categoryKey: string) => {
    if (!selectedStage) {
      Alert.alert('Stage requis', 'Veuillez sélectionner un stage avant de démarrer un chronomètre.');
      return;
    }
    navigation.navigate('Minuteur', {
      preselectedCategory: categoryKey,
      preselectedStage: selectedStage,
      autoStart: true,
    });
  };

  const handleStartPomodoro = () => {
    if (!selectedStage) {
      Alert.alert('Stage requis', 'Veuillez sélectionner un stage avant de lancer un Pomodoro.');
      return;
    }
    navigation.navigate('Pomodoro', {
      preselectedStage: selectedStage,
      preselectedCategory: 'autres_pomodoro',
      autoStart: true,
    });
  };

  const handleAjoutManuel = async () => {
    const dureeSecondes = minutesInputToSeconds(manualDuree);
    if (!dureeSecondes) {
      Alert.alert('Erreur', 'Veuillez entrer une durée valide en minutes.');
      return;
    }
    if (!selectedStage) {
      Alert.alert('Erreur', 'Veuillez sélectionner un stage.');
      return;
    }

    try {
      await addEntreeTemps({
        dureeSecondes,
        description: manualDescription,
        categorie: manualCategorie,
        date: new Date(),
        stageId: selectedStage,
        type: 'manuel',
      });
      setManualModalVisible(false);
      setManualDuree('');
      setManualDescription('');
      fetchData();
    } catch (error) {
      console.error('Error adding manual entry:', error);
      Alert.alert('Erreur', "Impossible d'ajouter l'entrée manuellement.");
    }
  };

  const handleUpdateEntry = async () => {
    if (!selectedEntry) {
      return;
    }

    const dureeSecondes = minutesInputToSeconds(entryDuree);
    if (!dureeSecondes) {
      Alert.alert('Erreur', 'Veuillez entrer une durée valide en minutes.');
      return;
    }

    const stageIdToSave = entryStage || selectedEntry.stageId;
    if (!stageIdToSave) {
      Alert.alert('Erreur', 'Veuillez sélectionner un stage.');
      return;
    }

    try {
      await updateEntreeTemps(selectedEntry.id, {
        description: entryDescription,
        categorie: entryCategorie,
        stageId: stageIdToSave,
        dureeSecondes,
      });
      closeEntryModal();
      fetchData();
    } catch (error) {
      console.error('Error updating entry:', error);
      Alert.alert('Erreur', "Impossible de mettre à jour l'entrée.");
    }
  };

  const confirmDeleteEntry = () => {
    if (!selectedEntry) {
      return;
    }

    Alert.alert('Supprimer cette entrée ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntreeTemps(selectedEntry.id);
            closeEntryModal();
            fetchData();
          } catch (error) {
            console.error('Error deleting entry:', error);
            Alert.alert('Erreur', "Impossible de supprimer l'entrée.");
          }
        },
      },
    ]);
  };

  const renderHistoryList = (entries: Entree[]) => {
    if (entries.length === 0) {
      return <Text style={styles.emptyHistoryText}>Aucune activité enregistrée encore.</Text>;
    }

    return entries.map((entry) => (
      <TouchableOpacity
        key={entry.id}
        style={styles.historyRow}
        activeOpacity={0.8}
        onPress={() => openEntryModal(entry)}
      >
        <View style={styles.historyTextGroup}>
          <Text style={styles.historyLabel}>{formatEntryTimestamp(entry.date)}</Text>
          <Text style={styles.historyDescription}>{entry.description || 'Sans description'}</Text>
        </View>
        <View style={styles.historyMeta}>
          <Text style={styles.historyDuration}>{secondsToHuman(entry.dureeSecondes)}</Text>
          <Text style={styles.historyCategory}>{getCategoryLabel(entry.categorie)}</Text>
        </View>
      </TouchableOpacity>
    ));
  };

  const renderSection = (section: CategorySection) => {
    const extraKeys = getAdditionalKeysForSection(section.id);
    const sectionTotal = [...section.rows.map((row) => row.key), ...extraKeys].reduce(
      (acc, key) => acc + (cumuls[key] || 0),
      0,
    );
    const isExpanded = expandedSections[section.id] ?? true;

    return (
      <View key={section.id} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionTotalBadge}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTotalText}>
                {sectionTotal > 0 ? secondsToHuman(sectionTotal) : '0 min'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => toggleSection(section.id)} style={styles.sectionToggle}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.darkGray}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionRows}>
          {section.rows.map((row) => (
            <View key={row.key} style={styles.sectionRow}>
              <View style={styles.rowInfo}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <View style={styles.rowTotalBadge}>
                    <Ionicons name="time-outline" size={14} color={colors.primary} />
                    <Text style={styles.rowTotalText}>{secondsToHuman(cumuls[row.key] || 0)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={[styles.iconButton, styles.timerButton]}
                  onPress={() => handleStartTimer(row.key)}
                >
                  <Ionicons name="timer-outline" size={18} color={colors.white} />
                </TouchableOpacity>
                {section.id === 'autres' && (
                  <TouchableOpacity
                    style={[styles.iconButton, styles.pomodoroButton]}
                    onPress={handleStartPomodoro}
                  >
                    <Ionicons name="flame-outline" size={18} color={colors.white} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.iconButton, styles.manualButton]}
                  onPress={() => openManualModal(row.key)}
                >
                  <Ionicons name="add-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
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
            {renderHistoryList(sectionEntries[section.id] || [])}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading && !manualModalVisible && !entryModalVisible ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerCard}>
            <Text style={styles.headerLabel}>Stage</Text>
            <SelectInput
              value={selectedStage}
              onValueChange={setSelectedStage}
              options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
              placeholder={stages.length === 0 ? 'Aucun stage disponible' : 'Sélectionner un stage'}
            />

            <View style={styles.monthSelector}>
              <TouchableOpacity style={styles.monthButton} onPress={() => changeMonth(-1)}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.monthText}>
                {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity style={styles.monthButton} onPress={() => changeMonth(1)}>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryBadge}>
              <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
              <Text style={styles.summaryText}>
                Cumul mensuel: {totalSeconds > 0 ? secondsToHuman(totalSeconds) : '0 min'}
              </Text>
            </View>
          </View>

          {CATEGORY_SECTIONS.map((section) => renderSection(section))}

          {(unknownCumuls.length > 0 || unknownEntries.length > 0) && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Text style={styles.sectionTitle}>Autres catégories</Text>
                  <View style={styles.sectionTotalBadge}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.sectionTotalText}>
                      {unknownCumuls.length > 0
                        ? secondsToHuman(unknownCumuls.reduce((acc, [, value]) => acc + (value || 0), 0))
                        : '0 min'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.sectionRows}>
                {unknownCumuls.map(([key, value]) => (
                  <View key={key} style={styles.sectionRow}>
                    <View style={styles.rowInfo}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowLabel}>{getCategoryLabel(key)}</Text>
                        <View style={styles.rowTotalBadge}>
                          <Ionicons name="time-outline" size={14} color={colors.primary} />
                          <Text style={styles.rowTotalText}>{secondsToHuman(value)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.historyContainer}>
                <View style={styles.historyHeader}>
                  <Ionicons name="time-outline" size={18} color={colors.secondary} />
                  <Text style={styles.historyTitle}>Historique</Text>
                </View>
                {renderHistoryList(unknownEntries)}
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.primaryButton, styles.globalManualButton]} onPress={() => openManualModal()}>
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>Ajouter une entrée manuelle</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={manualModalVisible}
        onRequestClose={() => setManualModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Ajouter une entrée</Text>
            <SelectInput
              value={manualCategorie}
              options={manualCategoryOptions}
              onValueChange={setManualCategorie}
              placeholder="Catégorie"
              style={styles.modalSelect}
            />
            <TextInput
              placeholder="Durée en minutes"
              value={manualDuree}
              onChangeText={setManualDuree}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder="Description"
              value={manualDescription}
              onChangeText={setManualDescription}
              style={styles.input}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleAjoutManuel}>
              <Text style={styles.primaryButtonText}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, styles.secondaryButton]}
              onPress={() => setManualModalVisible(false)}
            >
              <Text style={[styles.primaryButtonText, styles.secondaryButtonText]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={entryModalVisible}
        onRequestClose={closeEntryModal}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Modifier l'entrée</Text>
            {entryDateInfo ? <Text style={styles.modalSubtitle}>{entryDateInfo}</Text> : null}
            <SelectInput
              value={entryStage}
              onValueChange={setEntryStage}
              options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
              placeholder="Sélectionner un stage"
              style={styles.modalSelect}
            />
            <SelectInput
              value={entryCategorie}
              options={entryCategoryOptions}
              onValueChange={setEntryCategorie}
              placeholder="Catégorie"
              style={styles.modalSelect}
            />
            <TextInput
              placeholder="Durée en minutes"
              value={entryDuree}
              onChangeText={setEntryDuree}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder="Description"
              value={entryDescription}
              onChangeText={setEntryDescription}
              style={styles.input}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateEntry}>
              <Text style={styles.primaryButtonText}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, styles.destructiveButton]}
              onPress={confirmDeleteEntry}
            >
              <Text style={styles.primaryButtonText}>Supprimer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, styles.secondaryButton]}
              onPress={closeEntryModal}
            >
              <Text style={[styles.primaryButtonText, styles.secondaryButtonText]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.large,
    paddingBottom: spacing.large,
    gap: spacing.large,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
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
  headerLabel: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  summaryText: {
    fontSize: fontSizes.body,
    color: colors.text,
    fontWeight: '600',
  },
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
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
  },
  sectionTitle: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.text,
  },
  sectionTotalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e7f1ff',
    paddingVertical: spacing.small / 1.5,
    paddingHorizontal: spacing.medium,
    borderRadius: 999,
  },
  sectionTotalText: {
    fontSize: fontSizes.body,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionToggle: {
    padding: spacing.small,
  },
  sectionRows: {
    gap: spacing.medium,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  rowLabel: {
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    color: colors.text,
  },
  rowTotalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e7f1ff',
    paddingVertical: spacing.small / 1.5,
    paddingHorizontal: spacing.medium,
    borderRadius: 999,
  },
  rowTotalText: {
    fontSize: fontSizes.body,
    fontWeight: '700',
    color: colors.primary,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
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
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightGray,
  },
  historyTextGroup: {
    flex: 1,
    paddingRight: spacing.medium,
    gap: 4,
  },
  historyLabel: {
    fontSize: fontSizes.body,
    color: colors.text,
    fontWeight: '600',
  },
  historyDescription: {
    fontSize: fontSizes.body,
    color: colors.secondary,
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
  historyCategory: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
  emptyHistoryText: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.medium,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.small,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
  },
  globalManualButton: {
    marginTop: spacing.large,
  },
  secondaryButton: {
    backgroundColor: colors.lightGray,
    marginTop: spacing.small,
  },
  secondaryButtonText: {
    color: colors.text,
  },
  destructiveButton: {
    backgroundColor: '#dc3545',
    marginTop: spacing.small,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.large,
  },
  modalView: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.large,
    gap: spacing.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  modalTitle: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    textAlign: 'center',
  },
  modalSelect: {
    marginBottom: spacing.small,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    padding: spacing.medium,
    borderRadius: 10,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
});

export default HomeScreen;
