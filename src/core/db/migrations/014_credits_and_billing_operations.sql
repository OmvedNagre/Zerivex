CREATE TABLE credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE REFERENCES organizations(id),
  kind TEXT NOT NULL CHECK (kind IN ('PLATFORM_POOL', 'ORG_AVAILABLE')),
  balance BIGINT NOT NULL DEFAULT 0,
  CHECK ((kind = 'PLATFORM_POOL' AND organization_id IS NULL) OR
         (kind = 'ORG_AVAILABLE' AND organization_id IS NOT NULL AND balance >= 0))
);
CREATE UNIQUE INDEX credit_accounts_platform_pool ON credit_accounts (kind) WHERE kind = 'PLATFORM_POOL';
INSERT INTO credit_accounts (kind) VALUES ('PLATFORM_POOL');

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  actor_user_id UUID REFERENCES users(id),
  source TEXT NOT NULL CHECK (source IN ('GRANT', 'SCAN_USAGE')),
  idempotency_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);
CREATE TABLE credit_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES credit_transactions(id),
  account_id UUID NOT NULL REFERENCES credit_accounts(id),
  amount BIGINT NOT NULL CHECK (amount <> 0),
  UNIQUE (transaction_id, account_id)
);
CREATE INDEX credit_transactions_org_time ON credit_transactions (organization_id, created_at DESC);

CREATE FUNCTION zerivex_check_credit_balance() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) <> 2 OR COALESCE(SUM(amount), 0) <> 0 FROM credit_postings WHERE transaction_id = NEW.id) THEN
    RAISE EXCEPTION 'Credit transaction must contain two balanced postings';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER credit_transaction_balanced AFTER INSERT ON credit_transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION zerivex_check_credit_balance();
CREATE FUNCTION zerivex_reject_ledger_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Credit ledger records are append-only'; END $$;
CREATE TRIGGER credit_transactions_immutable BEFORE UPDATE OR DELETE ON credit_transactions
  FOR EACH ROW EXECUTE FUNCTION zerivex_reject_ledger_mutation();
CREATE TRIGGER credit_postings_immutable BEFORE UPDATE OR DELETE ON credit_postings
  FOR EACH ROW EXECUTE FUNCTION zerivex_reject_ledger_mutation();

CREATE TABLE billing_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  subscription_id TEXT,
  livemode BOOLEAN NOT NULL,
  provider_created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  payload_json JSONB NOT NULL
);
CREATE INDEX billing_events_status_time ON billing_events (processing_status, received_at DESC);
CREATE INDEX billing_events_subscription_time ON billing_events (subscription_id, provider_created_at DESC);
CREATE TABLE billing_invoices (
  id TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id TEXT,
  amount_due BIGINT NOT NULL,
  amount_paid BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  hosted_invoice_url TEXT,
  provider_created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE subscriptions ADD COLUMN stripe_event_created_at TIMESTAMPTZ;

CREATE TRIGGER credit_transactions_no_truncate BEFORE TRUNCATE ON credit_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION zerivex_reject_ledger_mutation();
CREATE TRIGGER credit_postings_no_truncate BEFORE TRUNCATE ON credit_postings
  FOR EACH STATEMENT EXECUTE FUNCTION zerivex_reject_ledger_mutation();
