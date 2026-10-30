# Persistência meteorológica — ClimaBR

## Objetivo

Introduzir armazenamento PostgreSQL sem conectar ainda o dashboard ao banco. A primeira implantação deve aceitar o pipeline já validado com o CSV real INMET A711, preservar proveniência e permitir reprocessamento idempotente.

## Banco escolhido

PostgreSQL 15 ou superior. O schema é compatível com Neon, mas não depende de recursos proprietários do provedor. O desenvolvimento local pode usar qualquer instalação PostgreSQL compatível.

Não adicionar credenciais, URLs de conexão ou arquivos `.env` ao Git. A conexão será configurada posteriormente por variável de ambiente no servidor, nunca no navegador.

## Migração inicial

Arquivo: `db/migrations/0001_initial_meteorological_storage.sql`.

Aplicar uma vez em um banco vazio. A migração cria:

| Tabela | Responsabilidade |
|---|---|
| `meteorological_data_sources` | Catálogo de provedores e produtos |
| `meteorological_stations` | Estações por identificador do provedor |
| `ingestion_runs` | Execuções, estado e contagens do pipeline |
| `raw_files` | Arquivo original recebido, hash SHA-256 e bytes originais |
| `raw_records` | Linhas interpretadas do arquivo e payload bruto estruturado |
| `meteorological_observations` | Observações normalizadas, derivadas e agregadas |

O arquivo original é preservado em `BYTEA` nesta primeira fase. Para arquivos maiores ou retenção prolongada, o conteúdo poderá ser transferido para armazenamento de objetos sem alterar o modelo das observações.

## Decisões de modelagem

1. **Proveniência:** cada observação referencia a fonte e a estação; quando disponível, também referencia a execução de ingestão e a linha bruta de origem.
2. **Tempo:** `observed_at`, `received_at`, `period_start` e `period_end` são `TIMESTAMPTZ`; a aplicação deve enviar timestamps ISO 8601 com offset explícito, normalmente UTC.
3. **Ausências:** `value` aceita `NULL`; não converter ausência em zero.
4. **Qualidade:** status e flags são persistidos sem apagar valores suspeitos.
5. **Cobertura:** os campos de cobertura são colunas explícitas para facilitar filtros e consultas.
6. **Idempotência:** `id` determinístico é chave primária; `(source_id, source_record_id)` é único quando o identificador da fonte existe. Uma reimportação não deve criar uma segunda cópia da mesma observação.
7. **Consultas:** índices priorizam estação, variável e instante, que são os filtros esperados para séries temporais do dashboard.
8. **Segurança:** acesso ao banco exclusivamente no servidor. A chave de conexão nunca deve usar prefixo público nem ser importada por módulos client-side.

## Fluxo de gravação planejado

1. Criar `ingestion_runs` com status `running`.
2. Registrar a fonte e fazer upsert da estação pelo par `(source_id, source_station_id)`.
3. Salvar os bytes originais em `raw_files` e calcular SHA-256.
4. Salvar cada linha interpretada em `raw_records`, preservando número da linha e payload.
5. Executar parser, normalizador, controle de qualidade e cálculos existentes.
6. Gravar observações em transação, associando `ingestion_run_id` e `raw_record_id` quando aplicável.
7. Atualizar contagens, horário de término e status da execução.
8. Em erro, registrar a mensagem e marcar a execução como `failed` ou `partially_succeeded`, sem apagar o arquivo bruto.

## Fora do escopo desta migração

- Conectar o dashboard ou substituir mocks.
- Criar coleta automática do INMET.
- Criar endpoints públicos.
- Configurar Neon ou armazenar segredos de produção.
- Definir retenção ou exclusão automática de dados brutos.

## Próxima etapa

Implementar o adaptador PostgreSQL no servidor, com transações e testes de reimportação. O teste de integração deverá demonstrar que o CSV A711 é persistido e lido de volta sem perda de valores, timestamps, qualidade, cobertura ou proveniência antes de qualquer integração com a interface.
