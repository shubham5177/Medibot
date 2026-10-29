import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        sunk: token("sunk"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        brand: { DEFAULT: token("brand"), soft: token("brand-soft"), on: token("brand-on") },
        sky: token("sky"),
        leaf: token("leaf"),
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
