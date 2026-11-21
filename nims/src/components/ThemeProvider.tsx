'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { IconMoon, IconSun } from './Icons';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  mounted: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  mounted: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'nims-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const isDarkDom = document.documentElement.classList.contains('dark');
      const initial: ThemeMode = stored === 'dark' || (!stored && isDarkDom) ? 'dark' : 'light';
      setThemeState(initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
    } catch {
      setThemeState('light');
    }
    setMounted(true);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Abaikan jika penyimpanan peramban dibatasi
    }
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, mounted, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, mounted, toggleTheme } = useTheme();

  const isDark = mounted ? theme === 'dark' : false;
  const label = isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink-secondary transition-[background-color,border-color,color,transform] duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink active:scale-[0.96] ${className}`}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <IconSun
          className={`h-4 w-4 text-amber-500 transition-[opacity,transform] duration-200 ${
            isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-50 -rotate-45 opacity-0 absolute'
          }`}
        />
        <IconMoon
          className={`h-4 w-4 text-ink-secondary transition-[opacity,transform] duration-200 ${
            !isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-50 rotate-45 opacity-0 absolute'
          }`}
        />
      </span>
      {!compact && (
        <span className="whitespace-nowrap">
          {mounted ? (isDark ? 'Mode Gelap' : 'Mode Terang') : 'Tema'}
        </span>
      )}
    </button>
  );
}
