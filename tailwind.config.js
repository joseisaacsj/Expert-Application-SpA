/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta inspirada en el logo EA: ámbar/miel suavizado.
        brand: {
          DEFAULT: '#D97706',
          dark: '#B45309',
          light: '#F5C86B',
        },
        cream: '#FBF3E3',
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
