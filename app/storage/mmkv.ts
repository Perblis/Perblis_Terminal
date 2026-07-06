import { createMMKV } from "react-native-mmkv";
import type { StateStorage } from "zustand/middleware";

/** Single app-wide MMKV instance (TSD §6 offline posture). */
export const mmkv = createMMKV();

/** zustand persist adapter. */
export const zustandStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => {
    mmkv.set(name, value);
  },
  removeItem: (name) => {
    mmkv.remove(name);
  },
};

/** TanStack sync-storage-persister adapter. */
export const queryStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => {
    mmkv.set(key, value);
  },
  removeItem: (key: string) => {
    mmkv.remove(key);
  },
};
