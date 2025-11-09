import { useCallback, useState } from 'react';

import { AppSettings } from '../services/settings';
import {
  DurationSettingKey,
  handleDurationBlur,
  handleDurationChange,
} from '../utils/pomodoroDurations';

interface UseDurationFieldOptions {
  initialMinutes: number;
  isActive: boolean;
  hasElapsedCurrentSession: boolean;
  onResetProgress: () => void;
  persistSettings: (partial: Partial<AppSettings>) => Promise<void>;
  settingKey: DurationSettingKey;
}

interface UseDurationFieldResult {
  value: number;
  inputValue: string;
  handleChange: (value: string) => void;
  handleBlur: () => void;
  syncFromSettings: (nextMinutes: number) => void;
}

const useDurationField = ({
  initialMinutes,
  isActive,
  hasElapsedCurrentSession,
  onResetProgress,
  persistSettings,
  settingKey,
}: UseDurationFieldOptions): UseDurationFieldResult => {
  const [value, setValue] = useState(initialMinutes);
  const [inputValue, setInputValue] = useState(String(initialMinutes));

  const handleChange = useCallback(
    (text: string) => {
      handleDurationChange(text, setInputValue, setValue, {
        isActive,
        hasElapsedCurrentSession,
        onResetProgress,
      });
    },
    [hasElapsedCurrentSession, isActive, onResetProgress],
  );

  const handleBlur = useCallback(() => {
    handleDurationBlur(inputValue, value, setInputValue, setValue, {
      persist: persistSettings,
      settingKey,
    });
  }, [inputValue, persistSettings, settingKey, value]);

  const syncFromSettings = useCallback((nextMinutes: number) => {
    setValue(nextMinutes);
    setInputValue(String(nextMinutes));
  }, []);

  return {
    value,
    inputValue,
    handleChange,
    handleBlur,
    syncFromSettings,
  };
};

export default useDurationField;
