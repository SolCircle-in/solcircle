 -- Wallet Labels and Tags Migration
-- This table stores custom labels and tags for user wallets

CREATE TABLE IF NOT EXISTS wallet_labels (
  id SERIAL PRIMARY KEY,
  utgid VARCHAR(50) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  label VARCHAR(100),
  tags TEXT[], -- Array of tags
  note TEXT,
  color VARCHAR(10) DEFAULT '#6366f1', -- Hex color for UI
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(utgid, wallet_address)
);

-- Create indexes for better query performance
CREATE INDEX idx_wallet_labels_user ON wallet_labels(utgid);
CREATE INDEX idx_wallet_labels_tags ON wallet_labels USING GIN(tags);
CREATE INDEX idx_wallet_labels_address ON wallet_labels(wallet_address);

-- Add comments for documentation
COMMENT ON TABLE wallet_labels IS 'User-defined labels and tags for wallet addresses';
COMMENT ON COLUMN wallet_labels.utgid IS 'Telegram user ID';
COMMENT ON COLUMN wallet_labels.wallet_address IS 'Solana wallet public key';
COMMENT ON COLUMN wallet_labels.label IS 'Custom label (e.g., "💼 Trading Wallet")';
COMMENT ON COLUMN wallet_labels.tags IS 'Array of tags (e.g., ["trading", "active", "defi"])';
COMMENT ON COLUMN wallet_labels.note IS 'Optional note/description';
COMMENT ON COLUMN wallet_labels.color IS 'Hex color code for UI display';
