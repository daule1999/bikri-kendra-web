import type { Metadata } from 'next';
import './globals.css';
import { APP } from '@/core/config';
import { AuthProvider } from '@/core/auth';

export const metadata: Metadata = { title: APP.title, description: APP.description };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
