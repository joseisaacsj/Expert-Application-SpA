/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0DB3AE',
          dark: '#0A8F8B',
          light: '#5ADEDB',
        },
        ink: {
          DEFAULT: '#0D1B2A',
          soft: '#1B2E42',
          muted: '#41576E',
        },
        semaforo: {
          verde: '#16A34A',
          amarillo: '#EAB308',
          critico: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
