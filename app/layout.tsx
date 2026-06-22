import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'liênnhã. · NZEB Deep-Retrofit Decision Platform',
  description:
    'AI Agent hỗ trợ ra quyết định cải tạo sâu năng lượng tòa nhà — NSGA-III · XAI · QCVN 09:2017 · LEED v5 · TP.HCM Net-Zero 2050',
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* fonts for the step-3 cyber dashboard */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Geist:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
