-- Migration 001: Remove the credit system (Refs #13)
-- Idempotent: safe to run on a DB that may or may not still have these objects.
-- Source of truth remains apps/api/database/init.sql (this mirrors that change
-- for already-provisioned databases).

BEGIN;

DROP TABLE IF EXISTS credit_packages;
DROP TABLE IF EXISTS credit_transactions;
ALTER TABLE public_keys DROP COLUMN IF EXISTS credits;

COMMIT;
