-- The migration establishes a baseline for legacy records; it cannot attest to
-- their history before installation. Protect the chain from ordinary DML after it.
ALTER TABLE audit_logs ADD COLUMN audit_sequence BIGINT;
ALTER TABLE audit_logs ADD COLUMN previous_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN record_hash TEXT;

CREATE FUNCTION zerivex_audit_hash(payload JSONB, previous TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE AS $$
  SELECT encode(digest((payload - 'record_hash' - 'previous_hash')::text || previous, 'sha256'), 'hex')
$$;

DO $$
DECLARE entry RECORD; chain_org UUID; previous TEXT := ''; sequence BIGINT := 0;
BEGIN
  FOR entry IN SELECT * FROM audit_logs ORDER BY organization_id NULLS FIRST, created_at, id LOOP
    IF sequence = 0 OR chain_org IS DISTINCT FROM entry.organization_id THEN
      chain_org := entry.organization_id; previous := ''; sequence := 0;
    END IF;
    sequence := sequence + 1;
    UPDATE audit_logs SET audit_sequence = sequence, previous_hash = previous WHERE id = entry.id;
    UPDATE audit_logs a SET record_hash = zerivex_audit_hash(to_jsonb(a), previous)
      WHERE a.id = entry.id RETURNING record_hash INTO previous;
  END LOOP;
END $$;

ALTER TABLE audit_logs ALTER COLUMN audit_sequence SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN previous_hash SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN record_hash SET NOT NULL;
CREATE UNIQUE INDEX audit_logs_chain_sequence ON audit_logs (COALESCE(organization_id::text, ''), audit_sequence);

CREATE FUNCTION zerivex_append_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE previous_entry RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(COALESCE(NEW.organization_id::text, 'zerivex-system-audit'), 0));
  SELECT audit_sequence, record_hash INTO previous_entry FROM audit_logs
    WHERE organization_id IS NOT DISTINCT FROM NEW.organization_id
    ORDER BY audit_sequence DESC LIMIT 1;
  NEW.audit_sequence := COALESCE(previous_entry.audit_sequence, 0) + 1;
  NEW.previous_hash := COALESCE(previous_entry.record_hash, '');
  NEW.record_hash := zerivex_audit_hash(to_jsonb(NEW), NEW.previous_hash);
  RETURN NEW;
END $$;
CREATE TRIGGER audit_logs_append BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION zerivex_append_audit();

CREATE FUNCTION zerivex_reject_audit_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are append-only';
END $$;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION zerivex_reject_audit_mutation();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION zerivex_reject_audit_mutation();
