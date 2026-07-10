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

jest.mock("@maplibre/maplibre-react-native", () => require("./maplibre-mock"));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 6.4541, longitude: 3.3947 },
  })),
  Accuracy: { Balanced: 3 },
}));

jest.mock("react-native-worklets", () =>
  jest.requireActual("react-native-worklets/src/mock"),
);

jest.mock("react-native-reanimated", () => {
  const mock = jest.requireActual("react-native-reanimated/mock");
  return { ...mock, useReducedMotion: () => true };
});

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), remove: jest.fn() })),
}));

jest.mock("expo-image-manipulator", () => {
  const makeContext = () => {
    const renderAsync = jest.fn(async () => ({
      saveAsync: jest.fn(async () => ({
        uri: "file:///resized.jpg",
        width: 1920,
        height: 1080,
      })),
    }));
    const ctx = { resize: jest.fn(), renderAsync };
    ctx.resize.mockReturnValue(ctx); // chainable, no self-reference in initializer
    return ctx;
  };
  return {
    ImageManipulator: { manipulate: jest.fn(() => makeContext()) },
    SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
  };
});

jest.mock("expo-file-system/legacy", () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 500_000 })),
  uploadAsync: jest.fn(async () => ({ status: 200, body: "" })),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
}));

jest.mock("ably", () => ({
  Realtime: class {
    channels = { get: () => ({ subscribe: jest.fn(), unsubscribe: jest.fn() }) };
  },
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///cam.jpg", width: 4000, height: 3000 }],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///lib.jpg", width: 4000, height: 3000 }],
  })),
  MediaType: { Images: "images" },
}));
