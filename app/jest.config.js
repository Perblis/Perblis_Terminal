/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["react-native-gesture-handler/jestSetup", "<rootDir>/test/jest-setup.ts"],
  // pnpm keeps real packages under node_modules/.pnpm/<pkg>@<ver>/node_modules/,
  // so we match only the inner real-name segment and never at .pnpm itself
  // (the optional-.pnpm variant is defeated by regex backtracking).
  transformIgnorePatterns: [
    "node_modules/(?!\\.pnpm)(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|@sentry/react-native|native-base|react-native-svg|@terminal|@maplibre|react-native-mmkv|nativewind|react-native-css-interop|supercluster|kdbush)([-@/]|$))",

  ],
  clearMocks: true,
};
