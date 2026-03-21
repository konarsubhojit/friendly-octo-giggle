import type { Metadata } from "next";
import { Nunito, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import StoreProvider from "@/components/providers/StoreProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

const AppProviders = ({ children }: { readonly children: React.ReactNode }) => {
  return (
    <StoreProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <SessionProvider>{children}</SessionProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </StoreProvider>
  );
};

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "The Kiyon Store",
  description:
    "Handmade crochet flowers, bags, keychains, and accessories — crafted with love, delivered to your door.",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html
      lang="en"
      className={`${nunito.className} ${playfairDisplay.variable}`}
    >
      <body className="antialiased">
        <AppProviders>
          <HeaderWrapper />
          <div className="relative">{children}</div>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--surface)",
                color: "var(--foreground)",
                border: "1px solid var(--border-warm)",
                borderRadius: "16px",
              },
            }}
          />
        </AppProviders>
        <Analytics />
      </body>
    </html>
  );
};
export default RootLayout;
