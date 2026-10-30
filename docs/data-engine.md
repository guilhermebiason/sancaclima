# ClimaBR Data Engine — initial data contract

## Purpose

The Data Engine will collect, preserve, normalize, validate, and expose meteorological data for academic analysis. The existing dashboard model in `types/station.ts` remains a presentation model; source records must not be coupled directly to it.

## First implementation target

The first source adapter will target INMET automatic-station observations. Before implementing the adapter, document the exact product/endpoint, field names, units, timestamp convention, missing-value markers, update cadence, attribution requirements, and terms of use from the official source documentation.

## Data flow

1. Acquire source resources and record the retrieval time.
2. Preserve the original response/file unchanged (RAW layer).
3. Parse source-specific records in an INMET adapter.
4. Normalize records to the contracts in `types/meteorological-data.ts`.
5. Run quality checks and attach flags; do not silently delete suspect records.
6. Persist normalized observations and ingestion-run metadata.
7. Expose only the required fields through the application API.

## Scientific and engineering rules

- Keep observations, forecasts, model analyses, and derived products as distinct data products.
- Store measurement time (`observedAt`) separately from acquisition time (`receivedAt`).
- Serialize timestamps in ISO 8601 UTC. Preserve the original source timestamp and timezone in the RAW layer.
- Never use zero to represent missing data. Use `null` and an explicit quality status/flag.
- Preserve source identifiers, original files/responses, and enough metadata to trace every normalized value.
- Store the aggregation type and represented interval. An accumulated precipitation value must not be treated as an instantaneous rate.
- Normalize units only through explicit, tested conversions. Retain original values and units in the RAW layer.
- Make ingestion idempotent: reprocessing the same source record must not create duplicate observations.
- Treat automated physical-limit checks as flags, not proof that an extreme observation is erroneous.
- Version the quality-control rules so academic analyses can document which criteria were applied.

## Current scope

This commit introduces domain contracts and the initial data-engine specification only. It does not yet fetch live INMET data, create a database, or change the current dashboard behavior.
