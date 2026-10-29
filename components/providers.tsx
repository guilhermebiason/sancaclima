"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { FavoritesProvider } from "@/hooks/useFavorites";
import { StationsProvider } from "@/hooks/useStations";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <StationsProvider>
        <FavoritesProvider>{children}</FavoritesProvider>
      </StationsProvider>
    </ThemeProvider>
  );
}
