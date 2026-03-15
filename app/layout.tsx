import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import StoreProvider from "@/components/providers/StoreProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/next';

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
    <html lang="en">
      <body className="antialiased">
        <StoreProvider>
          <CurrencyProvider>
            <SessionProvider>
              {children}
              <Toaster position="top-right" />
            </SessionProvider>
          </CurrencyProvider>
        </StoreProvider>
        <Analytics />
      </body>
    </html>
  );
}
