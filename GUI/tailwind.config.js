// Language: JavaScript (CommonJS) | File: GUI/tailwind.config.js | Runtime: Tailwind CSS 3.4
// External dependency: none

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        void: '#050507',
        obsidian: '#0c0d10',
        graphite: '#14161b',
        ember: '#e11d48',
      },
    },
  },
  plugins: [],
};
