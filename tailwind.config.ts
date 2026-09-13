import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink-rgb, 246 247 251) / <alpha-value>)",
        muted: "rgb(var(--color-muted-rgb, 152 162 184) / <alpha-value>)",
        panel: "var(--panel, rgba(17, 19, 29, 0.82))",
        line: "var(--line, rgba(148, 163, 184, 0.18))",
        brand: "rgb(var(--color-brand-rgb, 232 237 246) / <alpha-value>)",
        accent: "rgb(var(--color-accent-rgb, 201 211 223) / <alpha-value>)",
        blueprint: {
          DEFAULT: "#3657b4",
          deep: "#27469a",
          dark: "#152864",
          light: "#4a6ac4"
        },
        cream: {
          DEFAULT: "rgb(var(--color-cream-rgb, 241 234 216) / <alpha-value>)",
          soft: "rgb(var(--color-cream-soft-rgb, 247 242 229) / <alpha-value>)",
          dim: "rgb(var(--color-cream-dim-rgb, 188 183 168) / <alpha-value>)"
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
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        card: ["var(--font-card)", "Josefin Sans", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 18px 70px rgba(0, 0, 0, 0.34)",
        glow: "0 0 34px rgba(241, 234, 216, 0.1)",
        note: "0 18px 40px rgba(9, 21, 60, 0.32)",
        "note-lift": "0 30px 70px rgba(9, 21, 60, 0.42)"
      }
    }
  },
  plugins: []
};

export default config;
