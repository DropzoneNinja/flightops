/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PPG weather score colors
        'weather-green': '#22c55e',
        'weather-yellow': '#eab308',
        'weather-orange': '#f97316',
        'weather-red': '#ef4444',
        'weather-amber': '#f59e0b',
        // Mobile-specific colors for outdoor visibility
        'mobile-primary': '#1e40af',
        'mobile-text': '#1f2937',
      },
      screens: {
        'mobile': '900px',  // Custom breakpoint for mobile support
      },
    },
  },
  plugins: [],
}
