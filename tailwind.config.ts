import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        corner: {
          blue: "#2AA8DC",
          "blue-dark": "#2596c4",
          green: "#5BBF3E",
          "green-dark": "#4ea832",
        },
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        checkmark: {
          "0%": { transform: "scale(0) rotate(-45deg)", opacity: "0" },
          "50%": { transform: "scale(1.2) rotate(-45deg)" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-12deg)" },
          "75%": { transform: "rotate(12deg)" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        confettiFall: {
          "0%": { transform: "translateY(-100vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-out",
        slideUp: "slideUp 0.3s ease-out",
        slideDown: "slideDown 0.2s ease-out",
        scaleIn: "scaleIn 0.2s ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        checkmark: "checkmark 0.5s ease-out forwards",
        wiggle: "wiggle 0.5s ease-in-out",
        pulse2: "pulse2 2s ease-in-out infinite",
        confettiFall: "confettiFall 3s ease-in forwards",
        slideInRight: "slideInRight 0.3s ease-out",
        bounceIn: "bounceIn 0.5s ease-out",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "elevation-1": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "elevation-2": "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
        "elevation-3": "0 10px 25px -3px rgb(0 0 0 / 0.1), 0 4px 10px -4px rgb(0 0 0 / 0.05)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
