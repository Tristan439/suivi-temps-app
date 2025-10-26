import { AppSettings } from '../services/settings';

export type DurationSettingKey =
  | 'defaultPomodoroWorkMinutes'
  | 'defaultPomodoroBreakMinutes'
  | 'defaultPomodoroLongBreakMinutes';

export const clampDuration = (value: number, min = 1, max = 180) =>
  Math.max(min, Math.min(max, value));

export interface DurationChangeOptions {
  isActive: boolean;
  hasElapsedCurrentSession: boolean;
  onResetProgress: () => void;
}

export const handleDurationChange = (
  rawValue: string,
  setInput: (value: string) => void,
  setDuration: (value: number) => void,
  { isActive, hasElapsedCurrentSession, onResetProgress }: DurationChangeOptions,
) => {
  const sanitized = rawValue.replace(/[^0-9]/g, '');
  setInput(sanitized);
  if (sanitized === '') {
    return;
  }
  const parsed = parseInt(sanitized, 10);
  if (Number.isNaN(parsed)) {
    return;
  }
  const clamped = clampDuration(parsed);
  setDuration(clamped);
  if (!isActive && !hasElapsedCurrentSession) {
    onResetProgress();
  }
  if (String(clamped) !== sanitized) {
    setInput(String(clamped));
  }
};

export interface DurationBlurOptions {
  persist: (partial: Partial<AppSettings>) => void | Promise<void>;
  settingKey: DurationSettingKey;
}

export const handleDurationBlur = (
  inputValue: string,
  currentValue: number,
  setInput: (value: string) => void,
  setDuration: (value: number) => void,
  { persist, settingKey }: DurationBlurOptions,
) => {
  if (inputValue === '' || Number.isNaN(parseInt(inputValue, 10))) {
    setInput(String(currentValue));
    return;
  }
  const parsed = parseInt(inputValue, 10);
  if (Number.isNaN(parsed)) {
    setInput(String(currentValue));
    return;
  }
  const clamped = clampDuration(parsed);
  setDuration(clamped);
  setInput(String(clamped));
  persist({ [settingKey]: clamped });
};
