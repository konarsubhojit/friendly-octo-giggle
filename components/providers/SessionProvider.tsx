"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export const SessionProvider = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
};
