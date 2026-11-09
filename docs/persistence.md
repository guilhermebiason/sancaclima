# Persistência meteorológica — ClimaBR

## Objetivo

Armazenar os dados processados pelo pipeline INMET em PostgreSQL, preservando proveniência, qualidade e possibilidade de reprocessamento. O dashboard permanece fora desta etapa até a validação do ciclo de gravação e leitura.

## Banco e dependências

- PostgreSQL 15+ (compatível com Neon).
- Cliente Node.js: pacote `pg`.
- Pool de conexões no servidor: `lib/meteorology/persistence/postgres-pool.ts`.
- Repositório: `lib/meteorology/persistence/postgres-repository.ts`.

Após atualizar a branch, instale as dependências e atualize o lockfile:

```powershell
npm install
```

A variável `DATABASE_URL` deve ser configurada apenas no ambiente de servidor. Não use prefixo `NEXT_PUBLIC_`, não a inclua no Git e não importe o pool em componentes client-side. Para Neon, prefira a connection string com pooling fornecida pelo painel. O pool usa TLS com validação de certificado e limita o máximo de conexões a cinco. Para um PostgreSQL local sem TLS, configure `DATABASE_SSL=false` apenas no ambiente local.

## Migração inicial

Arquivo: `db/migrations/0001_initial_meteorological_storage.sql`.

Aplicar uma vez em um banco PostgreSQL vazio, usando o SQL Editor do provedor ou uma ferramenta de migração. A migração cria:

| Tabela | Responsabilidade |
|---|---|
| `meteorological_data_sources` | Catálogo de provedores e produtos |
| `meteorological_stations` | Estações por identificador do provedor |
| `ingestion_runs` | Execuções, estado e contagens do pipeline |
| `raw_files` | Arquivo original recebido, hash SHA-256 e bytes originais |
| `raw_records` | Linhas interpretadas e payload bruto estruturado |
| `meteorological_observations` | Observações normalizadas, derivadas e agregadas |

O arquivo original é preservado em `BYTEA`. Para arquivos maiores ou retenção prolongada, o conteúdo poderá migrar para armazenamento de objetos sem alterar o modelo das observações.

## Fluxo implementado

`persistInmetImport` executa uma transação única:

1. Upsert da fonte e da estação.
2. Criação de `ingestion_runs`.
3. Preservação dos bytes originais em `raw_files` com SHA-256.
4. Inserção dos registros brutos em lotes.
5. Inserção/atualização das observações em lotes de até 300 linhas.
6. Atualização das contagens e conclusão da execução.
7. Commit; em erro, rollback e liberação da conexão.

IDs determinísticos das observações permitem reimportação sem duplicar a série normalizada: conflitos atualizam as observações existentes. Isso não significa deduplicação de execuções ou arquivos: cada importação cria um novo `ingestion_run`, preserva uma nova cópia do arquivo e grava novamente suas linhas brutas, identificadas pelo ID da execução. Assim, a série normalizada é idempotente, enquanto o histórico bruto mantém a trilha de auditoria de cada tentativa/importação. Antes de abrir a conexão, o repositório rejeita IDs brutos vazios ou duplicados, números de linha não positivos/não inteiros e números de linha repetidos dentro da mesma importação. Valores suspeitos permanecem armazenados com suas flags. O arquivo original não é alterado.

`readMeteorologicalObservations` consulta uma estação com filtro opcional de variáveis e limite máximo de 20.000 observações. Observações horárias/instantâneas/acumuladas usam o instante `observed_at` no intervalo semiaberto `[from, to)`. Resumos diários são selecionados pela sobreposição do período: `period_start < to` e `period_end > from`. Portanto, um resumo diário é retornado quando qualquer parte do seu dia de referência cruza o intervalo solicitado, mesmo que `observed_at` (posicionado no fim do dia) esteja fora dele. O resultado continua representando o dia completo, não uma estatística recalculada para o recorte.

## Testes

O teste `tests/inmet/postgres-repository.test.ts` usa o fixture real A711 e um cliente PostgreSQL simulado para verificar:
- transação, gravação do arquivo bruto e hash;
- contagem e parâmetros de 1.398 observações (horárias originais, ponto de orvalho e estatísticas diárias);
- preservação de valores suspeitos e flags;
- vínculo das observações horárias com registros brutos;
- rejeição de IDs e números de linha duplicados ou inválidos antes de abrir a conexão;
- rollback e liberação da conexão em caso de falha.

Execute as suítes de regressão:

```powershell
npm run test:inmet
npm run test:meteorology
npm run test:api
```

O teste `tests/integration/postgres-real.integration.test.ts` é uma verificação separada, executada contra um PostgreSQL real local no banco dedicado `climabr_test`. Ele não usa `DATABASE_URL` nem carrega `.env.local`; recebe a senha local pela variável temporária `CLIMABR_TEST_DB_PASSWORD`. Verifica os bytes GZIP, metadados e tamanho do arquivo, linhas brutas distintas com o mesmo timestamp, vínculos de proveniência, idempotência das observações e rollback após uma violação real de integridade. O teste remove somente os registros identificados pelos próprios IDs gerados para aquela execução.

Execute-o com a senha local de testes definida no ambiente:

```powershell
npx tsx --test tests/integration/postgres-real.integration.test.ts
```

**Escopo importante:** esse teste valida gravação, leitura temporal dos resumos diários, proveniência e transações diretamente contra PostgreSQL real. Usa exclusivamente o banco local dedicado `climabr_test`, com identificadores sintéticos isolados. Ele não executa o script completo de importação A711 nem valida uma conexão com Neon. A execução do importador e sua leitura de volta são uma etapa distinta, descrita abaixo.

Após aplicar a migração em um banco de desenvolvimento apropriado e configurar `DATABASE_URL` para esse banco, importe o fixture A711:

```powershell
npm run db:import:inmet-a711
```

Para importar outro CSV, informe o caminho como argumento:

```powershell
npm run db:import:inmet-a711 -- "C:\\dados\\estacao.csv"
```

O comando executa parser, normalização, controle de qualidade, cálculos de ponto de orvalho/resumos, persistência em uma transação e leitura de volta. Ele confere a quantidade recuperada e a preservação das 80 radiações negativas sinalizadas. Ele não é uma rotina automática nem deve ser exposto como endpoint público. Não execute esse importador contra produção/Neon sem uma decisão explícita e um plano de validação próprios.

## Decisões de modelagem

1. **Proveniência:** cada observação referencia fonte e estação; quando aplicável, também a execução e a linha bruta.
2. **Tempo:** timestamps são `TIMESTAMPTZ`; a aplicação envia ISO 8601 com offset explícito, normalmente UTC.
3. **Ausências:** `value` aceita `NULL`; ausência nunca é convertida em zero.
4. **Qualidade:** status e flags são persistidos sem apagar valores suspeitos.
5. **Cobertura:** campos de cobertura são colunas explícitas.
6. **Idempotência:** IDs de observação são determinísticos; conflito atualiza o registro existente.
7. **Consultas:** índices priorizam estação, variável e instante.
8. **Segurança:** acesso ao banco exclusivamente no servidor; segredo nunca é exposto ao navegador.

## Fora do escopo

- Conectar o dashboard ou substituir mocks.
- Criar coleta automática do INMET.
- Criar endpoints públicos.
- Configurar credenciais de produção.
- Definir retenção ou exclusão automática de dados brutos.
