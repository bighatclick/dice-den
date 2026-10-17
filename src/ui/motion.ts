import { useReducedMotion } from 'react-native-reanimated';
import { useSettings } from '../state/settingsStore';

/** True when the system or the in-app setting asks for less motion (specs.md §9, §10). */
export function useReduceMotion(): boolean {
  const system = useReducedMotion();
  const { reduceMotion } = useSettings();
  return system || reduceMotion;
}
