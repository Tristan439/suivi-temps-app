import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

import { addEntreeTemps, getStages } from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { CATEGORY_OPTIONS, SUB_CATEGORY_OPTIONS, SubCategoryKey } from '../constants/categories';
import { colors, fontSizes, spacing, layout } from '../styles/global';
import { loadSettings, updateSettings } from '../services/settings';
import { PersistedTimerState, loadTimerState, saveTimerState } from '../services/timerPersistence';

interface Stage {
  id: string;
  nom: string;
}

type TimerRouteParams = {
  preselectedCategory?: string;
  preselectedStage?: string;
  autoStart?: boolean;
  preselectedSubCategory?: SubCategoryKey;
};

const TIMER_REMINDER_DELAY_SECONDS = 60;

const TimerScreen = () => {
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState<string>(CATEGORY_OPTIONS[0]?.value ?? '');
  const [subCategory, setSubCategory] = useState<SubCategoryKey>(
    SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention',
  );
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const [preferredStageId, setPreferredStageId] = useState<string | undefined>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const elapsedBeforeStartRef = useRef(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const notificationIdRef = useRef<string | null>(null);
  const notificationsEnabledRef = useRef(false);
  const hydrationReadyRef = useRef(false);
  const [hydrationReady, setHydrationReady] = useState(false);
  const supportsNotifications = Platform.OS !== 'web';

  const route = useRoute<RouteProp<Record<string, TimerRouteParams | undefined>, string>>();
  const routeParams = route.params;
  const navigation = useNavigation<any>();
  const [shouldAutoStart, setShouldAutoStart] = useState(routeParams?.autoStart ?? false);

  const categoryOptions = useMemo<SelectOption[]>(
    () => CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );
  const subCategoryOptions = useMemo<SelectOption[]>(
    () => SUB_CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

  const ensureIntervalCleared = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const computeElapsedSeconds = useCallback(() => {
    const base = elapsedBeforeStartRef.current;
    if (!startTimestampRef.current) {
      return base;
    }
    const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - startTimestampRef.current) / 1000));
    return base + elapsedSinceStart;
  }, []);

  const syncDisplayedTime = useCallback(() => {
    const total = computeElapsedSeconds();
    setTime(total);
    return total;
  }, [computeElapsedSeconds]);

  const persistTimerState = useCallback(
    (overrides?: Partial<PersistedTimerState>, force = false) => {
      if (!hydrationReadyRef.current && !force) {
        return;
      }

      const hasOverride = <K extends keyof PersistedTimerState>(key: K) =>
        overrides ? Object.prototype.hasOwnProperty.call(overrides, key) : false;

      const nextIsRunning = hasOverride('isRunning')
        ? overrides?.isRunning ?? false
        : isRunning;
      const nextStartTimestamp = hasOverride('startTimestamp')
        ? overrides?.startTimestamp ?? null
        : startTimestampRef.current ?? null;
      const nextElapsed = hasOverride('elapsedSeconds')
        ? overrides?.elapsedSeconds ?? 0
        : elapsedBeforeStartRef.current;
      const nextNotificationId = hasOverride('notificationId')
        ? overrides?.notificationId ?? undefined
        : notificationIdRef.current ?? undefined;

      const payload: PersistedTimerState = {
        isRunning: nextIsRunning,
        startTimestamp: nextStartTimestamp,
        elapsedSeconds: nextElapsed,
        categorie: hasOverride('categorie') ? overrides?.categorie : categorie,
        subCategorie: hasOverride('subCategorie') ? overrides?.subCategorie : subCategory,
        description: hasOverride('description') ? overrides?.description : description,
        selectedStage: hasOverride('selectedStage') ? overrides?.selectedStage : selectedStage,
        notificationId: nextNotificationId,
      };

      saveTimerState(payload).catch((error) => {
        console.error('Error saving timer state:', error);
      });
    },
    [categorie, description, isRunning, selectedStage, subCategory],
  );

  const cancelScheduledNotification = useCallback(async () => {
    if (!supportsNotifications) {
      return;
    }
    if (!notificationIdRef.current) {
      return;
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
    } catch (error) {
      console.error('Error cancelling timer notification:', error);
    } finally {
      notificationIdRef.current = null;
    }
  }, []);

  const scheduleReminderNotification = useCallback(async (): Promise<string | null> => {
    if (!supportsNotifications || !notificationsEnabledRef.current || TIMER_REMINDER_DELAY_SECONDS <= 0) {
      return null;
    }
    try {
      await cancelScheduledNotification();
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Chronomètre en cours',
          body: 'Touchez pour revenir et arrêter le chronomètre.',
        },
        trigger: { seconds: TIMER_REMINDER_DELAY_SECONDS },
      });
      notificationIdRef.current = id;
      return id;
    } catch (error) {
      console.error('Error scheduling timer notification:', error);
      return null;
    }
  }, [cancelScheduledNotification]);

  const scheduleBackgroundReminder = useCallback(async () => {
    const id = await scheduleReminderNotification();
    if (id) {
      persistTimerState({ notificationId: id }, true);
    }
  }, [persistTimerState, scheduleReminderNotification]);

  const persistDefaultStage = useCallback(async (stageId?: string) => {
    try {
      await updateSettings({ defaultStageId: stageId });
    } catch (error) {
      console.error('Error saving default stage:', error);
    }
  }, []);

  const applyStageSelection = useCallback(
    (availableStages: Stage[]) => {
      if (availableStages.length === 0) {
        return;
      }

      if (routeParams?.preselectedStage && availableStages.some((stage) => stage.id === routeParams.preselectedStage)) {
        setSelectedStage(routeParams.preselectedStage);
        return;
      }

      if (preferredStageId && availableStages.some((stage) => stage.id === preferredStageId)) {
        setSelectedStage((current) => {
          if (current && availableStages.some((stage) => stage.id === current)) {
            return current;
          }
          return preferredStageId;
        });
        return;
      }

      setSelectedStage((current) => {
        if (current && availableStages.some((stage) => stage.id === current)) {
          return current;
        }
        return availableStages[0].id;
      });
    },
    [preferredStageId, routeParams?.preselectedStage],
  );

  useEffect(() => {
    const fetchStages = async () => {
      try {
        const fetchedStages = await getStages();
        const typedStages = (Array.isArray(fetchedStages) ? fetchedStages : []) as Stage[];
        setStages(typedStages);
        applyStageSelection(typedStages);
      } catch (error) {
        console.error('Error fetching stages:', error);
        Alert.alert('Erreur', 'Impossible de charger les stages.');
      }
    };
    fetchStages();
  }, [routeParams?.preselectedStage, applyStageSelection]);

  useEffect(() => {
    if (stages.length > 0) {
      applyStageSelection(stages);
    }
  }, [stages, applyStageSelection]);

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
  }, [routeParams?.preselectedCategory, routeParams?.preselectedSubCategory, routeParams?.autoStart]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadPreferredStage = async () => {
        try {
          const settings = await loadSettings();
          if (!isMounted) {
            return;
          }
          setPreferredStageId(settings.defaultStageId);
        } catch (error) {
          console.error('Error loading timer preferences:', error);
        }
      };
      loadPreferredStage();
      return () => {
        isMounted = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!supportsNotifications) {
      return;
    }
    const ensureNotificationPermission = async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let granted =
          existing.granted ||
          existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        if (!granted) {
          const request = await Notifications.requestPermissionsAsync();
          granted =
            request.granted ||
            request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        }
        notificationsEnabledRef.current = Boolean(granted);
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };
    ensureNotificationPermission();
  }, [supportsNotifications]);

  useEffect(() => {
    let isMounted = true;
    const hydrateTimerState = async () => {
      try {
        const stored = await loadTimerState();
        if (!isMounted || !stored) {
          return;
        }
        if (stored.categorie) {
          setCategorie(stored.categorie);
        }
        if (stored.subCategorie) {
          setSubCategory(stored.subCategorie);
        }
        if (typeof stored.description === 'string') {
          setDescription(stored.description);
        }
        if (stored.selectedStage) {
          setSelectedStage(stored.selectedStage);
        }
        notificationIdRef.current = stored.notificationId ?? null;
        elapsedBeforeStartRef.current = stored.elapsedSeconds ?? 0;
        setTime(stored.elapsedSeconds ?? 0);
        if (stored.isRunning && typeof stored.startTimestamp === 'number') {
          startTimestampRef.current = stored.startTimestamp;
          setIsRunning(true);
          intervalRef.current = setInterval(() => {
            syncDisplayedTime();
          }, 1000);
          syncDisplayedTime();
        } else {
          setIsRunning(false);
          startTimestampRef.current = stored.startTimestamp ?? null;
        }
      } catch (error) {
        console.error('Error restoring timer state:', error);
      } finally {
        if (isMounted) {
          hydrationReadyRef.current = true;
          setHydrationReady(true);
        }
      }
    };
    hydrateTimerState();
    return () => {
      isMounted = false;
    };
  }, [syncDisplayedTime]);

  useEffect(() => {
    return () => {
      ensureIntervalCleared();
      void cancelScheduledNotification();
    };
  }, [ensureIntervalCleared, cancelScheduledNotification]);

  const startTimer = useCallback(() => {
    if (isRunning) {
      return;
    }
    elapsedBeforeStartRef.current = time;
    startTimestampRef.current = Date.now();
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      syncDisplayedTime();
    }, 1000);
    syncDisplayedTime();
    persistTimerState(
      {
        isRunning: true,
        startTimestamp: startTimestampRef.current,
        elapsedSeconds: elapsedBeforeStartRef.current,
        notificationId: undefined,
      },
      true,
    );
  }, [isRunning, persistTimerState, syncDisplayedTime, time]);

  const pauseTimer = useCallback(() => {
    if (!isRunning) {
      return;
    }
    const total = syncDisplayedTime();
    elapsedBeforeStartRef.current = total;
    startTimestampRef.current = null;
    setIsRunning(false);
    ensureIntervalCleared();
    void cancelScheduledNotification().then(() => {
      persistTimerState(
        {
          isRunning: false,
          startTimestamp: null,
          elapsedSeconds: elapsedBeforeStartRef.current,
          notificationId: undefined,
        },
        true,
      );
    });
  }, [cancelScheduledNotification, ensureIntervalCleared, isRunning, persistTimerState, syncDisplayedTime]);

  const stopTimer = useCallback(async () => {
    const totalElapsed = syncDisplayedTime();
    elapsedBeforeStartRef.current = totalElapsed;
    startTimestampRef.current = null;
    ensureIntervalCleared();
    setIsRunning(false);
    await cancelScheduledNotification();
    if (totalElapsed < 1) {
      Alert.alert('Erreur', 'Le minuteur doit tourner pendant au moins une seconde.');
      return;
    }
    if (!selectedStage) {
      Alert.alert('Erreur', 'Veuillez sélectionner un stage.');
      return;
    }

    try {
      await addEntreeTemps({
        dureeSecondes: totalElapsed,
        categorie,
        subCategorie: subCategory,
        description,
        date: new Date(),
        stageId: selectedStage,
        type: 'chrono',
      });
      Alert.alert('Succès', 'Votre temps a été enregistré.');
      elapsedBeforeStartRef.current = 0;
      setTime(0);
      setDescription('');
      persistTimerState(
        {
          isRunning: false,
          startTimestamp: null,
          elapsedSeconds: 0,
          description: '',
          notificationId: undefined,
        },
        true,
      );
    } catch (error) {
      console.error('Error saving time entry:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer votre temps.");
    }
  }, [
    cancelScheduledNotification,
    categorie,
    ensureIntervalCleared,
    persistTimerState,
    selectedStage,
    subCategory,
    syncDisplayedTime,
    description,
  ]);

  const handleStageChange = useCallback(
    (value: string) => {
      const stageId = value || undefined;
      setSelectedStage(stageId);
      setPreferredStageId(stageId);
      persistDefaultStage(stageId);
      persistTimerState({ selectedStage: stageId }, true);
    },
    [persistDefaultStage, persistTimerState],
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategorie(value);
      persistTimerState({ categorie: value }, true);
    },
    [persistTimerState],
  );

  const handleSubCategoryChange = useCallback(
    (value: string) => {
      const typed = value as SubCategoryKey;
      setSubCategory(typed);
      persistTimerState({ subCategorie: typed }, true);
    },
    [persistTimerState],
  );

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setDescription(value);
      persistTimerState({ description: value }, true);
    },
    [persistTimerState],
  );

  useEffect(() => {
    if (shouldAutoStart && selectedStage) {
      startTimer();
      setShouldAutoStart(false);
      if (routeParams?.autoStart) {
        navigation.setParams({ ...routeParams, autoStart: false });
      }
    }
  }, [shouldAutoStart, selectedStage, startTimer, navigation, routeParams]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = Boolean(appState.current && appState.current.match(/inactive|background/));
      const goingBackground = Boolean(nextAppState.match(/inactive|background/));
      if (supportsNotifications && appState.current === 'active' && goingBackground) {
        if (isRunning) {
          void scheduleBackgroundReminder();
        }
      }
      if (supportsNotifications && wasBackground && nextAppState === 'active') {
        void cancelScheduledNotification().then(() => {
          persistTimerState({ notificationId: undefined }, true);
        });
        syncDisplayedTime();
      } else if (wasBackground && nextAppState === 'active') {
        syncDisplayedTime();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [
    cancelScheduledNotification,
    isRunning,
    persistTimerState,
    scheduleBackgroundReminder,
    supportsNotifications,
    syncDisplayedTime,
  ]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.large * 3 },
          ]}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode='on-drag'
          onScrollBeginDrag={() => Keyboard.dismiss()}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.timerCard}>
            <Text style={styles.timerDisplay}>{formatTime(time)}</Text>
          </View>

          <View style={styles.controlsContainer}>
            <SelectInput
              value={selectedStage}
              onValueChange={handleStageChange}
              options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
              placeholder={stages.length === 0 ? 'Aucun stage disponible' : 'Sélectionner un stage'}
              disabled={stages.length === 0 || isRunning}
            />
            <SelectInput
              value={categorie}
              onValueChange={handleCategoryChange}
              options={categoryOptions}
              disabled={isRunning}
            />
            <SelectInput
              value={subCategory}
              onValueChange={handleSubCategoryChange}
              options={subCategoryOptions}
              disabled={isRunning}
              placeholder='Sous-catégorie'
            />
            <TextInput
              style={styles.input}
              placeholder='Description'
              value={description}
              onChangeText={handleDescriptionChange}
              editable={!isRunning}
              returnKeyType='done'
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, isRunning ? styles.pauseButton : styles.startButton]}
              onPress={isRunning ? pauseTimer : startTimer}
            >
              <Text style={styles.buttonText}>{isRunning ? 'Pause' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopTimer}>
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.large,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  timerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: spacing.large,
    paddingHorizontal: spacing.large,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
  },
  timerDisplay: {
    fontSize: 60,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 2,
  },
  controlsContainer: {
    gap: spacing.medium,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    padding: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.medium,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.medium,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  startButton: {
    backgroundColor: colors.primary,
  },
  pauseButton: {
    backgroundColor: colors.secondary,
  },
  stopButton: {
    backgroundColor: colors.accent,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
  },
});

export default TimerScreen;
