import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_STORAGE_KEY = 'app-settings';

export interface AppSettings {
  defaultPomodoroWorkMinutes: number;
  defaultPomodoroBreakMinutes: number;
  defaultPomodoroLongBreakMinutes: number;
  autoStartPomodoroBreaks: boolean;
  defaultStageId?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultPomodoroWorkMinutes: 20,
  defaultPomodoroBreakMinutes: 5,
  defaultPomodoroLongBreakMinutes: 15,
  autoStartPomodoroBreaks: true,
  defaultStageId: undefined,
};

const clampDuration = (value: number) => Math.min(Math.max(value, 1), 180);

const sanitizeSettings = (value: Partial<AppSettings>): AppSettings => {
  return {
    defaultPomodoroWorkMinutes:
      typeof value.defaultPomodoroWorkMinutes === 'number'
        ? clampDuration(value.defaultPomodoroWorkMinutes)
        : DEFAULT_SETTINGS.defaultPomodoroWorkMinutes,
    defaultPomodoroBreakMinutes:
      typeof value.defaultPomodoroBreakMinutes === 'number'
        ? clampDuration(value.defaultPomodoroBreakMinutes)
        : DEFAULT_SETTINGS.defaultPomodoroBreakMinutes,
    defaultPomodoroLongBreakMinutes:
      typeof value.defaultPomodoroLongBreakMinutes === 'number'
        ? clampDuration(value.defaultPomodoroLongBreakMinutes)
        : DEFAULT_SETTINGS.defaultPomodoroLongBreakMinutes,
    autoStartPomodoroBreaks:
      typeof value.autoStartPomodoroBreaks === 'boolean'
        ? value.autoStartPomodoroBreaks
        : DEFAULT_SETTINGS.autoStartPomodoroBreaks,
    defaultStageId:
      typeof value.defaultStageId === 'string' ? value.defaultStageId : DEFAULT_SETTINGS.defaultStageId,
  };
};

export const loadSettings = async (): Promise<AppSettings> => {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }
    const parsed: Partial<AppSettings> = JSON.parse(stored);
    const sanitized = sanitizeSettings(parsed);
    return {
      ...DEFAULT_SETTINGS,
      ...sanitized,
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

export const updateSettings = async (partial: Partial<AppSettings>): Promise<AppSettings> => {
  const current = await loadSettings();
  const updated = sanitizeSettings({
    ...current,
    ...partial,
  });
  await saveSettings(updated);
  return updated;
};
