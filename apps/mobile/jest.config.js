/** @type {import('jest').Config} */
module.exports = {
  // Gotowy zestaw od Expo: Babel z babel-preset-expo, atrapy modułów natywnych,
  // środowisko React Native zamiast przeglądarki.
  preset: "jest-expo",
  roots: ["<rootDir>/test"],
  // Dopasowania matcherów RNTL (toBeOnTheScreen, toBeChecked…) w każdym teście.
  setupFilesAfterEnv: ["@testing-library/react-native/matchers"],
};