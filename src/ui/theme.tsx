import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemeMode } from '../data/schema';
import { dark, light, type Palette } from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: light });

export function resolveScheme(mode: ThemeMode, system: string | null | undefined): 'light' | 'dark' {
  if (mode === 'system') return system === 'dark' ? 'dark' : 'light';
  return mode;
}

export function ThemeProvider({ mode = 'system', children }: { mode?: ThemeMode; children: ReactNode }) {
  const scheme = resolveScheme(mode, useColorScheme());
  return (
    <ThemeContext.Provider value={{ scheme, colors: scheme === 'dark' ? dark : light }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
