import { useCallback, useEffect, useRef, useState } from 'react';

import { SubCategoryKey } from '../constants/categories';
import { PersistedPomodoroState } from '../services/pomodoroPersistence';
import { PomodoroPhaseType } from './usePomodoroNotifications';

interface PomodoroTimerMetadata {
  categorie: string;
  subCategory: SubCategoryKey;
  description: string;
  selectedStage?: string;
  linkedTaskCardId?: string;
}

interface UsePomodoroTimerOptions {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  autoStartBreaks: boolean;
  hasElapsedCurrentSession: boolean;
  setHasElapsedCurrentSession: (value: boolean) => void;
  getMetadata: () => PomodoroTimerMetadata;
  scheduleFinishNotification: (durationSeconds: number, phaseType: PomodoroPhaseType) => Promise<void>;
  scheduleStatusNotification: (
    phaseEndTimestamp: number | null,
    phaseType: PomodoroPhaseType,
  ) => Promise<void>;
  cancelFinishNotification: () => Promise<void>;
  dismissStatusNotification: () => Promise<void>;
  cancelAllPomodoroNotifications: () => Promise<void>;
  savePomodoroState: (state: PersistedPomodoroState) => Promise<void>;
  clearPomodoroState: () => Promise<void>;
  onAutoLogWorkSession?: (durationSeconds: number) => Promise<void> | void;
  onAutoLogError?: (error: unknown) => void;
}

const TOTAL_SESSIONS = 4;

interface UsePomodoroTimerResult {
  minutes: number;
  seconds: number;
  isActive: boolean;
  isWorkSession: boolean;
  isLongBreak: boolean;
  completedSessions: number;
  startSession: () => void;
  toggleTimer: () => void;
  skipBreak: () => void;
  resetTimer: () => void;
  scheduleNotificationForRemainingTime: () => Promise<void>;
  hydrateFromPersistedState: (persisted: PersistedPomodoroState) => Promise<boolean>;
  clearPhaseEnd: () => void;
  syncNow: () => void;
}

const usePomodoroTimer = ({
  workDuration,
  breakDuration,
  longBreakDuration,
  autoStartBreaks,
  hasElapsedCurrentSession,
  setHasElapsedCurrentSession,
  getMetadata,
  scheduleFinishNotification,
  scheduleStatusNotification,
  cancelFinishNotification,
  dismissStatusNotification,
  cancelAllPomodoroNotifications,
  savePomodoroState,
  clearPomodoroState,
  onAutoLogWorkSession,
  onAutoLogError,
}: UsePomodoroTimerOptions): UsePomodoroTimerResult => {
  const [minutes, setMinutes] = useState(workDuration);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isWorkSession, setIsWorkSession] = useState(true);
  const [isLongBreak, setIsLongBreak] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const phaseEndRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const persistActivePhase = useCallback(
    (
      phaseEndTimestamp: number,
      config: { isWorkSession: boolean; isLongBreak: boolean; completedSessions: number },
    ) => {
      const metadata = getMetadata();
      const payload: PersistedPomodoroState = {
        phaseEndTimestamp,
        isWorkSession: config.isWorkSession,
        isLongBreak: config.isLongBreak,
        completedSessions: config.completedSessions,
        categorie: metadata.categorie,
        subCategorie: metadata.subCategory,
        description: metadata.description,
        selectedStage: metadata.selectedStage,
        linkedTaskCardId: metadata.linkedTaskCardId,
      };
      savePomodoroState(payload).catch((error) => {
        console.error('Error saving pomodoro phase:', error);
      });
    },
    [getMetadata, savePomodoroState],
  );

  const clearPhaseEnd = useCallback(() => {
    phaseEndRef.current = null;
    void cancelAllPomodoroNotifications();
    clearPomodoroState().catch((error) => {
      console.error('Error clearing pomodoro state:', error);
    });
  }, [cancelAllPomodoroNotifications, clearPomodoroState]);

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
      setHasElapsedCurrentSession(true);
      const nextPhaseType: PomodoroPhaseType = nextIsWorkSession
        ? 'work'
        : nextIsLongBreak
          ? 'long-break'
          : 'break';
      void scheduleFinishNotification(durationSeconds, nextPhaseType);
    },
    [
      cancelFinishNotification,
      completedSessions,
      dismissStatusNotification,
      isLongBreak,
      isWorkSession,
      persistActivePhase,
      scheduleFinishNotification,
      setHasElapsedCurrentSession,
    ],
  );

  const logWorkSessionIfNeeded = useCallback(() => {
    if (!onAutoLogWorkSession) {
      return;
    }
    const durationSeconds = workDuration * 60;
    try {
      const maybePromise = onAutoLogWorkSession(durationSeconds);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch((error: unknown) => {
          onAutoLogError?.(error);
        });
      }
    } catch (error) {
      onAutoLogError?.(error);
    }
  }, [onAutoLogError, onAutoLogWorkSession, workDuration]);

  const transitionToNextPhase = useCallback(() => {
    const wasWorkSession = isWorkSession;
    void dismissStatusNotification();

    if (wasWorkSession) {
      logWorkSessionIfNeeded();
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
    dismissStatusNotification,
    logWorkSessionIfNeeded,
    longBreakDuration,
    schedulePhaseEnd,
    setHasElapsedCurrentSession,
    workDuration,
    isWorkSession,
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
  }, [setHasElapsedCurrentSession, transitionToNextPhase]);

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

  const toggleTimer = useCallback(() => {
    if (isActive) {
      syncRemainingTime();
      setIsActive(false);
      clearPhaseEnd();
      return;
    }
    startSession();
  }, [clearPhaseEnd, isActive, startSession, syncRemainingTime]);

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
    void dismissStatusNotification();
    void scheduleFinishNotification(workDuration * 60, 'work');
    setIsActive(true);
    setHasElapsedCurrentSession(true);
  }, [
    completedSessions,
    dismissStatusNotification,
    isWorkSession,
    persistActivePhase,
    scheduleFinishNotification,
    workDuration,
    setHasElapsedCurrentSession,
  ]);

  const resetTimer = useCallback(() => {
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
  }, [clearPhaseEnd, setHasElapsedCurrentSession, workDuration]);

  const scheduleNotificationForRemainingTime = useCallback(async () => {
    const phaseType: PomodoroPhaseType = isWorkSession
      ? 'work'
      : isLongBreak
        ? 'long-break'
        : 'break';
    await scheduleStatusNotification(phaseEndRef.current, phaseType);
  }, [isLongBreak, isWorkSession, scheduleStatusNotification]);

  const hydrateFromPersistedState = useCallback(
    async (persisted: PersistedPomodoroState): Promise<boolean> => {
      const remainingMs = persisted.phaseEndTimestamp - Date.now();
      if (remainingMs <= 0) {
        await clearPomodoroState();
        return false;
      }
      phaseEndRef.current = persisted.phaseEndTimestamp;
      setIsWorkSession(persisted.isWorkSession);
      setIsLongBreak(persisted.isLongBreak);
      setCompletedSessions(persisted.completedSessions ?? 0);
      setHasElapsedCurrentSession(true);
      setIsActive(true);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const restoredPhaseType: PomodoroPhaseType = persisted.isWorkSession
        ? 'work'
        : persisted.isLongBreak
          ? 'long-break'
          : 'break';
      if (remainingSeconds > 0) {
        await scheduleFinishNotification(remainingSeconds, restoredPhaseType);
        setMinutes(Math.floor(remainingSeconds / 60));
        setSeconds(remainingSeconds % 60);
      }
      return true;
    },
    [
      clearPomodoroState,
      scheduleFinishNotification,
      setHasElapsedCurrentSession,
    ],
  );

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
  }, [
    breakDuration,
    hasElapsedCurrentSession,
    isActive,
    isLongBreak,
    isWorkSession,
    longBreakDuration,
    workDuration,
  ]);

  return {
    minutes,
    seconds,
    isActive,
    isWorkSession,
    isLongBreak,
    completedSessions,
    startSession,
    toggleTimer,
    skipBreak,
    resetTimer,
    scheduleNotificationForRemainingTime,
    hydrateFromPersistedState,
    clearPhaseEnd,
    syncNow: syncRemainingTime,
  };
};

export default usePomodoroTimer;
