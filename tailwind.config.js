/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-text-primary) / <alpha-value>)',
        muted: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        line: 'rgb(var(--color-border) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--color-accent-hover) / <alpha-value>)',
        moss: 'rgb(var(--color-moss) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-ui)'],
        serif: ['"Noto Serif JP"', '"Yu Mincho"', 'serif'],
      },
      boxShadow: { soft: '0 18px 60px rgba(45, 39, 30, 0.1)' },
    },
  },
  plugins: [],
}
