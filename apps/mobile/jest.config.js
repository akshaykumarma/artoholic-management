module.exports = {
  preset: 'jest-expo',
  // The first render in each file loads and transforms React Native from a cold cache; on 2-core CI
  // runners that alone takes ~5-9 s, so the 5 s default times out before any assertion runs.
  testTimeout: 20000,
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@artoholic/.*)'
  ]
};
