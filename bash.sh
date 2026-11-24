# Language: Bash | Context: Repository root (same level as brain/ and GUI/) | Runtime: POSIX Shell / Git
# External dependency: none

# Target path: <your-repo-root>/bash.sh
# Run from <your-repo-root>: bash bash.sh

set -euo pipefail

test -d GUI

cat << 'EOF' > GUI/tailwind.config.js
/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
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

export default tailwindConfig;
EOF

cat << 'EOF' > GUI/postcss.config.js
const postcssConfig = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default postcssConfig;
EOF

git add GUI/tailwind.config.js GUI/postcss.config.js
git commit -m "fix(GUI): export tailwind and postcss configs as ESM"
git push
