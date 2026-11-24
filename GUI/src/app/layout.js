// Language: JavaScript (React / Next.js App Router) | File: GUI/src/app/layout.js | Runtime: Next.js 15 / React 19
// External dependency: next/font/google (no network fetch at runtime; bundled at build time)

import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Night AI',
  description: 'Private Luau engineering & execution workstation',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="bg-[#050507] text-[#e6e8ee] font-sans antialiased selection:bg-rose-600/30 selection:text-rose-200 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
