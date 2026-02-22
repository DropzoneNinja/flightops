/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Inter Variable', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
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
        // Sky Archive theme colors
        sky: {
          dawn: '#FFB5A7',       // Soft coral for accents
          morning: '#87CEEB',    // Sky blue for primary elements
          midday: '#E8F4F8',     // Pale blue for backgrounds
          dusk: '#4A5568',       // Slate gray for text
          night: '#1A202C',      // Deep navy for headers
          cloud: '#F7FAFC',      // Almost white for cards
        },
      },
      screens: {
        'mobile': '900px',  // Custom breakpoint for mobile support
      },
      boxShadow: {
        'elevation': '0 2px 8px rgba(74, 85, 104, 0.1)',
        'elevation-md': '0 4px 16px rgba(74, 85, 104, 0.12)',
        'elevation-lg': '0 8px 24px rgba(74, 85, 104, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'stagger-fade': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
