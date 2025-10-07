import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description?: string;
}

export function useKeyboardNavigation(shortcuts: KeyboardShortcut[] = []) {
  const router = useRouter();

  // Default shortcuts for dashboard navigation
  const defaultShortcuts: KeyboardShortcut[] = [
    {
      key: 'h',
      ctrl: true,
      action: () => router.push('/dashboard'),
      description: 'Go to Dashboard Home',
    },
    {
      key: 't',
      ctrl: true,
      action: () => router.push('/dashboard/tasks'),
      description: 'Go to Tasks',
    },
    {
      key: 'p',
      ctrl: true,
      action: () => router.push('/dashboard/projects'),
      description: 'Go to Projects',
    },
    {
      key: '/',
      ctrl: true,
      action: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: 'Focus Search',
    },
    {
      key: 'Escape',
      action: () => {
        // Close any open modals or dropdowns
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement) {
          activeElement.blur();
        }
      },
      description: 'Close/Cancel',
    },
  ];

  const allShortcuts = [...defaultShortcuts, ...shortcuts];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Escape key even in input fields
        if (event.key !== 'Escape') {
          return;
        }
      }

      for (const shortcut of allShortcuts) {
        const ctrlPressed = shortcut.ctrl ? event.ctrlKey || event.metaKey : true;
        const altPressed = shortcut.alt ? event.altKey : true;
        const shiftPressed = shortcut.shift ? event.shiftKey : true;

        if (event.key === shortcut.key && ctrlPressed && altPressed && shiftPressed) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [allShortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return allShortcuts;
}

// Announce page changes for screen readers
export function useAnnouncePageChange(title: string) {
  useEffect(() => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `Navigated to ${title}`;

    document.body.appendChild(announcement);

    return () => {
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    };
  }, [title]);
}
