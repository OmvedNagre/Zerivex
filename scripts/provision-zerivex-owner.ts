import { loadLocalEnvironment } from './lib/environment';
loadLocalEnvironment();
async function main() {
  const { query, withTransaction, closeDbPool } = await import('../src/core/db/database');
  const { recordAuditEvent } = await import('../src/core/audit/audit-service');
  const ownerEmail = 'code64816@gmail.com';
  try {
    const result = await query<{id:string}>(`SELECT u.id FROM users u JOIN identities i ON i.user_id=u.id WHERE LOWER(u.email)=$1 AND u.email_verified_at IS NOT NULL AND i.provider='google' AND u.status='ACTIVE' LIMIT 1`,[ownerEmail]);
    const userId=result.rows[0]?.id;
    if(!userId) throw new Error('The requested owner must first sign in through verified Google OAuth');
    const orgs=await query<{id:string;name:string;role:string}>(`SELECT o.id,o.name,m.role FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=$1 AND NOT o.is_internal ORDER BY m.created_at LIMIT 1`,[userId]);
    const org=orgs.rows[0];if(!org || org.role!=='ORG_OWNER') throw new Error('Unable to identify an existing owner workspace safely');
    if(!process.argv.includes('--apply')) {console.log(JSON.stringify({ownerEmail,verifiedGoogleIdentity:true,workspace:org.name,proposedName:'Zerivex',proposedPlan:'ENTERPRISE',apply:false}));return;}
    await withTransaction(async client => {
      await client.query("UPDATE users SET role='OWNER' WHERE id=$1",[userId]);
      await client.query("UPDATE organizations SET name='Zerivex',updated_at=NOW() WHERE id=$1",[org.id]);
      await client.query("INSERT INTO platform_roles (user_id,role) VALUES ($1,'STAFF_OWNER') ON CONFLICT (user_id) DO UPDATE SET role='STAFF_OWNER',revoked_at=NULL",[userId]);
      const internal=(await client.query<{id:string}>("SELECT id FROM organizations WHERE slug='zerivex-internal' AND is_internal=true")).rows[0];
      if(!internal) throw new Error('Staff workspace not found');
      await client.query("INSERT INTO memberships (organization_id,user_id,role) VALUES ($1,$2,'ORG_OWNER') ON CONFLICT (organization_id,user_id) DO UPDATE SET role='ORG_OWNER'",[internal.id,userId]);
      // Explicit complimentary subscription for this managing organization, not a role-based exception.
      await client.query("INSERT INTO subscriptions (organization_id,plan_id,status,billing_cycle,current_period_end) VALUES ($1,'ENTERPRISE','ACTIVE','YEARLY',NOW()+INTERVAL '10 years') ON CONFLICT (organization_id) DO UPDATE SET plan_id='ENTERPRISE',status='ACTIVE',current_period_end=GREATEST(subscriptions.current_period_end,NOW()+INTERVAL '10 years'),updated_at=NOW() WHERE subscriptions.stripe_subscription_id IS NULL",[org.id]);
      const plan=(await client.query<{plan_id:string}>('SELECT plan_id FROM subscriptions WHERE organization_id=$1',[org.id])).rows[0];
      if(plan?.plan_id!=='ENTERPRISE') throw new Error('Existing Stripe subscription requires a separate reviewed change');
      await recordAuditEvent({organizationId:org.id,actorUserId:userId,actorType:'SYSTEM',action:'OWNER_BOOTSTRAP',resourceType:'organization',resourceId:org.id,reason:'Explicit product owner request: verified Google account, Zerivex managing workspace and complimentary Enterprise subscription',metadata:{ownerEmail,planId:'ENTERPRISE',staffRole:'STAFF_OWNER',complimentary:true}},client);
    });
    console.log(JSON.stringify({ownerEmail,workspace:'Zerivex',plan:'ENTERPRISE',staffRole:'STAFF_OWNER',apply:true}));
  } finally {await closeDbPool();}
}
main().catch(()=>{console.error('Owner provisioning failed safely; no credentials were logged.');process.exitCode=1;});
