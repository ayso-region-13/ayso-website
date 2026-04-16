/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,njk,md,js}"],
  theme: {
    extend: {
      colors: {
        'brand-red':         '#ff3c3c',
        'brand-red-dark':    '#e02020',
        'brand-header':      '#230612',
        'brand-maroon':      '#8e2929',
        'brand-green':       '#00ae42',
        'brand-green-dark':  '#007a32',
        'brand-green-light': '#00d050',
        'brand-gold':        '#f5bd4c',
        'brand-dark':        '#231f20',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
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
