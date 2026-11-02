-- One-time launch cutover. Preserve accounts and explicit staff roles.
-- Sessions of identities that could authenticate without a real provider must sign in again.
UPDATE sessions SET revoked_at = NOW()
WHERE revoked_at IS NULL
  AND user_id IN (SELECT user_id FROM identities WHERE provider = 'mock');

UPDATE sessions SET preview_plan_id = NULL WHERE preview_plan_id IS NOT NULL;

-- Revoke only targets whose most recent successful proof was the manual bypass.
-- A later genuine DNS/HTTP proof remains valid. Keep append-only audit history intact.
UPDATE targets t SET verification_status = 'REVOKED', verified_at = NULL, updated_at = NOW()
WHERE verification_status = 'VERIFIED'
  AND (SELECT a.metadata_json->>'method' FROM audit_logs a
       WHERE a.action = 'TARGET_VERIFIED' AND a.resource_id = t.id::text
       ORDER BY a.created_at DESC, a.id DESC LIMIT 1) = 'MANUAL_BYPASS';
