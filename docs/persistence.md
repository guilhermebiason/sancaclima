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

A variável `DATABASE_URL` deve ser configurada apenas no ambiente de servidor. Não use prefixo `NEXT_PUBLIC_`, não a inclua no Git e não importe o pool em componentes client-side. O pool usa TLS com validação de certificado e limita o máximo de conexões a cinco.

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

IDs determinísticos das observações permitem reimportação sem duplicar a série. As linhas brutas são identificadas por execução para manter a trilha de auditoria de cada importação. Valores suspeitos permanecem armazenados com suas flags. O arquivo original não é alterado.

`readMeteorologicalObservations` consulta uma estação em intervalo semiaberto `[from, to)`, com filtro opcional de variáveis e limite máximo de 20.000 observações.

## Testes

O teste `tests/inmet/postgres-repository.test.ts` usa o fixture real A711 e um cliente PostgreSQL simulado para verificar:
- transação, gravação do arquivo bruto e hash;
- contagem e parâmetros de 1.398 observações (horárias originais, ponto de orvalho e estatísticas diárias);
- preservação de valores suspeitos e flags;
- vínculo das observações horárias com registros brutos;
- rollback e liberação da conexão em caso de falha.

Execute:

```powershell
npm run test:inmet
```

Esse teste valida a lógica de persistência e o contrato SQL com um cliente simulado. **Não substitui o teste com um PostgreSQL real.** A validação real ainda exige configurar um banco de desenvolvimento, aplicar a migração e executar o importador contra esse banco, conferindo as contagens e uma leitura de volta.

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
