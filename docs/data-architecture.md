# Arquitetura de dados meteorológicos — ClimaBR

## Objetivo

Evoluir o ClimaBR de um painel alimentado por dados simulados para uma plataforma acadêmica de aquisição, rastreabilidade, validação e análise de observações meteorológicas reais. A interface atual deve continuar funcionando durante a transição.

## Fluxo proposto

```text
Fonte primária: INMET / BDMEP (estação automática A711)
        |
        v
Recebimento e preservação do CSV bruto
        |
        v
Parser específico do formato INMET
        |
        v
Normalização para o modelo canônico
        |
        v
Controle de qualidade (flags, sem apagar evidências)
        |
        v
Armazenamento de observações
        |
        v
API do ClimaBR
        |
        v
Mapa, séries temporais, comparações e exportação
```

## Decisões iniciais

1. **Separar observação de previsão.** Uma observação é uma medição associada a um instante; uma previsão é um produto de modelo válido para um instante futuro e deve ter ciclo/horário de referência próprio.
2. **Preservar a origem.** Cada observação deve apontar para sua fonte e, quando possível, para o registro bruto que lhe deu origem.
3. **Distinguir tempo observado e tempo recebido.** observedAt representa quando a medição ocorreu; receivedAt, quando o ClimaBR a importou.
4. **Normalizar timestamps em UTC.** A conversão do horário original deve considerar explicitamente o fuso e a convenção documentada pelo provedor.
5. **Não converter ausência em zero.** Valores ausentes permanecem nulos e recebem sinalização de qualidade apropriada.
6. **Não descartar silenciosamente dados suspeitos.** Registros inválidos ou suspeitos devem ser rastreáveis, com status e flags de qualidade.
7. **Manter unidades explícitas.** Conversões devem ocorrer no adaptador ou na normalização e ser documentadas.
8. **Manter adaptadores por provedor.** O frontend não deve conhecer detalhes específicos do formato do INMET ou da REDEMET.

## Modelo canônico

Os contratos TypeScript estão em `types/meteorology.ts`:

- `MeteorologicalDataSource`: identificação do provedor/produto.
- `MeteorologicalStation`: estação e seu identificador no provedor.
- `MeteorologicalObservation`: variável, valor, unidade, tempos, agregação, qualidade e referência ao dado bruto.
- `IngestionRun`: rastreabilidade da execução de aquisição.

### Observações medidas, agregadas e derivadas

A variável meteorológica permanece independente da estatística aplicada. Por exemplo, temperatura mínima e máxima são ambas `air_temperature`; o campo `statistic` distingue `minimum`, `maximum` e `mean`. Isso evita criar uma variável canônica diferente para cada resumo estatístico.

O contrato de observação oferece os seguintes campos opcionais, preservando compatibilidade com os registros já existentes:

- `statistic`: `minimum`, `maximum`, `mean`, `sum`, `range` ou `count`.
- `periodStart` e `periodEnd`: limites do período analisado, em ISO 8601 UTC.
- `method`: `measured` (valor fornecido pela fonte), `calculated` (agregação estatística) ou `derived` (indicador calculado a partir de outras variáveis).
- `coverage`: quantidade esperada e disponível de registros e a razão de completude entre 0 e 1.

Para uma estatística diária, `aggregation` será `daily`, enquanto `statistic` informa qual resumo foi calculado. Uma observação horária da fonte continua sendo representada sem estatística adicional e pode indicar `method: "measured"`.

A cobertura precisa acompanhar agregações temporais. Uma série incompleta não deve ser apresentada como se garantisse o extremo diário. As regras para aceitar, sinalizar ou rejeitar estatísticas com cobertura parcial serão implementadas no módulo de cálculo, não presumidas pelo tipo.

As flags `insufficient_coverage` e `derived_from_suspect_data` permitem registrar limitações de qualidade sem apagar o resultado ou a sua proveniência.

O modelo legado em `types/station.ts` permanece em uso pelo dashboard. A integração Meteostat foi documentada como possível fonte complementar, mas não é necessária para o primeiro fluxo real.

## Primeiro recorte: INMET — estação automática A711 (São Carlos)

1. Receber um CSV horário do BDMEP e preservar o arquivo original.
2. Interpretar metadados, cabeçalhos, unidades e convenção temporal.
3. Normalizar as seis variáveis iniciais para MeteorologicalObservation.
4. Aplicar controle de qualidade preliminar, mantendo os valores de origem.
5. Testar parsing, normalização, sentinelas, timestamps e duplicatas.
6. Validar a amostra antes de definir persistência e integração com a interface.

A implementação inicial está em `lib/meteorology/providers/inmet/`; as decisões e limitações estão em `docs/inmet-integration.md`.

## Critérios de aceite da primeira integração

- Estação e arquivo de origem identificáveis.
- Horário original tratado como UTC e conversão documentada.
- Unidade e variável explícitas.
- Ausências não representadas como zero.
- Registros suspeitos preservados com flags.
- Testes automatizados cobrindo parsing e normalização.
- A interface atual continua operando com o provedor simulado até a integração ser validada.

## Fora do escopo desta etapa

- Substituir todos os dados do dashboard.
- Construir uma plataforma completa de previsão.
- Implementar radar ou satélite como parte do pipeline de observações de superfície.
- Adotar banco de dados antes de definir e validar o contrato de ingestão.

PostgreSQL/PostGIS é uma opção para a etapa de persistência, mas a escolha e o schema físico devem ser definidos depois que o primeiro fluxo real estiver validado.
