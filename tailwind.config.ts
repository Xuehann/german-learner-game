import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        mobileLandscape: { raw: '(max-width: 1023px) and (orientation: landscape)' }
      },
      fontFamily: {
        heading: ['"Bree Serif"', 'Georgia', 'serif'],
        signboard: ['"Lobster"', '"Bree Serif"', 'Georgia', 'serif'],
        body: ['"Noto Sans SC"', '"Segoe UI"', 'sans-serif']
      },
      colors: {
        butcher: {
          cream: '#f7efe1',
          wood: '#8d5a38',
          deep: '#492b17',
          red: '#b7422d',
          green: '#2f6b43'
        }
      },
      boxShadow: {
        board: '0 18px 40px rgba(73, 43, 23, 0.25)'
      }
    }
  },
  plugins: []
} satisfies Config;
