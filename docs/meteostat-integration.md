# Integração inicial — Meteostat / São Carlos A711

## Identificação da estação

- Identificador Meteostat: `86845`
- Estação de referência: INMET automática A711
- Localização informada: UFSCar, São Carlos, SP
- Identificador `83726`: estação convencional de São Carlos; não é intercambiável com `86845`.

A correspondência entre os identificadores é um vínculo de catálogo para o projeto. Antes da ingestão operacional, conferir os metadados retornados pelo endpoint de metadados do Meteostat (nome, coordenadas, altitude, fuso e inventário horário) e registrar a data dessa verificação.

## Fonte e limitações

O Meteostat é um agregador independente que reúne dados de diferentes interfaces governamentais. Portanto, a origem imediata armazenada pelo ClimaBR será Meteostat. Não atribuir individualmente cada observação ao INMET sem evidência de proveniência no registro.

Documentação:
- API de metadados: https://dev.meteostat.net/api/stations/meta
- API horária: https://dev.meteostat.net/api/stations/hourly
- API JSON e autenticação: https://dev.meteostat.net/api.html

A API JSON usa RapidAPI e exige chave. A chave deve existir somente no ambiente do servidor, nunca no navegador, no repositório ou em variáveis públicas `NEXT_PUBLIC_*`.

## Consulta horária

Endpoint: `GET https://meteostat.p.rapidapi.com/stations/hourly`

Parâmetros iniciais:
- `station=86845`
- `start` e `end`: intervalo solicitado, limitado a 30 dias por requisição
- `tz=America/Sao_Paulo`
- `model=false`: não preencher lacunas com dados estimados pelo modelo
- `units=metric`

O parâmetro `model=false` reduz a mistura com valores estimados, mas não transforma o Meteostat em uma fonte primária nem garante, por si só, a rastreabilidade individual ao instrumento. Preservar a resposta original.

## Variáveis e unidades documentadas

| Campo Meteostat | Variável canônica | Unidade |
|---|---|---|
| `temp` | `air_temperature` | °C |
| `rhum` | `relative_humidity` | % |
| `prcp` | `precipitation` | mm por hora |
| `wspd` | `wind_speed` | km/h |
| `wdir` | `wind_direction` | graus |
| `pres` | `sea_level_pressure` | hPa |
| `dwpt` | ponto de orvalho (a incluir no contrato quando necessário) | °C |
| `wpgt` | rajada máxima (a incluir no contrato quando necessário) | km/h |

Não mapear `pres` para pressão atmosférica no nível da estação: a documentação descreve esse campo como pressão ao nível do mar.

## Critérios antes de ativar no dashboard

1. Conferir metadados e inventário de `86845`.
2. Fazer uma consulta pequena com `model=false`.
3. Guardar resposta bruta e parâmetros da consulta.
4. Verificar horários, unidades, valores nulos e continuidade temporal.
5. Validar uma amostra com uma fonte oficial independente, quando disponível.
6. Manter os mocks no dashboard até os testes e a proveniência serem satisfatórios.
