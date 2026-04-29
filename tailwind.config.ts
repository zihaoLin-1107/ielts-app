import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        paper: "#fbfaf7",
        sage: "#4f7661"
      }
    }
  },
  plugins: []
};

export default config;
