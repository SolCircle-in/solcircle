-- Migration: Add selling fees tracking to orders table
-- Created: 2025-11-05

-- Add sell_fees column to track fees incurred when selling
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS sell_fees NUMERIC(18,8) DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN orders.sell_fees IS 'Fees paid when selling this order (transaction + compute fees)';
