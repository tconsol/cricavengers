/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e8eef7',
          100: '#c5d5ec',
          200: '#9fb9df',
          300: '#799dd2',
          400: '#5d88c8',
          500: '#4173be',
          600: '#3b6bb7',
          700: '#3260ae',
          800: '#2a56a6',
          900: '#1E3A5F',
          DEFAULT: '#1E3A5F',
        },
        accent: {
          DEFAULT: '#F4A200',
          light:   '#FFD166',
          dark:    '#C68000',
        },
        danger:  '#EF4444',
        success: '#22C55E',
        surface: '#F8FAFC',
        dark: {
          bg:      '#0F172A',
          card:    '#1E293B',
          border:  '#334155',
        },
      },
      fontFamily: {
        sans:  ['System'],
        mono:  ['Courier'],
      },
    },
  },
  plugins: [],
};
