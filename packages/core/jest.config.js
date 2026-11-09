/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx", esModuleInterop: true, isolatedModules: true } }],
  },
  moduleNameMapper: {
    "^@shoplist/api-client$": "<rootDir>/../api-client/src/index.ts",
  },
};
