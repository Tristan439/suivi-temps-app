import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addEntreeTemps, getStages } from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { colors, fontSizes, spacing } from '../styles/global';

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;

interface Stage {
  id: string;
  nom: string;
}

const categorieOptions: SelectOption[] = [
  { label: 'Travail', value: 'Travail' },
  { label: 'Supervision', value: 'Supervision' },
  { label: 'Contact client', value: 'Contact client' },
  { label: 'Autres', value: 'Autres' },
];

const PomodoroScreen = () => {
  const [minutes, setMinutes] = useState(WORK_MINUTES);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isWorkSession, setIsWorkSession] = useState(true);
  const [description, setDescription] = useState('Session Pomodoro');
  const [categorie, setCategorie] = useState('Travail');
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchStages = async () => {
      try {
        const fetchedStages = await getStages();
        setStages(fetchedStages as Stage[]);
        if (fetchedStages.length > 0) {
          setSelectedStage(fetchedStages[0].id);
        }
      } catch (error) {
        console.error('Error fetching stages:', error);
        Alert.alert('Erreur', 'Impossible de charger les stages.');
      }
    };
    fetchStages();
  }, []);

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

  const toggleTimer = () => {
    setIsActive((prev) => !prev);
  };

  const resetTimer = () => {
    setIsActive(false);
    setIsWorkSession(true);
    setMinutes(WORK_MINUTES);
    setSeconds(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View
          style={[
            styles.timerCard,
            isWorkSession ? styles.workBackground : styles.breakBackground,
          ]}
        >
          <Text style={styles.timerText}>{formattedTime}</Text>
          <Text style={styles.sessionText}>
            {isWorkSession ? 'Session de travail' : 'Pause'}
          </Text>
        </View>

        <View style={styles.controlsContainer}>
          <SelectInput
            value={selectedStage}
            onValueChange={setSelectedStage}
            options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
            placeholder={stages.length === 0 ? 'Aucun stage disponible' : 'Sélectionner un stage'}
            disabled={stages.length === 0 || isActive}
          />
          <SelectInput
            value={categorie}
            onValueChange={setCategorie}
            options={categorieOptions}
            disabled={isActive}
          />
          <TextInput
            style={styles.input}
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            editable={!isActive}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.startPauseButton]}
            onPress={toggleTimer}
          >
            <Text style={styles.buttonText}>{isActive ? 'Pause' : 'Start'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={resetTimer}>
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.large,
    justifyContent: 'space-between',
  },
  timerCard: {
    borderRadius: 16,
    paddingVertical: spacing.large,
    paddingHorizontal: spacing.large,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  workBackground: {
    backgroundColor: colors.primary,
  },
  breakBackground: {
    backgroundColor: colors.accent,
  },
  timerText: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.white,
  },
  sessionText: {
    fontSize: fontSizes.title,
    color: colors.white,
    marginTop: spacing.small,
  },
  controlsContainer: {
    gap: spacing.medium,
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
  startPauseButton: {
    backgroundColor: colors.primary,
  },
  resetButton: {
    backgroundColor: colors.secondary,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
  },
});

export default PomodoroScreen;
