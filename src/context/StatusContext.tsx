import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { StatusType } from '../types';

interface StatusState {
  message: ReactNode;
  type: StatusType;
  visible: boolean;
}

interface StatusContextValue extends StatusState {
  showStatus: (message: ReactNode, type?: StatusType) => void;
  hideStatus: () => void;
}

const StatusContext = createContext<StatusContextValue | null>(null);

export function StatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StatusState>({
    message: '',
    type: 'info',
    visible: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = useCallback((message: ReactNode, type: StatusType = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setState({ message, type, visible: true });
    // Success messages auto-dismiss after 15s, matching the original.
    if (type === 'success') {
      timer.current = setTimeout(() => {
        setState((s) => ({ ...s, visible: false }));
      }, 15000);
    }
  }, []);

  const hideStatus = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setState((s) => ({ ...s, visible: false }));
  }, []);

  return (
    <StatusContext.Provider value={{ ...state, showStatus, hideStatus }}>
      {children}
    </StatusContext.Provider>
  );
}

export function useStatus(): StatusContextValue {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error('useStatus must be used within a StatusProvider');
  return ctx;
}
