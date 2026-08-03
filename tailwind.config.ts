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
        accent: "#c9d3df",
        blueprint: {
          DEFAULT: "#22409b",
          deep: "#1b3480",
          dark: "#152864",
          light: "#2e4fb4"
        },
        cream: {
          DEFAULT: "#efe8d6",
          soft: "#f7f2e5",
          dim: "#bcb7a8"
        },
        note: {
          white: "#fcfaf4",
          yellow: "#f8efb8",
          pink: "#f9dce3",
          blue: "#d2e2fb"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        soft: "0 18px 70px rgba(0, 0, 0, 0.34)",
        glow: "0 0 34px rgba(255, 255, 255, 0.1)",
        note: "0 18px 40px rgba(9, 21, 60, 0.32)",
        "note-lift": "0 30px 70px rgba(9, 21, 60, 0.42)"
      }
    }
  },
  plugins: []
};

export default config;
