import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.backend.json"
      }
    ]
  },
  collectCoverageFrom: ["backend/src/**/*.ts"],
  coverageDirectory: "./coverage",
  setupFiles: ["<rootDir>/test/jest.setup.ts"],
  testEnvironment: "node"
};

export default config;
