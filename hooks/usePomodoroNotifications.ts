import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type PomodoroPhaseType = 'work' | 'break' | 'long-break';

const STATUS_NOTIFICATION_ID = 'pomodoro-status';
const FINISH_NOTIFICATION_ID = 'pomodoro-finish';

interface UsePomodoroNotificationsResult {
  supportsNotifications: boolean;
  ensurePermissions: () => Promise<boolean>;
  scheduleFinishNotification: (durationSeconds: number, phaseType: PomodoroPhaseType) => Promise<void>;
  scheduleStatusNotification: (phaseEndTimestamp: number | null, phaseType: PomodoroPhaseType) => Promise<void>;
  cancelFinishNotification: () => Promise<void>;
  dismissStatusNotification: () => Promise<void>;
  cancelAllPomodoroNotifications: () => Promise<void>;
}

const usePomodoroNotifications = (): UsePomodoroNotificationsResult => {
  const supportsNotifications = Platform.OS !== 'web';
  const notificationsEnabledRef = useRef(false);

  const dismissStatusNotification = useCallback(async () => {
    if (!supportsNotifications) {
      return;
    }
    try {
      await Notifications.dismissNotificationAsync(STATUS_NOTIFICATION_ID);
    } catch {
      // noop
    }
  }, [supportsNotifications]);

  const cancelFinishNotification = useCallback(async () => {
    if (!supportsNotifications) {
      return;
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(FINISH_NOTIFICATION_ID);
    } catch {
      // noop
    }
  }, [supportsNotifications]);

  const cancelAllPomodoroNotifications = useCallback(async () => {
    await dismissStatusNotification();
    await cancelFinishNotification();
  }, [cancelFinishNotification, dismissStatusNotification]);

  const ensurePermissions = useCallback(async () => {
    if (!supportsNotifications) {
      notificationsEnabledRef.current = false;
      return false;
    }

    try {
      const existing = await Notifications.getPermissionsAsync();
      let granted =
        existing.granted ||
        existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      if (!granted) {
        const request = await Notifications.requestPermissionsAsync();
        granted =
          request.granted ||
          request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      }
      notificationsEnabledRef.current = Boolean(granted);
      if (!granted) {
        await cancelAllPomodoroNotifications();
      }
      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      notificationsEnabledRef.current = false;
      return false;
    }
  }, [cancelAllPomodoroNotifications, supportsNotifications]);

  const scheduleFinishNotification = useCallback(
    async (durationSeconds: number, phaseType: PomodoroPhaseType) => {
      if (!supportsNotifications || !notificationsEnabledRef.current) {
        return;
      }
      try {
        await cancelFinishNotification();
        const trigger: Notifications.TimeIntervalTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, durationSeconds),
          repeats: false,
        };
        await Notifications.scheduleNotificationAsync({
          identifier: FINISH_NOTIFICATION_ID,
          content: {
            title:
              phaseType === 'work'
                ? 'Session de travail terminée'
                : phaseType === 'long-break'
                  ? 'Longue pause terminée'
                  : 'Pause terminée',
            body: phaseType === 'work' ? 'Temps de faire une pause.' : 'Revenez à votre session de travail.',
            data: {
              notificationType: 'pomodoro',
              phaseType,
            },
          },
          trigger,
        });
      } catch (error) {
        console.error('Error scheduling pomodoro notification:', error);
      }
    },
    [cancelFinishNotification, supportsNotifications],
  );

  const scheduleStatusNotification = useCallback(
    async (phaseEndTimestamp: number | null, phaseType: PomodoroPhaseType) => {
      if (
        !supportsNotifications ||
        !notificationsEnabledRef.current ||
        !phaseEndTimestamp
      ) {
        return;
      }
      const remainingSeconds = Math.max(0, Math.floor((phaseEndTimestamp - Date.now()) / 1000));
      if (remainingSeconds <= 0) {
        return;
      }
      const endTime = new Date(Date.now() + remainingSeconds * 1000);
      const formattedEndTime = `${String(endTime.getHours()).padStart(2, '0')}:${String(
        endTime.getMinutes(),
      ).padStart(2, '0')}`;
      const body =
        phaseType === 'work'
          ? `Session de travail en cours. Fin prévue à ${formattedEndTime}.`
          : phaseType === 'long-break'
            ? `Longue pause en cours. Fin prévue à ${formattedEndTime}.`
            : `Pause en cours. Fin prévue à ${formattedEndTime}.`;
      try {
        await dismissStatusNotification();
        await Notifications.scheduleNotificationAsync({
          identifier: STATUS_NOTIFICATION_ID,
          content: {
            title: 'Session en cours',
            body,
            data: { notificationType: 'pomodoro-status', phaseType },
            sound: false,
          },
          trigger: null,
        });
      } catch (error) {
        console.error('Error showing pomodoro status notification:', error);
      }
    },
    [dismissStatusNotification, supportsNotifications],
  );

  useEffect(() => {
    ensurePermissions();
  }, [ensurePermissions]);

  return {
    supportsNotifications,
    ensurePermissions,
    scheduleFinishNotification,
    scheduleStatusNotification,
    cancelFinishNotification,
    dismissStatusNotification,
    cancelAllPomodoroNotifications,
  };
};

export default usePomodoroNotifications;
