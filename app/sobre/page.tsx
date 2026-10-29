import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STACK = [
  "Next.js 15 (App Router) + TypeScript",
  "Tailwind CSS + shadcn/ui",
  "next-themes (claro/escuro)",
  "Mapbox GL JS + react-map-gl",
  "Recharts",
  "Framer Motion (quando necessário)",
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Sobre o projeto</h1>
        <p className="text-muted-foreground">
          ClimaBR é um painel meteorológico focado no Brasil: estações, mapa
          interativo, heatmap, satélite GOES da América do Sul e radar. Nesta
          fase os dados das estações são mockados de forma realista para
          desenvolver a interface enquanto a API oficial é integrada.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Objetivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Dar uma visão clara do tempo em tempo quase real, com camadas que
              meteorologistas e entusiastas realmente usam: estações, satélite e
              radar.
            </p>
            <p>
              Favoritos ficam no LocalStorage do navegador, sem login. O token do
              Mapbox entra via <code>NEXT_PUBLIC_MAPBOX_TOKEN</code>.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tecnologias</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {STACK.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
