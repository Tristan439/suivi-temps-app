import { useCallback, useEffect, useRef, useState } from 'react';

interface UseToastOptions {
  duration?: number;
}

interface UseToastResult {
  message: string;
  visible: boolean;
  showToast: (text: string) => void;
  hideToast: () => void;
}

const useToast = (options: UseToastOptions = {}): UseToastResult => {
  const { duration = 2500 } = options;
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearExistingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearExistingTimeout();
    setVisible(false);
  }, [clearExistingTimeout]);

  const showToast = useCallback(
    (text: string) => {
      setMessage(text);
      setVisible(true);
      clearExistingTimeout();
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
        timeoutRef.current = null;
      }, duration);
    },
    [clearExistingTimeout, duration],
  );

  useEffect(() => () => clearExistingTimeout(), [clearExistingTimeout]);

  return {
    message,
    visible,
    showToast,
    hideToast,
  };
};

export default useToast;
