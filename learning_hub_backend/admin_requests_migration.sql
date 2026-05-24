CREATE TABLE IF NOT EXISTS admin_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by BIGINT
);
