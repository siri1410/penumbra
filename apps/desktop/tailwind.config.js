/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        penumbra: {
          bg: 'rgba(12, 12, 18, 0.78)',
          panel: 'rgba(22, 22, 32, 0.85)',
          border: 'rgba(255, 255, 255, 0.08)',
          accent: '#9b87f5',
          muted: 'rgba(255, 255, 255, 0.55)',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        overlay: '0 20px 60px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
