/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "oestra-purple": "#3D2B4E",
        "oestra-cream": "#FAF7F2",
        "oestra-blush": "#C84A5C",
        "oestra-mist": "#E8E4DD",
        "oestra-text": "#2D2A2E",
        "oestra-text-light": "#6B6770",
      },
      fontFamily: {
        serif: ["CormorantGaramond_400Regular"],
        "serif-medium": ["CormorantGaramond_500Medium"],
        "serif-bold": ["CormorantGaramond_700Bold"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-bold": ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
