-- Fix Organization Single Row Constraint
-- Created: 2025-10-18
-- Removes broken CHECK constraint and keeps only the unique index

-- Drop the broken single_org constraint
ALTER TABLE organization DROP CONSTRAINT IF EXISTS single_org;

-- The unique index idx_single_organization is sufficient to ensure only one row
-- It already exists from migration 003
