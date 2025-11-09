import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { addEntreeTemps } from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { CATEGORY_OPTIONS, SUB_CATEGORY_OPTIONS, SubCategoryKey } from '../constants/categories';
import { colors, fontSizes, spacing, layout } from '../styles/global';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../services/settings';
import { clearPomodoroState, loadPomodoroState, savePomodoroState } from '../services/pomodoroPersistence';
import useToast from '../hooks/useToast';
import usePomodoroNotifications from '../hooks/usePomodoroNotifications';
import usePomodoroStages from '../hooks/usePomodoroStages';
import useDurationField from '../hooks/useDurationField';
import usePomodoroTimer from '../hooks/usePomodoroTimer';
import usePomodoroAppStateSync from '../hooks/usePomodoroAppStateSync';
import { buildPomodoroEntry } from '../utils/pomodoroEntries';
import { MainTabParamList, PomodoroRouteParams } from '../types/navigation';

const DEFAULT_WORK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroWorkMinutes;
const DEFAULT_BREAK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroBreakMinutes;
const DEFAULT_LONG_BREAK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroLongBreakMinutes;
const TOTAL_SESSIONS = 4;

const PomodoroScreen = () => {
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('Session Pomodoro');
  const [categorie, setCategorie] = useState<string>(
    CATEGORY_OPTIONS.find((option) => option.value === 'autres_pomodoro')?.value ||
      CATEGORY_OPTIONS[0]?.value ||
      '',
  );
  const [subCategory, setSubCategory] = useState<SubCategoryKey>(
    SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention',
  );
  const [autoStartBreaks, setAutoStartBreaks] = useState(DEFAULT_SETTINGS.autoStartPomodoroBreaks);
  const [preferredStageId, setPreferredStageId] = useState<string | undefined>(DEFAULT_SETTINGS.defaultStageId);
  const [hasElapsedCurrentSession, setHasElapsedCurrentSession] = useState(false);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const timerActiveRef = useRef(false);
  const persistSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settingsRef.current, ...partial };
    settingsRef.current = updated;
    try {
      await saveSettings(updated);
    } catch (error) {
      console.error('Error saving pomodoro settings:', error);
    }
  }, []);
  const resetElapsedSession = useCallback(() => {
    setHasElapsedCurrentSession(false);
  }, []);
  const {
    value: workDuration,
    inputValue: workDurationInput,
    handleChange: handleWorkDurationChange,
    handleBlur: handleWorkDurationBlur,
    syncFromSettings: syncWorkDurationFromSettings,
  } = useDurationField({
    initialMinutes: DEFAULT_WORK_MINUTES,
    isActive: timerActiveRef.current,
    hasElapsedCurrentSession,
    onResetProgress: resetElapsedSession,
    persistSettings,
    settingKey: 'defaultPomodoroWorkMinutes',
  });
  const {
    value: breakDuration,
    inputValue: breakDurationInput,
    handleChange: handleBreakDurationChange,
    handleBlur: handleBreakDurationBlur,
    syncFromSettings: syncBreakDurationFromSettings,
  } = useDurationField({
    initialMinutes: DEFAULT_BREAK_MINUTES,
    isActive: timerActiveRef.current,
    hasElapsedCurrentSession,
    onResetProgress: resetElapsedSession,
    persistSettings,
    settingKey: 'defaultPomodoroBreakMinutes',
  });
  const {
    value: longBreakDuration,
    inputValue: longBreakDurationInput,
    handleChange: handleLongBreakDurationChange,
    handleBlur: handleLongBreakDurationBlur,
    syncFromSettings: syncLongBreakDurationFromSettings,
  } = useDurationField({
    initialMinutes: DEFAULT_LONG_BREAK_MINUTES,
    isActive: timerActiveRef.current,
    hasElapsedCurrentSession,
    onResetProgress: resetElapsedSession,
    persistSettings,
    settingKey: 'defaultPomodoroLongBreakMinutes',
  });
  const { message: toastMessage, visible: toastVisible, showToast } = useToast();
  const {
    supportsNotifications,
    scheduleFinishNotification,
    scheduleStatusNotification,
    cancelFinishNotification,
    dismissStatusNotification,
    cancelAllPomodoroNotifications,
  } = usePomodoroNotifications();

  const categoryOptions = useMemo<SelectOption[]>(
    () => CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );
  const subCategoryOptions = useMemo<SelectOption[]>(
    () => SUB_CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

  const route = useRoute<RouteProp<MainTabParamList, 'Pomodoro'>>();
  const navigation = useNavigation<any>();
  const routeParams = route.params;
  const { stageOptions, hasStages, selectedStage, setSelectedStage, refreshStages } = usePomodoroStages({
    routeStageId: routeParams?.preselectedStage,
    preferredStageId,
  });
  const [shouldAutoStart, setShouldAutoStart] = useState(routeParams?.autoStart ?? false);
  const [linkedTaskCardId, setLinkedTaskCardId] = useState<string | undefined>(routeParams?.taskCardId);

  const getTimerMetadata = useCallback(
    () => ({
      categorie,
      subCategory,
      description,
      selectedStage,
      linkedTaskCardId,
    }),
    [categorie, description, linkedTaskCardId, selectedStage, subCategory],
  );

  const handleAutoLogWorkSession = useCallback(
    async (durationSeconds: number) => {
      if (!selectedStage) {
        return;
      }
      const entryData = buildPomodoroEntry({
        durationSeconds,
        categorie,
        subCategory,
        description,
        stageId: selectedStage,
        type: 'pomodoro',
        taskCardId: linkedTaskCardId,
      });
      await addEntreeTemps(entryData);
      showToast('Session Pomodoro enregistrée');
    },
    [categorie, description, linkedTaskCardId, selectedStage, showToast, subCategory],
  );

  const handleAutoLogError = useCallback((error: unknown) => {
    console.error('Error saving pomodoro session:', error);
    Alert.alert('Erreur', "Impossible d'enregistrer la session.");
  }, []);

  const {
    minutes,
    seconds,
    isActive,
    isWorkSession,
    isLongBreak,
    completedSessions,
    startSession,
    toggleTimer,
    skipBreak,
    resetTimer,
    scheduleNotificationForRemainingTime,
    hydrateFromPersistedState,
    syncNow: syncTimerNow,
  } = usePomodoroTimer({
    workDuration,
    breakDuration,
    longBreakDuration,
    autoStartBreaks,
    hasElapsedCurrentSession,
    setHasElapsedCurrentSession,
    getMetadata: getTimerMetadata,
    scheduleFinishNotification,
    scheduleStatusNotification,
    cancelFinishNotification,
    dismissStatusNotification,
    cancelAllPomodoroNotifications,
    savePomodoroState,
    clearPomodoroState,
    onAutoLogWorkSession: handleAutoLogWorkSession,
    onAutoLogError: handleAutoLogError,
  });
  timerActiveRef.current = isActive;

  useEffect(() => {
    if (shouldAutoStart && selectedStage) {
      startSession();
      setShouldAutoStart(false);
      if (routeParams?.autoStart) {
        navigation.setParams({ ...routeParams, autoStart: false });
      }
    }
  }, [shouldAutoStart, selectedStage, startSession, navigation, routeParams]);

  const handleForegroundResume = useCallback(async () => {
    await dismissStatusNotification();
    syncTimerNow();
  }, [dismissStatusNotification, syncTimerNow]);

  usePomodoroAppStateSync({
    isActive,
    supportsNotifications,
    onBackgroundSchedule: scheduleNotificationForRemainingTime,
    onForegroundResume: handleForegroundResume,
  });

  const applySettings = useCallback(
    (incoming: AppSettings) => {
      const {
        defaultPomodoroWorkMinutes: nextWork,
        defaultPomodoroBreakMinutes: nextBreak,
        defaultPomodoroLongBreakMinutes: nextLongBreak,
        autoStartPomodoroBreaks: nextAutoStartBreaks,
        defaultStageId: nextDefaultStageId,
      } = incoming;

      syncWorkDurationFromSettings(nextWork);
      syncBreakDurationFromSettings(nextBreak);
      syncLongBreakDurationFromSettings(nextLongBreak);

      setAutoStartBreaks(nextAutoStartBreaks);
      setPreferredStageId(nextDefaultStageId);
      if (!isActive && !hasElapsedCurrentSession) {
        setHasElapsedCurrentSession(false);
      }
      settingsRef.current = {
        ...settingsRef.current,
        defaultPomodoroWorkMinutes: nextWork,
        defaultPomodoroBreakMinutes: nextBreak,
        defaultPomodoroLongBreakMinutes: nextLongBreak,
        autoStartPomodoroBreaks: nextAutoStartBreaks,
        defaultStageId: nextDefaultStageId,
      };
    },
    [isActive, hasElapsedCurrentSession, syncWorkDurationFromSettings, syncBreakDurationFromSettings, syncLongBreakDurationFromSettings],
  );

  const loadAndApplySettings = useCallback(async () => {
    try {
      const loaded = await loadSettings();
      settingsRef.current = loaded;
      applySettings(loaded);
    } catch (error) {
      console.error('Error loading pomodoro settings:', error);
    }
  }, [applySettings]);

  useFocusEffect(
    useCallback(() => {
      let isSubscribed = true;
      const run = async () => {
        await loadAndApplySettings();
        if (!isSubscribed) {
          return;
        }
        await refreshStages();
      };
      run();
      return () => {
        isSubscribed = false;
      };
    }, [loadAndApplySettings, refreshStages]),
  );

  useEffect(() => {
    if (routeParams?.preselectedCategory) {
      setCategorie(routeParams.preselectedCategory);
    }
    if (routeParams?.preselectedSubCategory) {
      setSubCategory(routeParams.preselectedSubCategory);
    }
    if (routeParams?.autoStart) {
      setShouldAutoStart(true);
    }
    if (routeParams?.initialDescription) {
      setDescription(routeParams.initialDescription);
    }
    if (routeParams?.taskCardId !== undefined) {
      setLinkedTaskCardId(routeParams.taskCardId);
    } else {
      setLinkedTaskCardId(undefined);
    }
  }, [
    routeParams?.preselectedCategory,
    routeParams?.preselectedSubCategory,
    routeParams?.autoStart,
    routeParams?.initialDescription,
    routeParams?.taskCardId,
  ]);

  useEffect(() => {
    if (!supportsNotifications) {
      return;
    }
    void cancelAllPomodoroNotifications();
  }, [cancelAllPomodoroNotifications, supportsNotifications]);

  useEffect(() => {
    let isMounted = true;
    const hydrateActivePhase = async () => {
      try {
        const persisted = await loadPomodoroState();
        if (!isMounted || !persisted) {
          return;
        }
        const hydrated = await hydrateFromPersistedState(persisted);
        if (!hydrated) {
          return;
        }
        if (persisted.categorie) {
          setCategorie(persisted.categorie);
        }
        if (persisted.subCategorie) {
          setSubCategory(persisted.subCategorie);
        }
        if (typeof persisted.description === 'string') {
          setDescription(persisted.description);
        }
        if (persisted.selectedStage) {
          setSelectedStage(persisted.selectedStage);
        }
        if (persisted.linkedTaskCardId !== undefined) {
          setLinkedTaskCardId(persisted.linkedTaskCardId);
        }
      } catch (error) {
        console.error('Error restoring pomodoro session:', error);
      }
    };
    hydrateActivePhase();
    return () => {
      isMounted = false;
    };
  }, [hydrateFromPersistedState]);

  const handleStageChange = useCallback(
    (value: string) => {
      const normalizedValue = value || undefined;
      setSelectedStage(normalizedValue);
      setPreferredStageId(normalizedValue);
      persistSettings({ defaultStageId: normalizedValue });
    },
    [persistSettings, setPreferredStageId, setSelectedStage],
  );




  const handleStopEarly = async () => {
    if (!selectedStage) {
      Alert.alert('Stage requis', 'Veuillez sélectionner un stage.');
      return;
    }

    if (!isWorkSession) {
      // Stopping during a break should not produce a time entry.
      resetTimer();
      return;
    }

    if (!isActive && minutes === workDuration && seconds === 0 && isWorkSession) {
      return;
    }

    const expectedBreakMinutes = isLongBreak ? longBreakDuration : breakDuration;

    if (!isActive && !isWorkSession && minutes === expectedBreakMinutes && seconds === 0) {
      return;
    }

    const totalPhaseMinutes = isWorkSession ? workDuration : expectedBreakMinutes;
    const elapsedSeconds = totalPhaseMinutes * 60 - (minutes * 60 + seconds);

    const effectiveSeconds = elapsedSeconds > 0 ? elapsedSeconds : 0;

    if (effectiveSeconds > 0) {
      try {
        const entryData = buildPomodoroEntry({
          durationSeconds: effectiveSeconds,
          categorie,
          subCategory,
          description,
          stageId: selectedStage,
          type: 'pomodoro-stop',
          taskCardId: linkedTaskCardId,
        });
        await addEntreeTemps(entryData);
        showToast('Durée écoulée enregistrée');
      } catch (error) {
        console.error('Error saving pomodoro entry:', error);
        Alert.alert('Erreur', "Impossible d'enregistrer le temps.");
      }
    }

    resetTimer();
  };

  const handleSavePausedSession = async () => {
    if (!selectedStage) {
      Alert.alert('Stage requis', 'Veuillez sélectionner un stage.');
      return;
    }
    const elapsedSeconds = workDuration * 60 - (minutes * 60 + seconds);
    if (elapsedSeconds <= 0) {
      return;
    }
    try {
      const entryData = buildPomodoroEntry({
        durationSeconds: elapsedSeconds,
        categorie,
        subCategory,
        description,
        stageId: selectedStage,
        type: 'pomodoro',
        taskCardId: linkedTaskCardId,
      });
      await addEntreeTemps(entryData);
      showToast('Session enregistrée');
      resetTimer();
    } catch (error) {
      console.error('Error saving paused pomodoro session:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer la session.");
    }
  };

  const handleUnlinkTask = () => {
    if (isActive) return;
    setDescription('Session Pomodoro');
    setLinkedTaskCardId(undefined);
  };

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalPhaseSeconds = (isWorkSession ? workDuration : isLongBreak ? longBreakDuration : breakDuration) * 60;
  const remainingSeconds = minutes * 60 + seconds;
  const progressRatio = Math.min(1, Math.max(0, (totalPhaseSeconds - remainingSeconds) / totalPhaseSeconds));
  const completedForDisplay = Math.min(completedSessions, TOTAL_SESSIONS);
  const canLogPausedWork = !isActive && isWorkSession && hasElapsedCurrentSession && workDuration > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.large * 3 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, isWorkSession ? styles.heroWork : styles.heroBreak]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <Ionicons name="flame" size={30} color={colors.white} />
            </View>
            <View>
              <Text style={styles.heroTitle}>Pomodoro</Text>
              <Text style={styles.heroSubtitle}>
                {isActive ? (isWorkSession ? 'Session de travail' : 'Pause en cours') : 'Prêt à démarrer'}
              </Text>
            </View>
          </View>

          <View style={styles.currentTaskBanner}>
            <Ionicons name="clipboard-outline" size={18} color={colors.white} />
            <Text style={styles.currentTaskText}>{description?.trim() || 'Session Pomodoro'}</Text>
            {linkedTaskCardId && !isActive && (
              <TouchableOpacity onPress={handleUnlinkTask} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle-outline" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>

          <Text style={styles.timerText}>{formattedTime}</Text>

          <View style={styles.sessionDots}>
            {Array.from({ length: TOTAL_SESSIONS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.sessionDot,
                  index < completedForDisplay ? styles.sessionDotActive : undefined,
                ]}
              />
            ))}
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={[styles.heroButton, isActive ? styles.heroPauseButton : styles.heroStartButton]}
              onPress={toggleTimer}
            >
              <Ionicons name={isActive ? 'pause' : 'play'} size={20} color={colors.white} />
              <Text style={styles.heroButtonText}>{isActive ? 'Pause' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.heroButton, styles.heroStopButton]} onPress={handleStopEarly}>
              <Ionicons name="stop" size={18} color={colors.white} />
              <Text style={styles.heroButtonText}>Stop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.heroButton, styles.heroResetButton]} onPress={resetTimer}>
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={styles.heroButtonText}>Reset</Text>
            </TouchableOpacity>
            {!isWorkSession && (
              <TouchableOpacity style={[styles.heroButton, styles.heroSkipButton]} onPress={skipBreak}>
                <Ionicons name="play-skip-forward" size={18} color={colors.white} />
                <Text style={styles.heroButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
            {canLogPausedWork && (
              <TouchableOpacity
                style={[styles.heroButton, styles.heroSaveButton]}
                onPress={handleSavePausedSession}
              >
                <Ionicons name="save-outline" size={18} color={colors.white} />
                <Text style={styles.heroButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contexte</Text>
          <SelectInput
            value={selectedStage}
            onValueChange={handleStageChange}
            options={stageOptions}
            placeholder={hasStages ? 'Sélectionner un stage' : 'Aucun stage disponible'}
            disabled={!hasStages || isActive}
          />
          <SelectInput
            value={categorie}
            onValueChange={(value) => setCategorie(value)}
            options={categoryOptions}
            disabled
          />
          <SelectInput
            value={subCategory}
            onValueChange={(value) => setSubCategory(value as SubCategoryKey)}
            options={subCategoryOptions}
            disabled={isActive}
            placeholder="Sous-catégorie"
          />
          <TextInput
            style={styles.input}
            placeholder="Description de la session"
            value={description}
            onChangeText={setDescription}
            editable={!isActive}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Durées</Text>
          <Text style={styles.cardSubtitle}>Personnalisez vos intervalles de travail et de pause.</Text>
          <View style={styles.durationRow}>
            <View style={styles.durationField}>
              <Text style={styles.durationLabel}>Session (min)</Text>
              <TextInput
                style={styles.durationInput}
                value={workDurationInput}
                onChangeText={handleWorkDurationChange}
                onBlur={handleWorkDurationBlur}
                keyboardType="number-pad"
                maxLength={3}
                editable={!isActive}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
            <View style={styles.durationField}>
              <Text style={styles.durationLabel}>Pause (min)</Text>
              <TextInput
                style={styles.durationInput}
                value={breakDurationInput}
                onChangeText={handleBreakDurationChange}
                onBlur={handleBreakDurationBlur}
                keyboardType="number-pad"
                maxLength={3}
                editable={!isActive}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
          </View>
          <View style={styles.durationRow}>
            <View style={styles.durationField}>
              <Text style={styles.durationLabel}>Pause longue (min)</Text>
              <TextInput
                style={styles.durationInput}
                value={longBreakDurationInput}
                onChangeText={handleLongBreakDurationChange}
                onBlur={handleLongBreakDurationBlur}
                keyboardType="number-pad"
                maxLength={3}
                editable={!isActive}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Résumé</Text>
          <View style={styles.statRow}>
            <Ionicons name="flame-outline" size={18} color={colors.primary} />
            <Text style={styles.statLabel}>Durée des sessions</Text>
            <Text style={styles.statValue}>{workDuration} min</Text>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="leaf-outline" size={18} color={colors.secondary} />
            <Text style={styles.statLabel}>Durée des pauses</Text>
            <Text style={styles.statValue}>{breakDuration} min</Text>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
            <Text style={styles.statLabel}>Pause longue</Text>
            <Text style={styles.statValue}>{longBreakDuration} min</Text>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="trail-sign-outline" size={18} color={colors.secondary} />
            <Text style={styles.statLabel}>Sessions complétées</Text>
            <Text style={styles.statValue}>{completedSessions}</Text>
          </View>
        </View>
      </ScrollView>
      {toastVisible && (
        <View
          pointerEvents="none"
          style={[styles.toast, { bottom: insets.bottom + spacing.large }]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
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
    paddingVertical: spacing.large,
    gap: spacing.large,
    alignItems: 'center',
    width: '100%',
  },
  heroCard: {
    borderRadius: 24,
    paddingVertical: spacing.large,
    paddingHorizontal: spacing.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
    gap: spacing.large,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  heroWork: {
    backgroundColor: '#f85a7a',
  },
  heroBreak: {
    backgroundColor: '#2f9e44',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: fontSizes.title + 6,
    fontWeight: '700',
    color: colors.white,
  },
  heroSubtitle: {
    fontSize: fontSizes.body,
    color: 'rgba(255,255,255,0.85)',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.white,
  },
  timerText: {
    fontSize: 80,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  sessionDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.small,
  },
  sessionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  sessionDotActive: {
    backgroundColor: colors.white,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.medium,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  heroButton: {
    flex: 1,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    paddingVertical: spacing.medium,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroStartButton: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  heroPauseButton: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  heroStopButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroResetButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroSkipButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroSaveButton: {
    backgroundColor: colors.accent,
  },
  heroButtonText: {
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
  },
  currentTaskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 12,
  },
  currentTaskText: {
    flex: 1,
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: spacing.large,
    gap: spacing.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
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
  input: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    padding: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.medium,
  },
  durationField: {
    flex: 1,
  },
  durationLabel: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    marginBottom: spacing.small / 2,
  },
  durationInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.subtitle,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    justifyContent: 'space-between',
  },
  statLabel: {
    flex: 1,
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
  statValue: {
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    color: colors.text,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.small,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1000,
    elevation: 10,
  },
  toastText: {
    color: colors.white,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
});

export default PomodoroScreen;
