import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Keyboard,
  Platform,
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
import * as Notifications from 'expo-notifications';

import { addEntreeTemps, getStages } from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { CATEGORY_OPTIONS, SUB_CATEGORY_OPTIONS, SubCategoryKey } from '../constants/categories';
import { colors, fontSizes, spacing, layout } from '../styles/global';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../services/settings';
import {
  clearPomodoroState,
  loadPomodoroState,
  savePomodoroState,
  PersistedPomodoroState,
} from '../services/pomodoroPersistence';
import { handleDurationBlur, handleDurationChange } from '../utils/pomodoroDurations';

const DEFAULT_WORK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroWorkMinutes;
const DEFAULT_BREAK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroBreakMinutes;
const DEFAULT_LONG_BREAK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroLongBreakMinutes;
const TOTAL_SESSIONS = 4;
const POMODORO_STATUS_NOTIFICATION_ID = 'pomodoro-status';
const POMODORO_FINISH_NOTIFICATION_ID = 'pomodoro-finish';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

interface Stage {
  id: string;
  nom: string;
}

type PomodoroRouteParams = {
  preselectedStage?: string;
  preselectedCategory?: string;
  autoStart?: boolean;
  initialDescription?: string;
  taskCardId?: string;
  preselectedSubCategory?: SubCategoryKey;
};

const PomodoroScreen = () => {
  const insets = useSafeAreaInsets();
  const [workDuration, setWorkDuration] = useState(DEFAULT_WORK_MINUTES);
  const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK_MINUTES);
  const [workDurationInput, setWorkDurationInput] = useState(String(DEFAULT_WORK_MINUTES));
  const [breakDurationInput, setBreakDurationInput] = useState(String(DEFAULT_BREAK_MINUTES));
  const [longBreakDuration, setLongBreakDuration] = useState(DEFAULT_LONG_BREAK_MINUTES);
  const [longBreakDurationInput, setLongBreakDurationInput] = useState(String(DEFAULT_LONG_BREAK_MINUTES));
  const [minutes, setMinutes] = useState(DEFAULT_WORK_MINUTES);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isWorkSession, setIsWorkSession] = useState(true);
  const [isLongBreak, setIsLongBreak] = useState(false);
  const [description, setDescription] = useState('Session Pomodoro');
  const [categorie, setCategorie] = useState<string>(
    CATEGORY_OPTIONS.find((option) => option.value === 'autres_pomodoro')?.value ||
      CATEGORY_OPTIONS[0]?.value ||
      '',
  );
  const [subCategory, setSubCategory] = useState<SubCategoryKey>(
    SUB_CATEGORY_OPTIONS[0]?.value ?? 'intervention',
  );
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const [completedSessions, setCompletedSessions] = useState(0);
  const [autoStartBreaks, setAutoStartBreaks] = useState(DEFAULT_SETTINGS.autoStartPomodoroBreaks);
  const [preferredStageId, setPreferredStageId] = useState<string | undefined>(DEFAULT_SETTINGS.defaultStageId);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const phaseEndRef = useRef<number | null>(null);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const notificationsEnabledRef = useRef(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supportsNotifications = Platform.OS !== 'web';

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  }, []);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    },
    [],
  );

  const dismissStatusNotification = useCallback(async () => {
    if (!supportsNotifications) {
      return;
    }
    try {
      await Notifications.dismissNotificationAsync(POMODORO_STATUS_NOTIFICATION_ID);
    } catch {
      // noop
    }
  }, [supportsNotifications]);

  const cancelFinishNotification = useCallback(async () => {
    if (!supportsNotifications) {
      return;
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(POMODORO_FINISH_NOTIFICATION_ID);
    } catch {
      // noop
    }
  }, [supportsNotifications]);

  const cancelAllPomodoroNotifications = useCallback(async () => {
    await dismissStatusNotification();
    await cancelFinishNotification();
  }, [cancelFinishNotification, dismissStatusNotification]);

  const scheduleFinishNotification = useCallback(
    async (durationSeconds: number, phaseType: 'work' | 'break' | 'long-break'): Promise<void> => {
      if (!supportsNotifications || !notificationsEnabledRef.current) {
        return;
      }
      try {
        await cancelFinishNotification();
        const trigger: Notifications.TimeIntervalTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, durationSeconds),
          repeats: false,
        };
        await Notifications.scheduleNotificationAsync({
          identifier: POMODORO_FINISH_NOTIFICATION_ID,
          content: {
            title:
              phaseType === 'work'
                ? 'Session de travail terminée'
                : phaseType === 'long-break'
                  ? 'Longue pause terminée'
                  : 'Pause terminée',
            body:
              phaseType === 'work'
                ? 'Temps de faire une pause.'
                : 'Revenez à votre session de travail.',
            data: {
              notificationType: 'pomodoro',
              phaseType,
            },
          },
          trigger,
        });
      } catch (error) {
        console.error('Error scheduling pomodoro notification:', error);
      }
    },
    [cancelFinishNotification, supportsNotifications],
  );

  const categoryOptions = useMemo<SelectOption[]>(
    () => CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );
  const subCategoryOptions = useMemo<SelectOption[]>(
    () => SUB_CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

  const scheduleNotificationForRemainingTime = useCallback(async () => {
    if (!supportsNotifications || !notificationsEnabledRef.current) {
      return;
    }
    if (!phaseEndRef.current) {
      return;
    }
    const remainingSeconds = Math.max(0, Math.floor((phaseEndRef.current - Date.now()) / 1000));
    if (remainingSeconds <= 0) {
      return;
    }
    const phaseType: 'work' | 'break' | 'long-break' = isWorkSession
      ? 'work'
      : isLongBreak
        ? 'long-break'
        : 'break';

    const endTime = new Date(Date.now() + remainingSeconds * 1000);
    const formattedEndTime = `${String(endTime.getHours()).padStart(2, '0')}:${String(
      endTime.getMinutes(),
    ).padStart(2, '0')}`;
    const statusBody =
      phaseType === 'work'
        ? `Session de travail en cours. Fin prévue à ${formattedEndTime}.`
        : phaseType === 'long-break'
          ? `Longue pause en cours. Fin prévue à ${formattedEndTime}.`
          : `Pause en cours. Fin prévue à ${formattedEndTime}.`;

    try {
      await dismissStatusNotification();
      await Notifications.scheduleNotificationAsync({
        identifier: POMODORO_STATUS_NOTIFICATION_ID,
        content: {
          title: 'Session en cours',
          body: statusBody,
          data: { notificationType: 'pomodoro-status', phaseType },
          sound: false,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing pomodoro status notification:', error);
    }
  }, [dismissStatusNotification, isLongBreak, isWorkSession, supportsNotifications]);

  const route = useRoute<RouteProp<Record<string, PomodoroRouteParams | undefined>, string>>();
  const navigation = useNavigation<any>();
  const routeParams = route.params;
  const [shouldAutoStart, setShouldAutoStart] = useState(routeParams?.autoStart ?? false);
  const [linkedTaskCardId, setLinkedTaskCardId] = useState<string | undefined>(routeParams?.taskCardId);
  const [hasElapsedCurrentSession, setHasElapsedCurrentSession] = useState(false);

  const applySettings = useCallback(
    (incoming: AppSettings) => {
      const {
        defaultPomodoroWorkMinutes: nextWork,
        defaultPomodoroBreakMinutes: nextBreak,
        defaultPomodoroLongBreakMinutes: nextLongBreak,
        autoStartPomodoroBreaks: nextAutoStartBreaks,
        defaultStageId: nextDefaultStageId,
      } = incoming;

      setWorkDuration(nextWork);
      setWorkDurationInput(String(nextWork));
      if (!isActive && isWorkSession && !hasElapsedCurrentSession) {
        setMinutes(nextWork);
        setSeconds(0);
      }

      setBreakDuration(nextBreak);
      setBreakDurationInput(String(nextBreak));
      if (!isActive && !isWorkSession && !isLongBreak && !hasElapsedCurrentSession) {
        setMinutes(nextBreak);
        setSeconds(0);
      }

      setLongBreakDuration(nextLongBreak);
      setLongBreakDurationInput(String(nextLongBreak));
      if (!isActive && !isWorkSession && isLongBreak && !hasElapsedCurrentSession) {
        setMinutes(nextLongBreak);
        setSeconds(0);
      }

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
    [isActive, isWorkSession, isLongBreak, hasElapsedCurrentSession],
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

  const persistSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settingsRef.current, ...partial };
    settingsRef.current = updated;
    try {
      await saveSettings(updated);
    } catch (error) {
      console.error('Error saving pomodoro settings:', error);
    }
  }, []);

  const applyStageSelection = useCallback(
    (availableStages: Stage[]) => {
      if (availableStages.length === 0) {
        return;
      }

      const routeStage = routeParams?.preselectedStage;

      if (routeStage && availableStages.some((stage) => stage.id === routeStage)) {
        setSelectedStage(routeStage);
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

  const refreshStages = useCallback(async () => {
    try {
      const fetchedStages = await getStages();
      const typedStages = (Array.isArray(fetchedStages) ? fetchedStages : []) as Stage[];
      setStages(typedStages);
      applyStageSelection(typedStages);
    } catch (error) {
      console.error('Error fetching stages:', error);
      Alert.alert('Erreur', 'Impossible de charger les stages.');
    }
  }, [applyStageSelection]);

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
        await cancelAllPomodoroNotifications();
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };
    ensureNotificationPermission();
  }, [cancelAllPomodoroNotifications, supportsNotifications]);

  useEffect(() => {
    let isMounted = true;
    const hydrateActivePhase = async () => {
      try {
        const persisted = await loadPomodoroState();
        if (!isMounted || !persisted) {
          return;
        }
        const remainingMs = persisted.phaseEndTimestamp - Date.now();
        if (remainingMs <= 0) {
          await clearPomodoroState();
          return;
        }
        phaseEndRef.current = persisted.phaseEndTimestamp;
        setIsWorkSession(persisted.isWorkSession);
        setIsLongBreak(persisted.isLongBreak);
        setCompletedSessions(persisted.completedSessions ?? 0);
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
        setHasElapsedCurrentSession(true);
        setIsActive(true);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        if (remainingSeconds > 0) {
          const restoredPhaseType: 'work' | 'break' | 'long-break' = persisted.isWorkSession
            ? 'work'
            : persisted.isLongBreak
              ? 'long-break'
              : 'break';
          await scheduleFinishNotification(remainingSeconds, restoredPhaseType);
        }
      } catch (error) {
        console.error('Error restoring pomodoro session:', error);
      }
    };
    hydrateActivePhase();
    return () => {
      isMounted = false;
    };
  }, [clearPomodoroState, scheduleFinishNotification]);

  const persistActivePhase = useCallback(
    (phaseEndTimestamp: number, config: { isWorkSession: boolean; isLongBreak: boolean; completedSessions: number }) => {
      const payload: PersistedPomodoroState = {
        phaseEndTimestamp,
        isWorkSession: config.isWorkSession,
        isLongBreak: config.isLongBreak,
        completedSessions: config.completedSessions,
        categorie,
        subCategorie: subCategory,
        description,
        selectedStage,
        linkedTaskCardId,
      };
      savePomodoroState(payload).catch((error) => {
        console.error('Error saving pomodoro phase:', error);
      });
    },
    [categorie, description, linkedTaskCardId, selectedStage, subCategory],
  );

  const clearPersistedPhase = useCallback(() => {
    clearPomodoroState().catch((error) => {
      console.error('Error clearing pomodoro state:', error);
    });
  }, []);

  const schedulePhaseEnd = useCallback(
    (
      durationSeconds: number,
      overrides?: { isWorkSession?: boolean; isLongBreak?: boolean; completedSessions?: number },
    ) => {
      void cancelFinishNotification();
      void dismissStatusNotification();
      const nextIsWorkSession = overrides?.isWorkSession ?? isWorkSession;
      const nextIsLongBreak = overrides?.isLongBreak ?? isLongBreak;
      const nextCompletedSessions = overrides?.completedSessions ?? completedSessions;
      const phaseEndTimestamp = Date.now() + durationSeconds * 1000;
      phaseEndRef.current = phaseEndTimestamp;
      persistActivePhase(phaseEndTimestamp, {
        isWorkSession: nextIsWorkSession,
        isLongBreak: nextIsLongBreak,
        completedSessions: nextCompletedSessions,
      });
      const nextPhaseType: 'work' | 'break' | 'long-break' = nextIsWorkSession
        ? 'work'
        : nextIsLongBreak
          ? 'long-break'
          : 'break';
      void scheduleFinishNotification(durationSeconds, nextPhaseType);
    },
    [
      cancelFinishNotification,
      completedSessions,
      isLongBreak,
      isWorkSession,
      scheduleFinishNotification,
      dismissStatusNotification,
      persistActivePhase,
    ],
  );

  const clearPhaseEnd = useCallback(() => {
    phaseEndRef.current = null;
    void cancelAllPomodoroNotifications();
    void clearPersistedPhase();
  }, [cancelAllPomodoroNotifications, clearPersistedPhase]);

  const skipBreak = useCallback(() => {
    if (isWorkSession) {
      return;
    }
    const nextPhaseEnd = Date.now() + workDuration * 60 * 1000;
    phaseEndRef.current = nextPhaseEnd;
    setIsWorkSession(true);
    setIsLongBreak(false);
    setMinutes(workDuration);
    setSeconds(0);
    setHasElapsedCurrentSession(false);
    persistActivePhase(nextPhaseEnd, {
      isWorkSession: true,
      isLongBreak: false,
      completedSessions,
    });
    dismissStatusNotification();
    scheduleFinishNotification(workDuration * 60, 'work');
    setIsActive(true);
  }, [
    completedSessions,
    dismissStatusNotification,
    isWorkSession,
    persistActivePhase,
    scheduleFinishNotification,
    workDuration,
  ]);

  const transitionToNextPhase = useCallback(() => {
    const wasWorkSession = isWorkSession;
    Notifications.dismissNotificationAsync(POMODORO_STATUS_NOTIFICATION_ID).catch(() => {});

    if (wasWorkSession && selectedStage) {
      const entryData = {
        dureeSecondes: workDuration * 60,
        categorie,
        subCategorie: subCategory,
        description,
        date: new Date(),
        stageId: selectedStage,
        type: 'pomodoro' as const,
        ...(linkedTaskCardId ? { taskCardId: linkedTaskCardId } : {}),
      };
      addEntreeTemps(entryData)
        .then(() => {
          showToast('Session Pomodoro enregistrée');
        })
        .catch((error) => {
          console.error('Error saving pomodoro session:', error);
          Alert.alert('Erreur', "Impossible d'enregistrer la session.");
        });
    }

    const nextCompletedCount = wasWorkSession ? completedSessions + 1 : completedSessions;
    if (wasWorkSession) {
      setCompletedSessions(nextCompletedCount);
    }

    const shouldTakeLongBreak = wasWorkSession && nextCompletedCount % TOTAL_SESSIONS === 0;
    const nextMinutes = wasWorkSession
      ? shouldTakeLongBreak
        ? longBreakDuration
        : breakDuration
      : workDuration;

    setIsWorkSession(!wasWorkSession);
    setIsLongBreak(wasWorkSession ? shouldTakeLongBreak : false);
    setMinutes(nextMinutes);
    setSeconds(0);
    setHasElapsedCurrentSession(false);

    const shouldAutoStartNextPhase = wasWorkSession && autoStartBreaks;
    setIsActive(shouldAutoStartNextPhase);
    if (shouldAutoStartNextPhase) {
      schedulePhaseEnd(nextMinutes * 60, {
        isWorkSession: !wasWorkSession,
        isLongBreak: wasWorkSession ? shouldTakeLongBreak : false,
        completedSessions: wasWorkSession ? nextCompletedCount : completedSessions,
      });
    } else {
      clearPhaseEnd();
    }
  }, [
    autoStartBreaks,
    breakDuration,
    clearPhaseEnd,
    completedSessions,
    description,
    isWorkSession,
    linkedTaskCardId,
    longBreakDuration,
    schedulePhaseEnd,
    selectedStage,
    subCategory,
    workDuration,
    categorie,
    showToast,
  ]);

  const syncRemainingTime = useCallback(() => {
    if (!phaseEndRef.current) {
      return;
    }
    const remainingMs = phaseEndRef.current - Date.now();
    if (remainingMs <= 0) {
      setMinutes(0);
      setSeconds(0);
      setHasElapsedCurrentSession(true);
      transitionToNextPhase();
      return;
    }
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const nextMinutes = Math.floor(remainingSeconds / 60);
    const nextSeconds = remainingSeconds % 60;
    setMinutes(nextMinutes);
    setSeconds(nextSeconds);
    const totalPhaseSeconds =
      (isWorkSession ? workDuration : isLongBreak ? longBreakDuration : breakDuration) * 60;
    if (remainingSeconds < totalPhaseSeconds) {
      setHasElapsedCurrentSession(true);
    }
  }, [
    breakDuration,
    isLongBreak,
    isWorkSession,
    longBreakDuration,
    transitionToNextPhase,
    workDuration,
  ]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        syncRemainingTime();
      }, 1000);
      syncRemainingTime();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, syncRemainingTime]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = Boolean(appState.current && appState.current.match(/inactive|background/));
      const goingBackground = nextAppState.match(/inactive|background/);
      if (supportsNotifications && appState.current === 'active' && goingBackground) {
        if (isActive) {
          void scheduleNotificationForRemainingTime();
        }
      }
      if (supportsNotifications && wasBackground && nextAppState === 'active') {
        void dismissStatusNotification();
        syncRemainingTime();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [dismissStatusNotification, isActive, scheduleNotificationForRemainingTime, supportsNotifications, syncRemainingTime]);

  const startSession = useCallback(() => {
    if (isActive) {
      return;
    }
    const remainingSeconds = minutes * 60 + seconds;
    if (remainingSeconds <= 0) {
      return;
    }
    schedulePhaseEnd(remainingSeconds, {
      isWorkSession,
      isLongBreak,
      completedSessions,
    });
    setIsActive(true);
  }, [completedSessions, isActive, isLongBreak, isWorkSession, minutes, schedulePhaseEnd, seconds]);

  useEffect(() => {
    if (shouldAutoStart && selectedStage) {
      startSession();
      setShouldAutoStart(false);
      if (routeParams?.autoStart) {
        navigation.setParams({ ...routeParams, autoStart: false });
      }
    }
  }, [shouldAutoStart, selectedStage, startSession, navigation, routeParams]);

  const toggleTimer = useCallback(() => {
    if (isActive) {
      syncRemainingTime();
      setIsActive(false);
      clearPhaseEnd();
      return;
    }
    startSession();
  }, [clearPhaseEnd, isActive, startSession, syncRemainingTime]);

  const handleWorkDurationChange = (value: string) =>
    handleDurationChange(value, setWorkDurationInput, setWorkDuration, {
      isActive,
      hasElapsedCurrentSession,
      onResetProgress: () => setHasElapsedCurrentSession(false),
    });

  const handleBreakDurationChange = (value: string) =>
    handleDurationChange(value, setBreakDurationInput, setBreakDuration, {
      isActive,
      hasElapsedCurrentSession,
      onResetProgress: () => setHasElapsedCurrentSession(false),
    });

  const handleWorkDurationBlur = () => {
    handleDurationBlur(
      workDurationInput,
      workDuration,
      setWorkDurationInput,
      setWorkDuration,
      { persist: persistSettings, settingKey: 'defaultPomodoroWorkMinutes' },
    );
  };

  const handleBreakDurationBlur = () => {
    handleDurationBlur(
      breakDurationInput,
      breakDuration,
      setBreakDurationInput,
      setBreakDuration,
      { persist: persistSettings, settingKey: 'defaultPomodoroBreakMinutes' },
    );
  };

  const handleLongBreakDurationChange = (value: string) =>
    handleDurationChange(value, setLongBreakDurationInput, setLongBreakDuration, {
      isActive,
      hasElapsedCurrentSession,
      onResetProgress: () => setHasElapsedCurrentSession(false),
    });

  const handleStageChange = useCallback(
    (value: string) => {
      setSelectedStage(value);
      setPreferredStageId(value);
      persistSettings({ defaultStageId: value || undefined });
    },
    [persistSettings],
  );

  const handleLongBreakDurationBlur = () => {
    handleDurationBlur(
      longBreakDurationInput,
      longBreakDuration,
      setLongBreakDurationInput,
      setLongBreakDuration,
      { persist: persistSettings, settingKey: 'defaultPomodoroLongBreakMinutes' },
    );
  };

  useEffect(() => {
    if (isActive || hasElapsedCurrentSession) {
      return;
    }

    if (isWorkSession) {
      setMinutes(workDuration);
      setSeconds(0);
    } else {
      const targetBreak = isLongBreak ? longBreakDuration : breakDuration;
      setMinutes(targetBreak);
      setSeconds(0);
    }
  }, [workDuration, breakDuration, longBreakDuration, isWorkSession, isLongBreak, isActive, hasElapsedCurrentSession]);

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
        const entryData = {
          dureeSecondes: effectiveSeconds,
          categorie,
          subCategorie: subCategory,
          description,
          date: new Date(),
          stageId: selectedStage,
          type: 'pomodoro-stop' as const,
          ...(linkedTaskCardId ? { taskCardId: linkedTaskCardId } : {}),
        };
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
      const entryData = {
        dureeSecondes: elapsedSeconds,
        categorie,
        subCategorie: subCategory,
        description,
        date: new Date(),
        stageId: selectedStage,
        type: 'pomodoro' as const,
        ...(linkedTaskCardId ? { taskCardId: linkedTaskCardId } : {}),
      };
      await addEntreeTemps(entryData);
      showToast('Session enregistrée');
      resetTimer();
    } catch (error) {
      console.error('Error saving paused pomodoro session:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer la session.");
    }
  };

  const resetTimer = () => {
    clearPhaseEnd();
    setIsActive(false);
    setIsWorkSession(true);
    setMinutes(workDuration);
    setSeconds(0);
    setCompletedSessions(0);
    setIsLongBreak(false);
    setHasElapsedCurrentSession(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
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
            options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
            placeholder={stages.length === 0 ? 'Aucun stage disponible' : 'Sélectionner un stage'}
            disabled={stages.length === 0 || isActive}
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
