import type { Metadata } from 'next';
import './globals.css';
import { APP, RuntimeBootstrap } from '@/core/config';
import { AuthProvider } from '@/core/auth';
// PHASE 1 COMPAT providers used by ported pages
import StoreProvider from '@/store/StoreProvider';
import { ShopProvider } from '@/hooks/useShop';
import { ThemeProvider } from '@/lib/theme';
import GlobalLoader from '@/components/GlobalLoader';

export const metadata: Metadata = { title: APP.title, description: APP.description };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <RuntimeBootstrap />
        <AuthProvider>
          <ThemeProvider>
            <StoreProvider>
              <ShopProvider>
                <GlobalLoader />
                {children}
              </ShopProvider>
            </StoreProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
