import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", ".dark"],

  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: { lg: "0.75rem", md: "0.5rem", sm: "0.375rem" }
    }
  },
  plugins: []
} satisfies Config;
