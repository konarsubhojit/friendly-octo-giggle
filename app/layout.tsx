import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import StoreProvider from "@/components/providers/StoreProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/next';

function AppProviders({ children }: { readonly children: React.ReactNode }) {
  return (
    <StoreProvider>
      <CurrencyProvider>
        <SessionProvider>
          {children}
        </SessionProvider>
      </CurrencyProvider>
    </StoreProvider>
  );
}

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Kiyon Store",
  description: "Discover beautiful handmade decorations and cozy wearables — flower bouquets, keyrings, hand warmers, mufflers, scarves, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={nunito.className}>
      <body className="antialiased">
        <AppProviders>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#fef7f2',
                color: '#4a3728',
                border: '1px solid #f0d5c0',
                borderRadius: '16px',
              },
            }}
          />
        </AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
