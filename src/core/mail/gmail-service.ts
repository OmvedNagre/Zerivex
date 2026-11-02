import { CONTACT_EMAIL } from '@/lib/contact';

export function isMailConfigured() {
  return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}
export function requireMailConfiguration() {
  if (!isMailConfigured()) throw Object.assign(new Error('Invitation email is not connected. Connect the Zerivex sender account before sending invitations.'), { statusCode: 503 });
}
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
export function invitationMessage(input: { organization: string; inviter: string; role: string; url: string; expiresAt: Date }) {
  const text = `${input.inviter} invited you to join ${input.organization} as ${input.role}.\n\nAccept the role: ${input.url}\n\nSign in with the email this invitation was sent to. Expires ${input.expiresAt.toISOString()}. If unexpected, ignore this invitation.\n\nQuestions: ${CONTACT_EMAIL}`;
  const e = escapeHtml;
  const logoUrl = new URL('/brand/zerivex.jpg', input.url).toString();
  const html = `<html><body style="margin:0;background:#faf8f3;color:#1a1c23;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" style="max-width:560px;width:100%;background:white;border:1px solid #e8e1d5;border-radius:20px"><tr><td style="padding:32px"><img src="${e(logoUrl)}" width="240" alt="Zerivex" style="display:block;max-width:100%;height:auto;border-radius:8px" /><h1 style="font-size:26px">You're invited to join ${e(input.organization)}</h1><p>${e(input.inviter)} invited you as <strong>${e(input.role)}</strong>.</p><p>Sign in with the email this invitation was sent to, review your access, and meet your workspace.</p><p style="padding:20px 0"><a href="${e(input.url)}" style="display:inline-block;background:#ff6425;color:#17191f;padding:16px 24px;border-radius:28px;font-weight:bold;text-decoration:none">Accept the role</a></p><p>Expires ${e(input.expiresAt.toUTCString())}. Opening this link does not grant access until you sign in and confirm.</p><p>If you weren't expecting this invitation, you can ignore it.</p><p>Questions? <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p></td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
export async function sendInvitationEmail(input: { to: string; organization: string; inviter: string; role: string; url: string; expiresAt: Date; invitationId: string }) {
  requireMailConfiguration();
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(input.to)) throw new Error('Invalid recipient');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(15000), body: new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID!, client_secret: process.env.GMAIL_CLIENT_SECRET!, refresh_token: process.env.GMAIL_REFRESH_TOKEN!, grant_type: 'refresh_token' }) });
  if (!tokenResponse.ok) throw new Error('Gmail authorization failed; reconnect the sender account');
  const token = await tokenResponse.json();
  const content = invitationMessage(input);
  const encodePart = (value: string) => Buffer.from(value).toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
  const boundary = `zerivex_${input.invitationId.replace(/-/g, '')}`;
  const mime = [`From: Zerivex <zerivex.secure@gmail.com>`, `Reply-To: zerivex.secure@gmail.com`, `To: ${input.to}`, 'Subject: You are invited to join Zerivex', `Message-ID: <invitation-${input.invitationId}@zerivex.tech>`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodePart(content.text), `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodePart(content.html), `--${boundary}--`].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/zerivex.secure%40gmail.com/messages/send', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }) });
  if (!response.ok) throw new Error('Gmail did not accept the invitation email');
  return (await response.json()).id as string;
}
