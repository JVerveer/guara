-- Run this after bronze_schema.sql when bronze.cbs_typed_dataset_rows starts getting large.
-- It reduces write overhead and improves resumable scans by dataset.

drop index if exists bronze.cbs_typed_dataset_rows_dataset_idx;

create index if not exists cbs_typed_dataset_rows_dataset_row_index_desc_idx
  on bronze.cbs_typed_dataset_rows (dataset_id, row_index desc);

alter table if exists bronze.cbs_typed_dataset_rows set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_limit = 2000
);

analyze bronze.cbs_typed_dataset_rows;

-- Optional one-time cleanup if earlier runs stored full TypedDataSet batch payloads.
-- The canonical raw rows remain in bronze.cbs_typed_dataset_rows.
-- Uncomment only if you do not need duplicated batch response payloads for audit.
--
-- delete from bronze.cbs_raw_endpoint_payloads
-- where endpoint like 'typed_dataset_batch:%';
