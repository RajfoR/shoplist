/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/test"],
  setupFiles: ["<rootDir>/test/setup.cjs"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: { jsx: "react-jsx", esModuleInterop: true, isolatedModules: true } },
    ],
  },
  moduleNameMapper: {
    "^@shoplist/core$": "<rootDir>/../../packages/core/src/index.ts",
    "^@shoplist/api-client$": "<rootDir>/../../packages/api-client/src/index.ts",
    "\\.css$": "<rootDir>/test/styleStub.cjs",
  },
};
