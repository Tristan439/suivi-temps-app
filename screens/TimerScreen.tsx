import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';

import { addEntreeTemps, getStages } from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { CATEGORY_OPTIONS } from '../constants/categories';
import { colors, fontSizes, spacing } from '../styles/global';
import { loadSettings } from '../services/settings';

interface Stage {
  id: string;
  nom: string;
}

type TimerRouteParams = {
  preselectedCategory?: string;
  preselectedStage?: string;
  autoStart?: boolean;
};

const TimerScreen = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState<string>(CATEGORY_OPTIONS[0]?.value ?? '');
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const [preferredStageId, setPreferredStageId] = useState<string | undefined>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const route = useRoute<RouteProp<Record<string, TimerRouteParams | undefined>, string>>();
  const routeParams = route.params;
  const categoryOptions = useMemo<SelectOption[]>(
    () => CATEGORY_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );
  const navigation = useNavigation<any>();
  const [shouldAutoStart, setShouldAutoStart] = useState(routeParams?.autoStart ?? false);

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
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
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

  const startTimer = useCallback(() => {
    if (isRunning) {
      return;
    }
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTime((prevTime) => prevTime + 1);
    }, 1000);
  }, [isRunning]);

  useEffect(() => {
    if (shouldAutoStart && selectedStage) {
      startTimer();
      setShouldAutoStart(false);
      if (routeParams?.autoStart) {
        navigation.setParams({ ...routeParams, autoStart: false });
      }
    }
  }, [shouldAutoStart, selectedStage, startTimer, navigation, routeParams]);

  const pauseTimer = () => {
    if (!isRunning) {
      return;
    }
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const stopTimer = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsRunning(false);

    if (time < 1) {
      Alert.alert('Erreur', 'Le minuteur doit tourner pendant au moins une seconde.');
      return;
    }
    if (!selectedStage) {
      Alert.alert('Erreur', 'Veuillez sélectionner un stage.');
      return;
    }

    try {
      await addEntreeTemps({
        dureeSecondes: time,
        categorie,
        description,
        date: new Date(),
        stageId: selectedStage,
        type: 'chrono',
      });
      Alert.alert('Succès', 'Votre temps a été enregistré.');
    } catch (error) {
      console.error('Error saving time entry:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer votre temps.");
    }

    setTime(0);
    setDescription('');
  };

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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.timerCard}>
            <Text style={styles.timerDisplay}>{formatTime(time)}</Text>
          </View>

          <View style={styles.controlsContainer}>
            <SelectInput
              value={selectedStage}
              onValueChange={setSelectedStage}
              options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
              placeholder={stages.length === 0 ? 'Aucun stage disponible' : 'Sélectionner un stage'}
              disabled={stages.length === 0 || isRunning}
            />
            <SelectInput
              value={categorie}
              onValueChange={(value) => setCategorie(value)}
              options={categoryOptions}
              disabled={isRunning}
            />
            <TextInput
              style={styles.input}
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              editable={!isRunning}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                isRunning ? styles.pauseButton : styles.startButton,
              ]}
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
  },
  timerDisplay: {
    fontSize: 60,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 2,
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
