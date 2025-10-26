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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { addEntreeTemps, getStages } from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { CATEGORY_OPTIONS } from '../constants/categories';
import { colors, fontSizes, spacing } from '../styles/global';
import { AppSettings, DEFAULT_SETTINGS, loadSettings } from '../services/settings';

const DEFAULT_WORK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroWorkMinutes;
const DEFAULT_BREAK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroBreakMinutes;
const DEFAULT_LONG_BREAK_MINUTES = DEFAULT_SETTINGS.defaultPomodoroLongBreakMinutes;
const TOTAL_SESSIONS = 4;

interface Stage {
  id: string;
  nom: string;
}

type PomodoroRouteParams = {
  preselectedStage?: string;
  preselectedCategory?: string;
  autoStart?: boolean;
};

const PomodoroScreen = () => {
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
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const [completedSessions, setCompletedSessions] = useState(0);
  const [autoStartBreaks, setAutoStartBreaks] = useState(DEFAULT_SETTINGS.autoStartPomodoroBreaks);
  const [preferredStageId, setPreferredStageId] = useState<string | undefined>(DEFAULT_SETTINGS.defaultStageId);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const categoryOptions = useMemo<SelectOption[]>(
    () => CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

  const route = useRoute<RouteProp<Record<string, PomodoroRouteParams | undefined>, string>>();
  const navigation = useNavigation<any>();
  const routeParams = route.params;
  const [shouldAutoStart, setShouldAutoStart] = useState(routeParams?.autoStart ?? false);

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
      if (!isActive && isWorkSession) {
        setMinutes(nextWork);
        setSeconds(0);
      }

      setBreakDuration(nextBreak);
      setBreakDurationInput(String(nextBreak));
      if (!isActive && !isWorkSession && !isLongBreak) {
        setMinutes(nextBreak);
        setSeconds(0);
      }

      setLongBreakDuration(nextLongBreak);
      setLongBreakDurationInput(String(nextLongBreak));
      if (!isActive && !isWorkSession && isLongBreak) {
        setMinutes(nextLongBreak);
        setSeconds(0);
      }

      setAutoStartBreaks(nextAutoStartBreaks);
      setPreferredStageId(nextDefaultStageId);
    },
    [isActive, isWorkSession, isLongBreak],
  );

  const loadAndApplySettings = useCallback(async () => {
    try {
      const loaded = await loadSettings();
      applySettings(loaded);
    } catch (error) {
      console.error('Error loading pomodoro settings:', error);
    }
  }, [applySettings]);

  useFocusEffect(
    useCallback(() => {
      loadAndApplySettings();
    }, [loadAndApplySettings]),
  );

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
    if (routeParams?.autoStart) {
      setShouldAutoStart(true);
    }
  }, [routeParams?.preselectedCategory, routeParams?.autoStart]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        if (seconds > 0) {
          setSeconds((prev) => prev - 1);
        } else if (minutes > 0) {
          setMinutes((prev) => prev - 1);
          setSeconds(59);
        } else {
          const wasWorkSession = isWorkSession;

          if (wasWorkSession && selectedStage) {
            addEntreeTemps({
              dureeSecondes: workDuration * 60,
              categorie,
              description,
              date: new Date(),
              stageId: selectedStage,
              type: 'pomodoro',
            })
              .then(() => {
                Alert.alert('Session terminée', 'Votre session de travail a été enregistrée.');
              })
              .catch((error) => {
                console.error('Error saving pomodoro session:', error);
                Alert.alert('Erreur', "Impossible d'enregistrer la session.");
              });
          }

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
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

          const shouldAutoStartNextPhase = wasWorkSession && autoStartBreaks;
          setIsActive(shouldAutoStartNextPhase);
        }
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    isActive,
    seconds,
    minutes,
    isWorkSession,
    categorie,
    description,
    selectedStage,
    workDuration,
    breakDuration,
    longBreakDuration,
    completedSessions,
    autoStartBreaks,
  ]);

  const startSession = useCallback(() => {
    setIsActive(true);
  }, []);

  useEffect(() => {
    if (shouldAutoStart && selectedStage) {
      startSession();
      setShouldAutoStart(false);
      if (routeParams?.autoStart) {
        navigation.setParams({ ...routeParams, autoStart: false });
      }
    }
  }, [shouldAutoStart, selectedStage, startSession, navigation, routeParams]);

  const toggleTimer = () => {
    setIsActive((prev) => !prev);
  };

  const clampDuration = (value: number) => Math.max(1, Math.min(180, value));

  const handleWorkDurationChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setWorkDurationInput(sanitized);
    if (sanitized === '') {
      return;
    }
    const parsed = parseInt(sanitized, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = clampDuration(parsed);
      setWorkDuration(clamped);
      if (String(clamped) !== sanitized) {
        setWorkDurationInput(String(clamped));
      }
    }
  };

  const handleBreakDurationChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setBreakDurationInput(sanitized);
    if (sanitized === '') {
      return;
    }
    const parsed = parseInt(sanitized, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = clampDuration(parsed);
      setBreakDuration(clamped);
      if (String(clamped) !== sanitized) {
        setBreakDurationInput(String(clamped));
      }
    }
  };

  const handleWorkDurationBlur = () => {
    if (workDurationInput === '' || Number.isNaN(parseInt(workDurationInput, 10))) {
      setWorkDurationInput(String(workDuration));
    } else {
      const parsed = parseInt(workDurationInput, 10);
      if (!Number.isNaN(parsed)) {
        const clamped = clampDuration(parsed);
        setWorkDuration(clamped);
        setWorkDurationInput(String(clamped));
      }
    }
  };

  const handleBreakDurationBlur = () => {
    if (breakDurationInput === '' || Number.isNaN(parseInt(breakDurationInput, 10))) {
      setBreakDurationInput(String(breakDuration));
    } else {
      const parsed = parseInt(breakDurationInput, 10);
      if (!Number.isNaN(parsed)) {
        const clamped = clampDuration(parsed);
        setBreakDuration(clamped);
        setBreakDurationInput(String(clamped));
      }
    }
  };

  const handleLongBreakDurationChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setLongBreakDurationInput(sanitized);
    if (sanitized === '') {
      return;
    }
    const parsed = parseInt(sanitized, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = clampDuration(parsed);
      setLongBreakDuration(clamped);
      if (String(clamped) !== sanitized) {
        setLongBreakDurationInput(String(clamped));
      }
    }
  };

  const handleLongBreakDurationBlur = () => {
    if (longBreakDurationInput === '' || Number.isNaN(parseInt(longBreakDurationInput, 10))) {
      setLongBreakDurationInput(String(longBreakDuration));
    } else {
      const parsed = parseInt(longBreakDurationInput, 10);
      if (!Number.isNaN(parsed)) {
        const clamped = clampDuration(parsed);
        setLongBreakDuration(clamped);
        setLongBreakDurationInput(String(clamped));
      }
    }
  };

  useEffect(() => {
    if (!isActive) {
      if (isWorkSession) {
        setMinutes(workDuration);
        setSeconds(0);
      } else {
        const targetBreak = isLongBreak ? longBreakDuration : breakDuration;
        setMinutes(targetBreak);
        setSeconds(0);
      }
    }
  }, [workDuration, breakDuration, longBreakDuration, isWorkSession, isLongBreak, isActive]);

  const handleStopEarly = async () => {
    if (!selectedStage) {
      Alert.alert('Stage requis', 'Veuillez sélectionner un stage.');
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
        await addEntreeTemps({
          dureeSecondes: effectiveSeconds,
          categorie,
          description,
          date: new Date(),
          stageId: selectedStage,
          type: 'pomodoro-stop',
        });
        Alert.alert('Temps enregistré', 'La durée écoulée a été ajoutée.');
      } catch (error) {
        console.error('Error saving pomodoro entry:', error);
        Alert.alert('Erreur', "Impossible d'enregistrer le temps.");
      }
    }

    resetTimer();
  };

  const resetTimer = () => {
    setIsActive(false);
    setIsWorkSession(true);
    setMinutes(workDuration);
    setSeconds(0);
    setCompletedSessions(0);
    setIsLongBreak(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalPhaseSeconds = (isWorkSession ? workDuration : isLongBreak ? longBreakDuration : breakDuration) * 60;
  const remainingSeconds = minutes * 60 + seconds;
  const progressRatio = Math.min(1, Math.max(0, (totalPhaseSeconds - remainingSeconds) / totalPhaseSeconds));
  const completedForDisplay = Math.min(completedSessions, TOTAL_SESSIONS);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contexte</Text>
          <SelectInput
            value={selectedStage}
            onValueChange={setSelectedStage}
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
  },
  heroButton: {
    flex: 1,
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
  heroButtonText: {
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
});

export default PomodoroScreen;
