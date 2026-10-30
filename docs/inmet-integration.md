# Integração inicial — INMET A711 (São Carlos)

## Objetivo e fonte

A primeira fonte operacional do ClimaBR será o INMET, por meio de arquivos CSV horários de estações automáticas disponibilizados pelo BDMEP. O arquivo é solicitado no portal oficial e entregue por link temporário. O BDMEP permite selecionar estação, período e variáveis; o link de download tem validade limitada.

- Portal: https://bdmep.inmet.gov.br/
- Página institucional: https://portal.inmet.gov.br/servicos/bdmep-dados-historicos
- Catálogo de estações automáticas: https://portal.inmet.gov.br/paginas/catalogoaut
- Tabela de estações e dados recentes: https://tempo.inmet.gov.br/TabelaEstacoes/

O BDMEP também oferece pacotes históricos anuais de estações automáticas. A coleta programática direta de observações recentes não faz parte desta primeira etapa; o primeiro fluxo é baseado em CSV fornecido pelo usuário.

## Estação-alvo

| Campo | Valor observado no arquivo de amostra |
|---|---|
| Nome | SAO CARLOS |
| Código | A711 |
| Latitude | -21.98027777 |
| Longitude | -47.88388888 |
| Altitude | 859,29 m |
| Situação | Operante |

Os metadados devem ser lidos de cada arquivo recebido. Não assumir que todo arquivo futuro será da A711 apenas porque esta é a estação inicial.

## Formato de entrada validado

O CSV de amostra contém nove linhas de metadados, uma linha de cabeçalho e registros delimitados por ponto e vírgula. O arquivo termina cada linha de dados com um delimitador adicional, que produz uma coluna vazia e deve ser ignorado.

- Codificação observada: UTF-8.
- Separador de campos: ponto e vírgula.
- Separador decimal observado: vírgula.
- Data: `YYYY-MM-DD`.
- Hora: `HHMM`, indicada como UTC no padrão de dados horários do INMET.
- O parser também aceita separador decimal ponto, campos vazios e os sentinelas `-9999` e `9999` como ausência.

O portal BDMEP permite escolher ponto ou vírgula como separador decimal. O parser não depende da posição fixa das colunas: identifica os campos pelos nomes dos cabeçalhos.

## Variáveis mapeadas

| Cabeçalho do INMET | Variável canônica | Unidade | Agregação |
|---|---|---:|---|
| Precipitação total, horário | `precipitation` | mm | accumulated |
| Radiação global | `solar_radiation` | kJ/m² | accumulated |
| Temperatura do ar — bulbo seco | `air_temperature` | °C | hourly |
| Umidade relativa do ar | `relative_humidity` | % | hourly |
| Vento — direção horária | `wind_direction` | ° | hourly |
| Vento — velocidade horária | `wind_speed` | m/s | hourly |

A unidade e a definição exata da medição devem permanecer associadas à variável. Não converter velocidade do vento para km/h nesta etapa.

## Estatísticas e indicadores

O modelo canônico mantém a variável independente da estatística. Assim, temperatura mínima, máxima e média usam `variable: "air_temperature"` e distinguem-se por `statistic: "minimum" | "maximum" | "mean"`. Resultados agregados usam `aggregation: "daily"`, informam `periodStart` e `periodEnd`, e registram `method: "calculated"`.

Os campos `coverage.expectedRecords`, `coverage.availableRecords` e `coverage.completenessRatio` registram a completude da série usada no cálculo. A política para cobertura parcial deverá ser definida no módulo de cálculo e refletida nas flags de qualidade.

**Limitação importante:** calcular mínima e máxima a partir das temperaturas horárias produz extremos observados na série horária. Esses valores não devem ser rotulados como extremos oficiais diários, pois podem não capturar extremos ocorridos entre os horários amostrados. Para extremos oficiais, será necessário ingerir o produto diário correspondente do INMET, quando disponível.

Para agregações diárias locais, o período deve respeitar o fuso `America/Sao_Paulo`; os limites efetivos devem ser armazenados em UTC. Não agrupar por data UTC sem conversão explícita para o dia local.

## Ponto de orvalho e agregações diárias

O ponto de orvalho não é uma variável fornecida pelo CSV horário analisado. O ClimaBR o calcula como indicador derivado a partir de temperatura do ar e umidade relativa correspondentes ao mesmo timestamp.

A implementação está em `lib/meteorology/calculations/daily-summaries.ts` e utiliza a aproximação de Magnus:

```text
a = 17,625
b = 243,04 °C
gamma = ln(UR / 100) + (a × T) / (b + T)
Td = (b × gamma) / (a - gamma)
```

Onde T é a temperatura do ar em °C, UR é a umidade relativa em porcentagem e Td é o ponto de orvalho em °C. A aproximação é usada como estimativa operacional; não substitui uma medição direta nem métodos de maior precisão em aplicações especializadas. Umidade relativa igual a zero, valores ausentes ou entradas fora dos intervalos aceitos não geram ponto de orvalho.

O resultado horário usa `variable: "dew_point_temperature"`, `method: "derived"` e mantém o timestamp das duas observações de entrada. As estatísticas diárias do ponto de orvalho são calculadas a partir desses resultados horários.

O mesmo módulo calcula mínima, máxima e média diárias para temperatura do ar e ponto de orvalho. O dia é definido pelo fuso `America/Sao_Paulo`; os limites do período são armazenados em UTC. O fim do período é exclusivo. A cobertura esperada é calculada pela duração real do dia no fuso, permitindo dias de 23 ou 25 horas caso regras de horário de verão sejam aplicáveis.

Por padrão, uma cobertura inferior a 75% é sinalizada com `insufficient_coverage` e o resumo permanece disponível com qualidade `suspect`. A política é configurável por `minimumCoverage`. Somente observações com qualidade `valid` participam dos cálculos; valores ausentes, duplicados ou suspeitos não são usados silenciosamente. A cobertura representa registros válidos disponíveis em relação aos horários esperados.

As mínimas e máximas obtidas da série horária continuam sendo extremos amostrais da série, não extremos oficiais intrahorários do INMET.

## Auditoria da amostra A711

Arquivo recebido: `dados_A711_H_2026-10-22_2026-10-29.csv`.

- 192 registros horários, cobrindo oito datas de calendário (22 a 29/10/2026, inclusive).
- 192 timestamps únicos e consecutivos no intervalo do arquivo.
- Seis variáveis meteorológicas presentes.
- Não foram encontrados campos vazios ou sentinelas de ausência nas seis colunas de medição.
- Foram encontrados 80 valores negativos de radiação global, entre -3,5 e -0,1 kJ/m².

Os valores negativos de radiação são preservados no dado normalizado e recebem `outside_physical_range`. Não são substituídos por zero nem removidos. O sinalizador é um controle preliminar de plausibilidade, não uma correção nem uma conclusão sobre defeito do sensor.

## Convenção temporal

Os horários dos arquivos horários do INMET são tratados como UTC. O parser constrói timestamps ISO 8601 com sufixo `Z`. A conversão para `America/Sao_Paulo` deve ocorrer somente na camada de apresentação ou em agregações locais explicitamente definidas.

## Código

- `types.ts`: tipos do formato bruto do INMET.
- `parser.ts`: leitura dos metadados, cabeçalhos, datas e números.
- `normalizer.ts`: conversão para os contratos canônicos em `types/meteorology.ts`.
- `quality-control.ts`: flags iniciais sem apagar os valores originais.
- `tests/inmet/parser.test.ts`: testes automatizados de parsing, normalização, sentinelas, timestamps, qualidade e compatibilidade do modelo com estatísticas diárias.

### Executar os testes

```bash
npm run test:inmet
```

## Limites desta etapa

1. O CSV bruto deve ser preservado sem alteração pelo processo que o recebe. O parser não substitui o armazenamento de arquivo bruto nem cria ainda um repositório de ingestões.
2. Os limites físicos em `quality-control.ts` são filtros amplos e provisórios. Não substituem controle climatológico, inspeção de sensor ou comparação com estações vizinhas.
3. O parser foi implementado com base no layout da amostra recebida. Novas variantes de layout devem ser adicionadas com fixtures e testes antes de serem aceitas.
4. O dashboard continua usando os mocks até que o pipeline seja validado e a persistência seja definida.
