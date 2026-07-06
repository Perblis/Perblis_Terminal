// Global mocks for native modules that have no JS fallback under jest.
jest.mock("react-native-mmkv", () => {
  class MMKV {
    private store = new Map<string, string | number | boolean>();
    set(key: string, value: string | number | boolean) {
      this.store.set(key, value);
    }
    getString(key: string) {
      const v = this.store.get(key);
      return typeof v === "string" ? v : undefined;
    }
    getNumber(key: string) {
      const v = this.store.get(key);
      return typeof v === "number" ? v : undefined;
    }
    getBoolean(key: string) {
      const v = this.store.get(key);
      return typeof v === "boolean" ? v : undefined;
    }
    delete(key: string) {
      this.store.delete(key);
    }
    remove(key: string) {
      return this.store.delete(key);
    }
    getAllKeys() {
      return [...this.store.keys()];
    }
    clearAll() {
      this.store.clear();
    }
  }
  return { MMKV, createMMKV: () => new MMKV() };
});

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
  };
});

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(async () => ({ isConnected: true })),
}));
