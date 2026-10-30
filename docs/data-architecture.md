# Arquitetura de dados meteorológicos — ClimaBR

## Objetivo

Evoluir o ClimaBR de um painel alimentado por dados simulados para uma plataforma acadêmica de aquisição, rastreabilidade, validação e análise de observações meteorológicas reais. A interface atual deve continuar funcionando durante a transição.

## Fluxo proposto

```text
Provedor (primeiro: INMET)
        |
        v
Adaptador de aquisição
        |
        v
Preservação do dado bruto + metadados da coleta
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

## Modelo canônico inicial

Os contratos TypeScript estão em types/meteorology.ts:

- MeteorologicalDataSource: identificação do provedor/produto.
- MeteorologicalStation: estação e seu identificador no provedor.
- MeteorologicalObservation: variável, valor, unidade, tempos, agregação, qualidade e referência ao dado bruto.
- IngestionRun: rastreabilidade da execução de aquisição.

O modelo legado em types/station.ts permanece em uso pelo dashboard. A migração para o modelo canônico deve acontecer por etapas, sem substituir os dados simulados antes de existir uma integração real validada.

## Primeiro recorte: INMET

1. Documentar o produto/endpoint ou arquivo oficial que será utilizado.
2. Definir quais variáveis e estações estão disponíveis nesse produto.
3. Implementar um adaptador isolado para aquisição.
4. Preservar uma amostra bruta com data de coleta e referência da origem.
5. Normalizar uma amostra para MeteorologicalObservation.
6. Aplicar validações básicas e registrar flags.
7. Testar parsing, unidades, timestamps, ausências e duplicatas.

## Critérios de aceite da primeira integração

- Uma amostra real do INMET é identificável e rastreável até sua origem.
- Horário original e conversão para UTC são documentados.
- Unidade e variável são explícitas.
- Ausências não são representadas como zero.
- Registros suspeitos não são silenciosamente removidos.
- Testes automatizados cobrem parsing e normalização.
- A interface atual continua operando com o provedor simulado até a integração ser validada.

## Fora do escopo desta etapa

- Substituir todos os dados do dashboard.
- Construir uma plataforma completa de previsão.
- Implementar radar ou satélite como parte do pipeline de observações de superfície.
- Adotar banco de dados antes de definir e validar o contrato de ingestão.

PostgreSQL/PostGIS é uma opção para a etapa de persistência, mas a escolha e o schema físico devem ser definidos depois que o primeiro fluxo real estiver validado.
