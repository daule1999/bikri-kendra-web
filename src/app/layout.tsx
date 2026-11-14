import type { Metadata } from 'next';
import './globals.css';
import { APP } from '@/core/config';
import { CONSOLE_GUARD_SCRIPT } from '@/core/config/console-guard';
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
      <head>{CONSOLE_GUARD_SCRIPT && <script dangerouslySetInnerHTML={{ __html: CONSOLE_GUARD_SCRIPT }} />}</head>
      <body className="antialiased">
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
