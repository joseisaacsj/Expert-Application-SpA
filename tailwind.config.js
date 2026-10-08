/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta inspirada en el logo Saint-Jérôme: rojo león + carbón cálido.
        brand: {
          DEFAULT: '#C4352C',
          dark: '#A32B23',
          light: '#F0B9B5',
        },
        cream: '#F7F4F1',
        ink: {
          DEFAULT: '#262220',
          soft: '#332E2B',
          muted: '#574F4A',
        },
        semaforo: {
          verde: '#16A34A',
          amarillo: '#EAB308',
          naranja: '#EA580C',
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
