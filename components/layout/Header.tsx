"use client";

import { Heart, Menu, Radar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { StationCard } from "@/components/stations/StationCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useFavorites } from "@/hooks/useFavorites";
import { useStations } from "@/hooks/useStations";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/mapa", label: "Mapa" },
  { href: "/graficos", label: "Gráficos & Filtros" },
  { href: "/sobre", label: "Sobre" },
];

export function Header() {
  const pathname = usePathname();
  const { favorites } = useFavorites();
  const { stations } = useStations();
  const favoriteStations = useMemo(
    () => stations.filter((station) => favorites.includes(station.id)),
    [stations, favorites],
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
            <Radar className="h-5 w-5" />
          </span>
          <span>
            Clima<span className="text-cyan-600 dark:text-cyan-400">BR</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Favoritos">
                <Heart />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Estações favoritas</SheetTitle>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                {favoriteStations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma estação favorita ainda. Use o coração nos cards ou no mapa.
                  </p>
                ) : (
                  favoriteStations.map((station) => (
                    <StationCard key={station.id} station={station} />
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Navegação</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2">
                {LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-xl px-3 py-3 text-sm hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
