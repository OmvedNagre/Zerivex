import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { authenticateWithOAuthProfile } from '@/core/auth/oauth-service';
import { POST as acceptInvitationRoute } from '@/app/api/teams/invitations/[tokenOrId]/accept/route';
import { SESSION_COOKIE_NAME } from '@/core/auth/session-service';
import { query } from '@/core/db/database';
import { inviteMember, acceptInvitation } from '@/core/teams/team-service';
import { createSession, validateSessionToken } from '@/core/auth/session-service';
import { sealInvitationToken, openInvitationToken, dispatchInvitationMail } from '@/core/mail/invitation-outbox';
import { invitationMessage } from '@/core/mail/gmail-service';

describe('Invitation delivery and acceptance boundaries',()=>{
  let org:string, owner:string, recipient:string, attacker:string;
  beforeAll(async()=>{
    const users=await query<{id:string;email:string}>("INSERT INTO users (email,email_verified_at) VALUES ('owner@invite.test',NOW()),('recipient@invite.test',NOW()),('attacker@invite.test',NOW()) RETURNING id,email");
    owner=users.rows.find(u=>u.email==='owner@invite.test')!.id;recipient=users.rows.find(u=>u.email==='recipient@invite.test')!.id;attacker=users.rows.find(u=>u.email==='attacker@invite.test')!.id;
    org=(await query<{id:string}>("INSERT INTO organizations (name,slug) VALUES ('Invited Workspace','invited') RETURNING id")).rows[0]!.id;
    await query("INSERT INTO memberships (organization_id,user_id,role) VALUES ($1,$2,'ORG_OWNER')",[org,owner]);
    await query("INSERT INTO subscriptions (organization_id,plan_id) VALUES ($1,'TEAM')",[org]);
  });
  it('encrypts invitation secrets and rejects tampered ciphertext',()=>{const sealed=sealInvitationToken('inv_secret');expect(sealed).not.toContain('inv_secret');expect(openInvitationToken(sealed)).toBe('inv_secret');expect(()=>openInvitationToken(sealed.slice(0,-4)+'AAAA')).toThrow();});
  it('escapes organization content in emails and includes an explicit role acceptance',()=>{const message=invitationMessage({organization:'<script>bad</script>',inviter:'Owner',role:'Member',url:'https://zerivex.tech/invite/test',expiresAt:new Date()});expect(message.html).not.toContain('<script>');expect(message.html).toContain('Accept the role');expect(message.html).toContain('zerivex.secure@gmail.com');});
  it('rejects a wrong verified account and leaves the invitation pending',async()=>{const invite=await inviteMember({organizationId:org,email:'recipient@invite.test',role:'ORG_MEMBER',actorUserId:owner});await expect(acceptInvitation({rawToken:invite.rawToken,userId:attacker})).rejects.toThrow('verified email');expect((await query<{status:string}>('SELECT status FROM organization_invitations WHERE id=$1',[invite.invitation.id])).rows[0]?.status).toBe('PENDING');});
  it('queues encrypted mail atomically and records Gmail acceptance, without claiming delivery',async()=>{
    const previous={...process.env};process.env.GMAIL_CLIENT_ID='test';process.env.GMAIL_CLIENT_SECRET='test';process.env.GMAIL_REFRESH_TOKEN='test';
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({access_token:'test'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({id:'gmail-test'}),{status:200}));
    try {const invite=await inviteMember({organizationId:org,email:'recipient@invite.test',role:'ORG_MEMBER',actorUserId:owner,deliverEmail:true});const queued=(await query<{encrypted_token:string;status:string}>('SELECT encrypted_token,status FROM invitation_mail WHERE invitation_id=$1',[invite.invitation.id])).rows[0]!;expect(queued.status).toBe('QUEUED');expect(queued.encrypted_token).not.toContain(invite.rawToken);await dispatchInvitationMail();const sent=(await query<{status:string;encrypted_token:string}>('SELECT status,encrypted_token FROM invitation_mail WHERE invitation_id=$1',[invite.invitation.id])).rows[0]!;expect(sent.status).toBe('SENT');expect(sent.encrypted_token).toBe('');}
    finally{fetchMock.mockRestore();process.env=previous;}
  });
  it('never replaces an existing owner role using an older invitation',async()=>{const invite=await inviteMember({organizationId:org,email:'recipient@invite.test',role:'ORG_VIEWER',actorUserId:owner});await query("INSERT INTO memberships (organization_id,user_id,role) VALUES ($1,$2,'ORG_OWNER')",[org,recipient]);await expect(acceptInvitation({rawToken:invite.rawToken,userId:recipient})).rejects.toThrow('already a member');expect((await query<{role:string}>('SELECT role FROM memberships WHERE organization_id=$1 AND user_id=$2',[org,recipient])).rows[0]?.role).toBe('ORG_OWNER');});
  it('binds a session to the selected workspace and fails closed when membership is removed',async()=>{const session=await createSession({userId:attacker});await query('UPDATE sessions SET active_organization_id=$1 WHERE id=$2',[org,session.sessionId]);expect(await validateSessionToken(session.rawToken)).toBeNull();await query("INSERT INTO memberships (organization_id,user_id,role) VALUES ($1,$2,'ORG_VIEWER')",[org,attacker]);expect((await validateSessionToken(session.rawToken))?.organizationId).toBe(org);});
  it('rejects acceptance at the seat limit inside the membership transaction',async()=>{await query("UPDATE subscriptions SET plan_id='STARTER' WHERE organization_id=$1",[org]);await query('DELETE FROM memberships WHERE organization_id=$1 AND user_id=$2',[org,attacker]);const invite=await inviteMember({organizationId:org,email:'attacker@invite.test',role:'ORG_MEMBER',actorUserId:owner});await expect(acceptInvitation({rawToken:invite.rawToken,userId:attacker})).rejects.toThrow('member limit');expect((await query('SELECT 1 FROM memberships WHERE organization_id=$1 AND user_id=$2',[org,attacker])).rows).toHaveLength(0);});
  it('allows only one concurrent acceptance for the last seat',async()=>{
    await query("UPDATE subscriptions SET plan_id='PRO' WHERE organization_id=$1",[org]);
    const applicants=(await query<{id:string;email:string}>("INSERT INTO users (email,email_verified_at) VALUES ('last-seat-a@invite.test',NOW()),('last-seat-b@invite.test',NOW()) RETURNING id,email")).rows;
    const invitations=await Promise.all(applicants.map(u=>inviteMember({organizationId:org,email:u.email,role:'ORG_MEMBER',actorUserId:owner})));
    const outcomes=await Promise.allSettled(invitations.map((i,index)=>acceptInvitation({rawToken:i.rawToken,userId:applicants[index]!.id})));
    expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);
    expect(outcomes.filter(o=>o.status==='rejected')).toHaveLength(1);
    expect(Number((await query<{count:string}>('SELECT COUNT(*)::text AS count FROM memberships WHERE organization_id=$1',[org])).rows[0]?.count)).toBe(3);
  });
  it('does not create a mail invitation when Gmail is disconnected',async()=>{
    const previous={...process.env};delete process.env.GMAIL_REFRESH_TOKEN;
    const before=(await query<{count:string}>('SELECT COUNT(*)::text AS count FROM organization_invitations')).rows[0]?.count;
    try {await expect(inviteMember({organizationId:org,email:'not-sent@invite.test',role:'ORG_MEMBER',actorUserId:owner,deliverEmail:true})).rejects.toThrow('not connected');expect((await query<{count:string}>('SELECT COUNT(*)::text AS count FROM organization_invitations')).rows[0]?.count).toBe(before);}
    finally{process.env=previous;}
  });

  it('accepts an invitation after a completely new recipient signs in for the first time',async()=>{
    const email='never-registered@invite.test';
    expect((await query('SELECT id FROM users WHERE email=$1',[email])).rows).toHaveLength(0);
    const destination=(await query<{id:string}>("INSERT INTO organizations (name,slug) VALUES ('New User Team','new-user-team') RETURNING id")).rows[0]!.id;
    await query("INSERT INTO memberships (organization_id,user_id,role) VALUES ($1,$2,'ORG_OWNER')",[destination,owner]);
    await query("INSERT INTO subscriptions (organization_id,plan_id) VALUES ($1,'TEAM')",[destination]);
    const invite=await inviteMember({organizationId:destination,email,role:'ORG_MEMBER',actorUserId:owner});
    const signedIn=await authenticateWithOAuthProfile({provider:'google',providerAccountId:'never-registered-google',email,isEmailVerified:true,displayName:'First-time Recipient'});
    const response=await acceptInvitationRoute(new NextRequest(`http://localhost:3000/api/teams/invitations/${invite.rawToken}/accept`,{method:'POST',headers:{cookie:`${SESSION_COOKIE_NAME}=${signedIn.rawSessionToken}`,'X-Requested-With':'XMLHttpRequest'}}),{params:Promise.resolve({tokenOrId:invite.rawToken})});
    expect(response.status).toBe(200);
    const session=await validateSessionToken(signedIn.rawSessionToken);
    expect(session?.organizationId).toBe(destination);
    expect(session?.organizationRole).toBe('ORG_MEMBER');
  });

});
