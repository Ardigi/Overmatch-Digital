'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import Toast, { type ToastProps, type ToastType } from '@/components/ui/Toast';

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration?: number) => {
      const id = Date.now().toString();
      const newToast = {
        id,
        type,
        title,
        message,
        duration,
      };
      setToasts((prevToasts) => [...prevToasts, newToast]);
    },
    []
  );

  const showSuccess = useCallback(
    (title: string, message?: string) => showToast('success', title, message),
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string) => showToast('error', title, message),
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string) => showToast('warning', title, message),
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string) => showToast('info', title, message),
    [showToast]
  );

  const contextValue: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Container */}
      <div
        aria-live="assertive"
        className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-50"
      >
        <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
          {toasts.map((toast) => (
            <Toast key={toast.id} {...toast} onClose={removeToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
