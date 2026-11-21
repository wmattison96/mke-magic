# Private historical import files

This directory contains a complete 141-game audited snapshot. The files are local-only and excluded from Git via `.gitignore` because some columns retain original guest names. Do not move them under `public/` or serve them via an API. Codex should read `../../docs/DATA_CONTRACT.md` and use the CSVs for a dry run and then a one-time idempotent hosted import. The Excel/SQLite files in the planning package are reference artifacts, not production database files.
