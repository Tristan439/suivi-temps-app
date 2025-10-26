import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  addEntreeTemps,
  deleteEntreeTemps,
  getCumulsParCategorie,
  getEntreesParMois,
  getStages,
  updateEntreeTemps,
} from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import CategorySectionCard, {
  CategoryRowSummary,
} from '../components/home/CategorySectionCard';
import HistoryList, { HistoryEntry } from '../components/home/HistoryList';
import {
  CATEGORY_KEYS,
  CATEGORY_OPTIONS,
  CATEGORY_SECTIONS,
  CategorySection,
  getCategoryLabel,
  getSubCategoryLabel,
  getSectionForCategory,
  SUB_CATEGORY_OPTIONS,
  SUB_CATEGORY_KEYS,
  SubCategoryKey,
} from '../constants/categories';
import { colors, fontSizes, spacing } from '../styles/global';
import { loadSettings } from '../services/settings';

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
  taskCardId?: string;
  subCategorie?: SubCategoryKey;
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

const formatEntryTimestamp = (value: any) => {
  const date = toDate(value);
  return `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const formatDateDisplay = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const [cumuls, setCumuls] = useState<{ [key: string]: number }>({});
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategorie, setManualCategorie] = useState<string>(CATEGORY_OPTIONS[0]?.value ?? '');
  const [manualSubCategory, setManualSubCategory] = useState<SubCategoryKey>(
    SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention',
  );
  const [manualDate, setManualDate] = useState<Date>(new Date());
  const [manualDatePickerVisible, setManualDatePickerVisible] = useState(false);

  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entree | null>(null);
  const [entryDescription, setEntryDescription] = useState('');
  const [entryCategorie, setEntryCategorie] = useState<string>(CATEGORY_OPTIONS[0]?.value ?? '');
  const [entrySubCategory, setEntrySubCategory] = useState<SubCategoryKey>(
    SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention',
  );
  const [entryHours, setEntryHours] = useState(0);
  const [entryMinutes, setEntryMinutes] = useState(0);
  const [entryStage, setEntryStage] = useState<string | undefined>();
  const [entryDateInfo, setEntryDateInfo] = useState('');
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [entryDatePickerVisible, setEntryDatePickerVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(date.getMonth());
  const [selectedYear, setSelectedYear] = useState(date.getFullYear());
  const [preferredStageId, setPreferredStageId] = useState<string | undefined>();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    supervision: true,
    client: true,
    autres: true,
  });

  const categoryOptions = useMemo<SelectOption[]>(
    () => CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

  const subCategoryOptions = useMemo<SelectOption[]>(
    () => SUB_CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

  const manualCategoryOptions = useMemo(
    () => ensureSelectOptions(categoryOptions, manualCategorie),
    [categoryOptions, manualCategorie],
  );

  const manualSubCategoryOptions = useMemo(
    () => ensureSelectOptions(subCategoryOptions, manualSubCategory),
    [subCategoryOptions, manualSubCategory],
  );

  const entryCategoryOptions = useMemo(
    () => ensureSelectOptions(categoryOptions, entryCategorie),
    [categoryOptions, entryCategorie],
  );

  const entrySubCategoryOptions = useMemo(
    () => ensureSelectOptions(subCategoryOptions, entrySubCategory),
    [subCategoryOptions, entrySubCategory],
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, idx) => {
        const label = new Date(2000, idx, 1).toLocaleString('default', { month: 'long' });
        return { label: label.charAt(0).toUpperCase() + label.slice(1), value: idx };
      }),
    [],
  );

  const yearOptions = useMemo(() => {
    const startYear = selectedYear - 10;
    return Array.from({ length: 21 }, (_, idx) => startYear + idx);
  }, [selectedYear]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchSettings = async () => {
        try {
          const settings = await loadSettings();
          if (!isMounted) {
            return;
          }
          setPreferredStageId(settings.defaultStageId);
          if (settings.defaultStageId) {
            setSelectedStage((current) => current ?? settings.defaultStageId);
          }
        } catch (error) {
          console.error('Error loading preferred stage:', error);
        }
      };
      fetchSettings();
      return () => {
        isMounted = false;
      };
    }, []),
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
        const preferredStage =
          preferredStageId && typedStages.some((stage) => stage.id === preferredStageId)
            ? preferredStageId
            : undefined;

        if (!selectedStage) {
          setSelectedStage(preferredStage ?? typedStages[0].id);
        } else if (!typedStages.some((stage) => stage.id === selectedStage)) {
          setSelectedStage(preferredStage ?? typedStages[0].id);
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
    }, [date, selectedStage, preferredStageId]),
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

  const subCategoryTotals = useMemo(() => {
    const totals: Record<string, Record<SubCategoryKey, number>> = {};
    entrees.forEach((entry) => {
      if (!entry.categorie) {
        return;
      }
      const maybeSub = entry.subCategorie as SubCategoryKey | undefined;
      const subKey: SubCategoryKey =
        maybeSub && SUB_CATEGORY_KEYS.has(maybeSub) ? maybeSub : 'intervention';
      if (!totals[entry.categorie]) {
        totals[entry.categorie] = {
          intervention: 0,
          evaluation: 0,
        };
      }
      totals[entry.categorie][subKey] += entry.dureeSecondes || 0;
    });
    return totals;
  }, [entrees]);

  const sectionRowSummaries = useMemo(() => {
    const summaries: Record<string, CategoryRowSummary[]> = {};
    CATEGORY_SECTIONS.forEach((section) => {
      summaries[section.id] = section.rows.map((row) => {
        const categorySubTotals =
          subCategoryTotals[row.key] ?? ({
            intervention: 0,
            evaluation: 0,
          } as Record<SubCategoryKey, number>);
        return {
          key: row.key,
          label: row.label,
          totalSeconds: cumuls[row.key] || 0,
          interventionSeconds: categorySubTotals.intervention ?? 0,
          evaluationSeconds: categorySubTotals.evaluation ?? 0,
        } satisfies CategoryRowSummary;
      });
    });
    return summaries;
  }, [cumuls, subCategoryTotals]);

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

  const handleManualDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setManualDatePickerVisible(false);
    }
    if (selectedDate) {
      setManualDate(selectedDate);
    }
  };

  const handleEntryDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setEntryDatePickerVisible(false);
    }
    if (selectedDate) {
      setEntryDate(selectedDate);
      setEntryDateInfo(
        `${formatDateDisplay(selectedDate)} • ${selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      );
    }
  };

  const toggleMonthPicker = () => {
    setMonthPickerVisible((prevVisible) => {
      const nextVisible = !prevVisible;
      if (nextVisible) {
        setSelectedMonthIndex(date.getMonth());
        setSelectedYear(date.getFullYear());
      }
      return nextVisible;
    });
  };

  const applyMonthPicker = () => {
    setDate(new Date(selectedYear, selectedMonthIndex, 1));
    setMonthPickerVisible(false);
  };

  const cancelMonthPicker = () => {
    setMonthPickerVisible(false);
  };

  const openManualModal = (category?: string) => {
    setManualCategorie(category || CATEGORY_OPTIONS[0]?.value || '');
    setManualSubCategory(SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention');
    setManualHours(0);
    setManualMinutes(0);
    setManualDescription('');
    setManualDate(new Date());
    setManualModalVisible(true);
  };

  const closeEntryModal = () => {
    setEntryModalVisible(false);
    setSelectedEntry(null);
    setEntryDescription('');
    setEntryCategorie(CATEGORY_OPTIONS[0]?.value ?? '');
    setEntrySubCategory(SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention');
    setEntryHours(0);
    setEntryMinutes(0);
    setEntryStage(undefined);
    setEntryDateInfo('');
    setEntryDate(new Date());
    setEntryDatePickerVisible(false);
  };

  const openEntryModal = (entry: Entree) => {
    const totalMinutes = entry.dureeSecondes ? Math.round(entry.dureeSecondes / 60) : 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const entryDate = toDate(entry.date);

    setSelectedEntry(entry);
    setEntryDescription(entry.description || '');
    setEntryCategorie(entry.categorie || CATEGORY_OPTIONS[0]?.value || '');
    const entrySub = entry.subCategorie && SUB_CATEGORY_KEYS.has(entry.subCategorie)
      ? (entry.subCategorie as SubCategoryKey)
      : (SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention');
    setEntrySubCategory(entrySub as SubCategoryKey);
    setEntryHours(hours);
    setEntryMinutes(minutes);
    setEntryStage(entry.stageId || selectedStage);
    setEntryDateInfo(
      `${formatDateDisplay(entryDate)} • ${entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    );
    setEntryDate(entryDate);
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
    const totalMinutes = manualHours * 60 + manualMinutes;
    if (totalMinutes <= 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner une durée valide.');
      return;
    }
    if (!selectedStage) {
      Alert.alert('Erreur', 'Veuillez sélectionner un stage.');
      return;
    }

    try {
      await addEntreeTemps({
        dureeSecondes: totalMinutes * 60,
        description: manualDescription,
        categorie: manualCategorie,
        subCategorie: manualSubCategory,
        date: manualDate,
        stageId: selectedStage,
        type: 'manuel',
      });
      setManualModalVisible(false);
      setManualHours(0);
      setManualMinutes(0);
      setManualDescription('');
      setManualSubCategory(SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention');
      setManualDate(new Date());
      setManualDatePickerVisible(false);
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

    const totalMinutes = entryHours * 60 + entryMinutes;
    if (totalMinutes <= 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner une durée valide.');
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
        subCategorie: entrySubCategory,
        stageId: stageIdToSave,
        dureeSecondes: totalMinutes * 60,
        date: entryDate,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1 }}>
          {loading && !manualModalVisible && !entryModalVisible ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: insets.bottom + spacing.large * 3 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.headerCard}>
                <Text style={styles.headerLabel}>Stage</Text>
                <SelectInput
                  value={selectedStage}
                  onValueChange={setSelectedStage}
                  options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
                  placeholder={
                    stages.length === 0 ? 'Aucun stage disponible' : 'Sélectionner un stage'
                  }
                />

                <View>
                  <TouchableOpacity
                    style={styles.monthPickerButton}
                    onPress={toggleMonthPicker}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar" size={20} color={colors.primary} />
                    <Text style={styles.monthPickerText}>
                      {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  {monthPickerVisible && (
                    <View style={styles.monthPickerWrapper}>
                      <View style={styles.monthPickerRow}>
                        <View style={styles.pickerColumn}>
                          <Text style={styles.pickerLabel}>Mois</Text>
                          <Picker
                            selectedValue={selectedMonthIndex}
                            onValueChange={(value) => setSelectedMonthIndex(Number(value))}
                            style={styles.picker}
                            itemStyle={styles.pickerItem}
                          >
                            {monthOptions.map((option) => (
                              <Picker.Item key={`month-${option.value}`} label={option.label} value={option.value} />
                            ))}
                          </Picker>
                        </View>
                        <View style={styles.pickerColumn}>
                          <Text style={styles.pickerLabel}>Année</Text>
                          <Picker
                            selectedValue={selectedYear}
                            onValueChange={(value) => setSelectedYear(Number(value))}
                            style={styles.picker}
                            itemStyle={styles.pickerItem}
                          >
                            {yearOptions.map((year) => (
                              <Picker.Item key={`year-${year}`} label={`${year}`} value={year} />
                            ))}
                          </Picker>
                        </View>
                      </View>
                      <View style={styles.monthPickerActions}>
                        <TouchableOpacity
                          style={[styles.monthPickerActionButton, styles.monthPickerCancelButton]}
                          onPress={cancelMonthPicker}
                        >
                          <Text style={[styles.monthPickerActionText, styles.monthPickerCancelText]}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.monthPickerActionButton, styles.monthPickerApplyButton]}
                          onPress={applyMonthPicker}
                        >
                          <Text style={[styles.monthPickerActionText, styles.monthPickerApplyText]}>Valider</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.summaryBadge}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                  <Text style={styles.summaryText}>
                    Cumul mensuel: {totalSeconds > 0 ? secondsToHuman(totalSeconds) : '0 min'}
                  </Text>
                </View>
              </View>

              {CATEGORY_SECTIONS.map((section) => (
                <CategorySectionCard
                  key={section.id}
                  section={section}
                  rows={sectionRowSummaries[section.id] || []}
                  isExpanded={expandedSections[section.id] ?? true}
                  onToggle={toggleSection}
                  onStartTimer={handleStartTimer}
                  onStartPomodoro={handleStartPomodoro}
                  onOpenManual={openManualModal}
                  showPomodoroAction={section.id === 'autres'}
                  historyEntries={(sectionEntries[section.id] || []) as HistoryEntry[]}
                  onSelectEntry={openEntryModal}
                  formatTimestamp={formatEntryTimestamp}
                  formatDuration={secondsToHuman}
                  resolveCategoryLabel={getCategoryLabel}
                  resolveSubCategoryLabel={getSubCategoryLabel}
                />
              ))}

              {(unknownCumuls.length > 0 || unknownEntries.length > 0) && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Autres catégories</Text>
                  </View>
                  <View style={styles.sectionRows}>
                    {unknownCumuls.map(([key, value]) => (
                      <View key={key} style={styles.sectionRow}>
                        <View style={styles.rowInfo}>
                          <View style={styles.rowHeader}>
                            <Text style={styles.rowLabel}>{getCategoryLabel(key)}</Text>
                            <View style={styles.rowInlineTotal}>
                              <Ionicons name="time-outline" size={14} color={colors.primary} />
                              <Text style={styles.rowInlineTotalText}>{secondsToHuman(value)}</Text>
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
                    <HistoryList
                      entries={unknownEntries as HistoryEntry[]}
                      onSelectEntry={openEntryModal}
                      formatTimestamp={formatEntryTimestamp}
                      formatDuration={secondsToHuman}
                      resolveCategoryLabel={getCategoryLabel}
                      resolveSubCategoryLabel={getSubCategoryLabel}
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, styles.globalManualButton]}
                onPress={() => openManualModal()}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                <Text style={styles.primaryButtonText}>Ajouter une entrée manuelle</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        <Modal
          animationType="slide"
          transparent
          visible={manualModalVisible}
          onRequestClose={() => setManualModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.centeredView}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={styles.modalScrollView}
              >
              <View style={styles.modalView}>
                <Text style={styles.modalTitle}>Ajouter une entrée</Text>
                <SelectInput
                  value={manualCategorie}
                  options={manualCategoryOptions}
                  onValueChange={setManualCategorie}
                  placeholder="Catégorie"
                  style={styles.modalSelect}
                />
                <SelectInput
                  value={manualSubCategory}
                  options={manualSubCategoryOptions}
                  onValueChange={(value) => setManualSubCategory(value as SubCategoryKey)}
                  placeholder="Sous-catégorie"
                  style={styles.modalSelect}
                />
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setManualDatePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                  <Text style={styles.dateButtonText}>{formatDateDisplay(manualDate)}</Text>
                </TouchableOpacity>
                {manualDatePickerVisible && (
                  <View style={styles.datePickerWrapper}>
                    <DateTimePicker
                      value={manualDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleManualDateChange}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.datePickerClose}
                        onPress={() => setManualDatePickerVisible(false)}
                      >
                        <Text style={styles.datePickerCloseText}>Terminer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <View style={styles.durationPickerContainer}>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Heures</Text>
                    <Picker
                      selectedValue={manualHours}
                      onValueChange={(value) => setManualHours(value)}
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                    >
                      {Array.from({ length: 24 }).map((_, idx) => (
                        <Picker.Item key={`manual-hours-${idx}`} label={`${idx}`} value={idx} />
                      ))}
                    </Picker>
                  </View>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Minutes</Text>
                    <Picker
                      selectedValue={manualMinutes}
                      onValueChange={(value) => setManualMinutes(value)}
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                    >
                      {Array.from({ length: 60 }).map((_, idx) => (
                        <Picker.Item key={`manual-minutes-${idx}`} label={`${idx}`} value={idx} />
                      ))}
                    </Picker>
                  </View>
                </View>
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
                  onPress={() => {
                    setManualModalVisible(false);
                    setManualDatePickerVisible(false);
                  }}
                >
                  <Text style={[styles.primaryButtonText, styles.secondaryButtonText]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

        <Modal
          animationType="slide"
          transparent
          visible={entryModalVisible}
          onRequestClose={closeEntryModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.centeredView}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={styles.modalScrollView}
              >
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
                <SelectInput
                  value={entrySubCategory}
                  options={entrySubCategoryOptions}
                  onValueChange={(value) => setEntrySubCategory(value as SubCategoryKey)}
                  placeholder="Sous-catégorie"
                  style={styles.modalSelect}
                />
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setEntryDatePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                  <Text style={styles.dateButtonText}>{formatDateDisplay(entryDate)}</Text>
                </TouchableOpacity>
                {entryDatePickerVisible && (
                  <View style={styles.datePickerWrapper}>
                    <DateTimePicker
                      value={entryDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleEntryDateChange}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.datePickerClose}
                        onPress={() => setEntryDatePickerVisible(false)}
                      >
                        <Text style={styles.datePickerCloseText}>Terminer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <View style={styles.durationPickerContainer}>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Heures</Text>
                    <Picker
                      selectedValue={entryHours}
                      onValueChange={(value) => setEntryHours(value)}
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                    >
                      {Array.from({ length: 24 }).map((_, idx) => (
                        <Picker.Item key={`entry-hours-${idx}`} label={`${idx}`} value={idx} />
                      ))}
                    </Picker>
                  </View>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Minutes</Text>
                    <Picker
                      selectedValue={entryMinutes}
                      onValueChange={(value) => setEntryMinutes(value)}
                      style={styles.picker}
                      itemStyle={styles.pickerItem}
                    >
                      {Array.from({ length: 60 }).map((_, idx) => (
                        <Picker.Item key={`entry-minutes-${idx}`} label={`${idx}`} value={idx} />
                      ))}
                    </Picker>
                  </View>
                </View>
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
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      </KeyboardAvoidingView>
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
  monthPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    backgroundColor: colors.background,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 12,
  },
  monthPickerText: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  monthPickerWrapper: {
    marginTop: spacing.small,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    gap: spacing.small,
  },
  monthPickerRow: {
    flexDirection: 'row',
    gap: spacing.medium,
  },
  monthPickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.small,
  },
  monthPickerActionButton: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 10,
  },
  monthPickerCancelButton: {
    backgroundColor: colors.background,
  },
  monthPickerApplyButton: {
    backgroundColor: colors.primary,
  },
  monthPickerActionText: {
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  monthPickerCancelText: {
    color: colors.primary,
  },
  monthPickerApplyText: {
    color: colors.white,
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
  rowInlineTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small / 2,
  },
  rowInlineTotalText: {
    fontSize: fontSizes.body,
    fontWeight: '600',
    color: colors.primary,
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
  },
  modalScrollView: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalView: {
    width: '95%',
    maxWidth: 500,
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
  durationPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.medium,
    marginBottom: spacing.medium,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    marginBottom: spacing.small,
  },
  picker: {
    width: '100%',
    height: 150,
  },
  pickerItem: {
    fontSize: fontSizes.title,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    backgroundColor: colors.background,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 12,
  },
  dateButtonText: {
    fontSize: fontSizes.body,
    color: colors.primary,
    fontWeight: '600',
  },
  datePickerWrapper: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.small,
    marginBottom: spacing.small,
  },
  datePickerClose: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  datePickerCloseText: {
    fontSize: fontSizes.body,
    color: colors.primary,
    fontWeight: '600',
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
