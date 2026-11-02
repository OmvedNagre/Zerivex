import crypto from 'node:crypto';
import { query } from '@/core/db/database';
import { getEnvConfig } from '@/core/config/env-validator';
import { isMailConfigured, sendInvitationEmail } from './gmail-service';
import { getOrgRoleLabel } from '@/lib/labels';
const key = () => crypto.createHash('sha256').update(`zerivex-invitation-mail:${getEnvConfig().SESSION_SECRET}`).digest();
export function sealInvitationToken(token: string) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function openInvitationToken(value: string) {
  const data = Buffer.from(value, 'base64url'); const decipher = crypto.createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
export async function dispatchInvitationMail() {
  if (!isMailConfigured()) return;
  await query(`UPDATE invitation_mail SET status='FAILED', last_error='Delivery interrupted; resend invitation to retry', encrypted_token='', updated_at=NOW() WHERE status='SENDING' AND updated_at < NOW()-INTERVAL '5 minutes'`);
  const res = await query<{ id: string; invitationId: string; token: string; email: string; organization: string; inviter: string; role: string; expiresAt: Date; attempts: number }>(`WITH candidate AS (
    SELECT m.id FROM invitation_mail m JOIN organization_invitations i ON i.id=m.invitation_id
    WHERE m.status='QUEUED' AND m.next_attempt_at<=NOW() AND i.status='PENDING' AND i.expires_at>NOW()
    ORDER BY m.created_at FOR UPDATE OF m SKIP LOCKED LIMIT 1
  ), claimed AS (UPDATE invitation_mail m SET status='SENDING', attempts=attempts+1, updated_at=NOW() FROM candidate c WHERE m.id=c.id RETURNING m.*)
  SELECT c.id, c.invitation_id AS "invitationId", c.encrypted_token AS token, c.attempts, i.email, i.role, i.expires_at AS "expiresAt", o.name AS organization, COALESCE(u.display_name,u.email) AS inviter
  FROM claimed c JOIN organization_invitations i ON i.id=c.invitation_id JOIN organizations o ON o.id=i.organization_id JOIN users u ON u.id=i.invited_by_user_id`);
  for (const mail of res.rows) {
    try {
      const token = openInvitationToken(mail.token);
      const origin = getEnvConfig().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
      const providerId = await sendInvitationEmail({ ...mail, to: mail.email, url: `${origin}/invite/${token}`, role: getOrgRoleLabel(mail.role) });
      await query("UPDATE invitation_mail SET status='SENT', encrypted_token='', sent_at=NOW(), provider_message_id=$2, last_error=NULL, updated_at=NOW() WHERE id=$1", [mail.id, providerId]);
    } catch {
      // Do not automatically retry an ambiguous send: Gmail may have accepted it before a network timeout.
      await query("UPDATE invitation_mail SET status='FAILED', encrypted_token='', last_error='Email could not be confirmed. Check sender connection and resend.', updated_at=NOW() WHERE id=$1", [mail.id]);
    }
  }
  await query(`UPDATE invitation_mail m SET status='CANCELED', encrypted_token='', updated_at=NOW() FROM organization_invitations i WHERE m.invitation_id=i.id AND m.status='QUEUED' AND (i.status!='PENDING' OR i.expires_at<=NOW())`);
}
