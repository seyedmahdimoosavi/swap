/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Your global.css already provides a reset + the full theme, so Tailwind's
  // preflight is disabled to avoid fighting it. Tailwind only adds utilities.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        // Mirrors the CSS variables in :root so utilities render identically.
        gold: { DEFAULT: '#F5BC27', light: '#ffd35c', dark: '#c99518' },
        surface: '#232323',
        field: '#515151',
        'in-range': '#00ff64',
        'out-range': '#ff6400',
        danger: '#ff6b6b',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
