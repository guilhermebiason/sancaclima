# ClimaBR

Painel meteorológico moderno para o Brasil: estações, mapa Mapbox, heatmap, satélite GOES e radar.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- next-themes
- Mapbox GL JS + react-map-gl
- Recharts

## Como rodar

1. Copie `.env.example` para `.env.local` e preencha o token:

```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.seu_token
```

2. Instale e inicie:

```
npm install
npm run dev
```

Os dados das estações ainda são mockados (INMET/REDEMET realistas). A camada de satélite usa NASA GIBS (GOES-East GeoColor). A camada de radar usa tiles públicos no mesmo formato XYZ esperado por uma futura integração REDEMET/FAB.
