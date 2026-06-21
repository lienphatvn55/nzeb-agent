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
      </head>
      <body style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
