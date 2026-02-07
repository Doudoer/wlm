/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f6f0ff',
          100: '#efe5ff',
          200: '#e1ccff',
          300: '#c6a8ff',
          400: '#a773ff',
          500: '#7e3cff',
          600: '#6b2eda',
          700: '#5a24b2',
          800: '#471a88',
          900: '#32125e'
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#0b1220'
        }
      }
    }
  },
  plugins: []
}
