import AsyncStorage from '@react-native-async-storage/async-storage';

import { SubCategoryKey } from '../constants/categories';

const POMODORO_STATE_KEY = 'pomodoro-active-state';

export interface PersistedPomodoroState {
  phaseEndTimestamp: number;
  isWorkSession: boolean;
  isLongBreak: boolean;
  completedSessions: number;
  categorie?: string;
  subCategorie?: SubCategoryKey;
  description?: string;
  selectedStage?: string;
  linkedTaskCardId?: string;
  notificationId?: string;
}

export const savePomodoroState = async (state: PersistedPomodoroState) => {
  try {
    await AsyncStorage.setItem(POMODORO_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving pomodoro state:', error);
  }
};

export const loadPomodoroState = async (): Promise<PersistedPomodoroState | null> => {
  try {
    const stored = await AsyncStorage.getItem(POMODORO_STATE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as PersistedPomodoroState;
  } catch (error) {
    console.error('Error loading pomodoro state:', error);
    return null;
  }
};

export const clearPomodoroState = async () => {
  try {
    await AsyncStorage.removeItem(POMODORO_STATE_KEY);
  } catch (error) {
    console.error('Error clearing pomodoro state:', error);
  }
};
