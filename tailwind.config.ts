import type { Config } from "tailwindcss";

// DecisionPassport 3.0 tokens mirror app/globals.css. Hex values live only
// in globals.css and components/chart-tokens.ts (for SVG/Recharts).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "var(--obsidian)",
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        text: "var(--text)",
        muted: "var(--text-muted)",
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        accent: { DEFAULT: "var(--accent)", soft: "var(--accent-soft)" },
        action: { DEFAULT: "var(--action)", soft: "var(--action-soft)" },
        success: "var(--success)",
        danger: "var(--danger)",

        // Transitional semantic aliases for existing feature components.
        paper: "var(--canvas)",
        sheet: "var(--surface)",
        ink: { DEFAULT: "var(--text)", muted: "var(--text-muted)" },
        graphite: {
          DEFAULT: "var(--obsidian)",
          soft: "var(--obsidian-soft)",
          line: "var(--obsidian-line)",
        },
        signal: {
          DEFAULT: "var(--action)",
          tint: "var(--action-soft)",
          1: "var(--action-step-1)",
          2: "var(--action-step-2)",
          3: "var(--action-step-3)",
        },
        rule: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
      },
      fontFamily: {
        document: "var(--font-ui)",
        ui: "var(--font-ui)",
        technical: "var(--font-technical)",
      },
      fontSize: {
        meta: ["12px", { lineHeight: "16px" }],
        table: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "21px" }],
        lead: ["16px", { lineHeight: "24px" }],
        section: ["20px", { lineHeight: "26px" }],
        decision: ["28px", { lineHeight: "34px" }],
        page: ["34px", { lineHeight: "40px" }],
        hero: ["40px", { lineHeight: "44px" }],
      },
      borderRadius: {
        DEFAULT: "var(--radius-sm)",
        control: "var(--radius-control)",
        panel: "var(--radius-panel)",
        none: "0",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        overlay: "var(--shadow-overlay)",
        none: "none",
      },
      spacing: {
        rail: "80px",
      },
    },
  },
  plugins: [],
};

export default config;
