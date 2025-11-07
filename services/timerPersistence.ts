import AsyncStorage from '@react-native-async-storage/async-storage';

import { SubCategoryKey } from '../constants/categories';

const TIMER_STATE_KEY = 'timer-active-state';

export interface PersistedTimerState {
  isRunning: boolean;
  startTimestamp: number | null;
  elapsedSeconds: number;
  categorie?: string;
  subCategorie?: SubCategoryKey;
  description?: string;
  selectedStage?: string;
  notificationId?: string;
}

export const saveTimerState = async (state: PersistedTimerState) => {
  try {
    await AsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving timer state:', error);
  }
};

export const loadTimerState = async (): Promise<PersistedTimerState | null> => {
  try {
    const stored = await AsyncStorage.getItem(TIMER_STATE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as PersistedTimerState;
  } catch (error) {
    console.error('Error loading timer state:', error);
    return null;
  }
};

export const clearTimerState = async () => {
  try {
    await AsyncStorage.removeItem(TIMER_STATE_KEY);
  } catch (error) {
    console.error('Error clearing timer state:', error);
  }
};
