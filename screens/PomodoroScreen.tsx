import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { addEntreeTemps, getStages } from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { CATEGORY_OPTIONS } from '../constants/categories';
import { colors, fontSizes, spacing } from '../styles/global';

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;
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
  const [minutes, setMinutes] = useState(WORK_MINUTES);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isWorkSession, setIsWorkSession] = useState(true);
  const [description, setDescription] = useState('Session Pomodoro');
  const [categorie, setCategorie] = useState<string>(
    CATEGORY_OPTIONS.find((option) => option.value === 'autres_pomodoro')?.value ||
      CATEGORY_OPTIONS[0]?.value ||
      '',
  );
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const [completedSessions, setCompletedSessions] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const categoryOptions = useMemo<SelectOption[]>(
    () => CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

  const route = useRoute<RouteProp<Record<string, PomodoroRouteParams | undefined>, string>>();
  const navigation = useNavigation<any>();
  const routeParams = route.params;
  const [shouldAutoStart, setShouldAutoStart] = useState(routeParams?.autoStart ?? false);

  useEffect(() => {
    const fetchStages = async () => {
      try {
        const fetchedStages = await getStages();
        setStages(fetchedStages as Stage[]);
        if (fetchedStages.length > 0) {
          if (
            routeParams?.preselectedStage &&
            fetchedStages.some((stage) => stage.id === routeParams.preselectedStage)
          ) {
            setSelectedStage(routeParams.preselectedStage);
          } else {
            setSelectedStage(fetchedStages[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching stages:', error);
        Alert.alert('Erreur', 'Impossible de charger les stages.');
      }
    };
    fetchStages();
  }, [routeParams?.preselectedStage]);

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
          if (isWorkSession && selectedStage) {
            addEntreeTemps({
              dureeSecondes: WORK_MINUTES * 60,
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
            setCompletedSessions((prev) => prev + 1);
          }

          setMinutes(isWorkSession ? BREAK_MINUTES : WORK_MINUTES);
          setSeconds(0);
          setIsWorkSession((prev) => !prev);
          setIsActive(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
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
  }, [isActive, seconds, minutes, isWorkSession, categorie, description, selectedStage]);

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

  const resetTimer = () => {
    setIsActive(false);
    setIsWorkSession(true);
    setMinutes(WORK_MINUTES);
    setSeconds(0);
    setCompletedSessions(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalPhaseSeconds = (isWorkSession ? WORK_MINUTES : BREAK_MINUTES) * 60;
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
          <Text style={styles.cardTitle}>Résumé</Text>
          <View style={styles.statRow}>
            <Ionicons name="flame-outline" size={18} color={colors.primary} />
            <Text style={styles.statLabel}>Durée des sessions</Text>
            <Text style={styles.statValue}>{WORK_MINUTES} min</Text>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="leaf-outline" size={18} color={colors.secondary} />
            <Text style={styles.statLabel}>Durée des pauses</Text>
            <Text style={styles.statValue}>{BREAK_MINUTES} min</Text>
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
  input: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    padding: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
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
