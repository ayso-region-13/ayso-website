/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,njk,md,js}"],
  theme: {
    extend: {
      colors: {
        'brand-red':         '#f74b4b',
        'brand-red-dark':    '#83312d',
        'brand-header':      '#230511',
        'brand-maroon':      '#8e2929',
        'brand-maroon-dark': '#3a0d12',
        'brand-cream':       '#ede8e2',
        'brand-green':       '#a6ce57',
        'brand-green-dark':  '#007a32',
        'brand-green-light': '#00d050',
        'brand-gold':        '#f4bd4d',
        'brand-dark':        '#221f1f',
      },
      fontFamily: {
        sans: ['Raleway', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-links': '#83312d',
            maxWidth: 'none',
          },
        },
      },
    },
  },
  plugins: [],
}
