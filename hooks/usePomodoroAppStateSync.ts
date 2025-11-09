import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface UsePomodoroAppStateSyncOptions {
  isActive: boolean;
  supportsNotifications: boolean;
  onBackgroundSchedule: () => Promise<void>;
  onForegroundResume: () => Promise<void> | void;
}

const usePomodoroAppStateSync = ({
  isActive,
  supportsNotifications,
  onBackgroundSchedule,
  onForegroundResume,
}: UsePomodoroAppStateSyncOptions) => {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!supportsNotifications) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = Boolean(appState.current && appState.current.match(/inactive|background/));
      const goingBackground = nextAppState.match(/inactive|background/);
      if (appState.current === 'active' && goingBackground) {
        if (isActive) {
          void onBackgroundSchedule();
        }
      }
      if (wasBackground && nextAppState === 'active') {
        void onForegroundResume();
      }
      appState.current = nextAppState as AppStateStatus;
    });

    return () => {
      subscription.remove();
    };
  }, [isActive, onBackgroundSchedule, onForegroundResume, supportsNotifications]);
};

export default usePomodoroAppStateSync;
