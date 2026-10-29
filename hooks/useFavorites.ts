"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readFavorites, writeFavorites } from "@/lib/storage";

interface FavoritesContextValue {
  favorites: string[];
  hydrated: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(readFavorites());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeFavorites(favorites);
  }, [favorites, hydrated]);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((current) => current.filter((item) => item !== id));
  }, []);

  const value = useMemo(
    () => ({ favorites, hydrated, isFavorite, toggleFavorite, removeFavorite }),
    [favorites, hydrated, isFavorite, toggleFavorite, removeFavorite],
  );

  return createElement(FavoritesContext.Provider, { value }, children);
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites deve ser usado dentro de FavoritesProvider");
  }
  return context;
}
