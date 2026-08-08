import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  // Server code shares `@/lib/*` helpers with the app. Type-only imports are
  // erased before Jest sees them, but value imports need the alias resolved.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json"
      }
    ]
  },
  collectCoverageFrom: ["src/server/**/*.ts"],
  coverageDirectory: "./coverage",
  setupFiles: ["<rootDir>/test/jest.setup.ts"],
  testEnvironment: "node"
};

export default config;
