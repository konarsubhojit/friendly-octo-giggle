import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import StoreProvider from "@/components/providers/StoreProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: "E-commerce Store",
  description: "Highly scalable e-commerce website with Next.js, Redis, and PostgreSQL",
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
      </body>
    </html>
  );
}
