import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
