import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NZEB Retrofit AI Agent',
  description: 'Smart City Decision Support Platform — Hanyang University ERICA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}