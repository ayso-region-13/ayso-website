/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,njk,md,js}"],
  theme: {
    extend: {
      colors: {
        'brand-red':         '#ff3c3c',
        'brand-red-dark':    '#ce0e2d',
        'brand-header':      '#230612',
        'brand-maroon':      '#8e2929',
        'brand-maroon-dark': '#3a0d12',
        'brand-cream':       '#ede5d3',
        'brand-green':       '#a7ce57',
        'brand-green-dark':  '#007a32',
        'brand-green-light': '#00d050',
        'brand-gold':        '#f5bd4e',
        'brand-dark':        '#231f20',
      },
      fontFamily: {
        sans: ['Raleway', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-links': '#ce0e2d',
            maxWidth: 'none',
          },
        },
      },
    },
  },
  plugins: [],
}
