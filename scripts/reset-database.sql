-- ============================================================================
-- INHOST - Database Reset Script (Clean Slate - Multi-Tenancy)
-- ============================================================================
-- This script DROPS all existing data and creates fresh multi-tenancy structure
-- Run with: psql -h localhost -U inhost_user -d inhost -f scripts/reset-database.sql
-- ============================================================================

-- Drop all existing tables
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Grant permissions
GRANT ALL ON SCHEMA public TO inhost_user;
GRANT ALL ON SCHEMA public TO public;

-- Now create fresh multi-tenancy tables
\i scripts/create-multi-tenancy-tables.sql
