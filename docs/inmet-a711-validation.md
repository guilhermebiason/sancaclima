# Validação com CSV real — INMET A711

## Escopo

Esta validação exercita o fluxo real de parsing, normalização, controle de qualidade e cálculo de indicadores sobre o arquivo BDMEP:

- Arquivo de origem: `dados_A711_H_2026-10-22_2026-10-29.csv`
- Estação: A711 — SAO CARLOS
- Coordenadas: -21.98027777, -47.88388888
- Período declarado no arquivo: 22 a 29/10/2026
- Registros horários: 192
- Recebimento fixado no teste: `2026-10-30T00:00:00.000Z`

O fixture está armazenado em `tests/fixtures/inmet/dados_A711_H_2026-10-22_2026-10-29.csv.gz.base64`: é o CSV original comprimido com gzip e codificado em Base64 para manter o repositório compacto. O teste descomprime o conteúdo em memória; nenhum dado é alterado antes do parser.

## Resultado esperado

O arquivo contém 192 timestamps UTC consecutivos e seis variáveis normalizadas por registro, totalizando 1.152 observações. Foram identificados 80 valores negativos de radiação global. Todos permanecem preservados e recebem a flag `outside_physical_range`, com qualidade `suspect`.

O deslocamento de UTC para `America/Sao_Paulo` faz com que o período cubra nove datas locais: 21 a 29/10. Isso é esperado: as primeiras três horas UTC de 22/10 pertencem ao dia local 21/10, e as últimas 21 horas UTC de 29/10 pertencem ao dia local 29/10.

| Data local | Registros válidos | Cobertura | Qualidade do resumo |
|---|---:|---:|---|
| 21/10 | 3 | 12,5% | suspect |
| 22/10 | 24 | 100% | valid |
| 23/10 | 24 | 100% | valid |
| 24/10 | 24 | 100% | valid |
| 25/10 | 24 | 100% | valid |
| 26/10 | 24 | 100% | valid |
| 27/10 | 24 | 100% | valid |
| 28/10 | 24 | 100% | valid |
| 29/10 | 21 | 87,5% | valid |

A cobertura é calculada por variável e dia. O dia 29 é parcial, embora ultrapasse o limiar configurado de 75%; o resumo continua marcado como válido segundo essa política. O dia 21 fica abaixo do limiar e recebe `insufficient_coverage`.

## Valores de referência

Os valores abaixo são usados como asserções de regressão no teste. Temperaturas em °C:

| Data local | Tmin | Tmax | Temperatura média | Ponto de orvalho médio |
|---|---:|---:|---:|---:|
| 21/10* | 19,5 | 21,7 | 20,666667 | 13,774562 |
| 22/10 | 15,9 | 25,0 | 20,237500 | 15,711997 |
| 23/10 | 17,9 | 21,0 | 19,179167 | 17,356229 |
| 24/10 | 18,1 | 28,1 | 22,191667 | 18,965282 |
| 25/10 | 17,6 | 23,6 | 20,145833 | 19,164901 |
| 26/10 | 14,3 | 25,2 | 19,908333 | 15,919572 |
| 27/10 | 12,1 | 24,5 | 18,387500 | 11,005233 |
| 28/10 | 16,3 | 25,8 | 20,654167 | 15,878668 |
| 29/10* | 18,4 | 21,3 | 19,566667 | 18,373360 |

`*` O dia 21 tem cobertura insuficiente; o dia 29 tem cobertura parcial. Os extremos são mínimos e máximos da amostra horária, não extremos oficiais intrahorários.

## Teste automatizado

O teste `tests/inmet/real-csv.integration.test.ts` verifica:

1. Metadados da estação e contagem de 192 registros.
2. 1.152 observações normalizadas.
3. Preservação e sinalização dos 80 valores negativos de radiação.
4. 192 pontos de orvalho horários derivados.
5. 54 estatísticas diárias (nove dias × duas variáveis × três estatísticas).
6. Cobertura e qualidade do dia 21 e do dia 29.
7. Valores de referência de temperatura e ponto de orvalho para 22/10.

Execute com:

```bash
npm run test:inmet
```

Este teste valida o pipeline de processamento em memória. Não valida ainda ingestão automática, persistência, API ou integração com o dashboard.
