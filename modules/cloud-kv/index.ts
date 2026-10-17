import { requireOptionalNativeModule, type EventSubscription } from 'expo';

interface CloudKvNative {
  isAvailable(): boolean;
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  synchronize(): boolean;
  addListener(event: 'onChange', listener: (e: { keys: string[] }) => void): EventSubscription;
}

/** The subset of the module the sync code uses; tests pass an in-memory one. */
export interface CloudKv {
  isAvailable(): boolean;
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  synchronize(): boolean;
  onChange(listener: (keys: string[]) => void): () => void;
}

const native = requireOptionalNativeModule<CloudKvNative>('CloudKv');

/** iCloud key-value store, or null where it can't exist (Expo Go, web, tests). */
export const cloudKv: CloudKv | null = native
  ? {
      isAvailable: () => native.isAvailable(),
      getString: (key) => native.getString(key),
      setString: (key, value) => native.setString(key, value),
      synchronize: () => native.synchronize(),
      onChange(listener) {
        const sub = native.addListener('onChange', (e) => listener(e.keys));
        return () => sub.remove();
      },
    }
  : null;
