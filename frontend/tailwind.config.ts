import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f6f7fb",
        muted: "#98a2b8",
        panel: "rgba(17, 19, 29, 0.82)",
        line: "rgba(148, 163, 184, 0.18)",
        brand: "#e8edf6",
        accent: "#c9d3df"
      },
      boxShadow: {
        soft: "0 18px 70px rgba(0, 0, 0, 0.34)",
        glow: "0 0 34px rgba(255, 255, 255, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
