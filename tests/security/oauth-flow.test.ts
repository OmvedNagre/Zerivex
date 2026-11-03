import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { query } from '@/core/db/database';
import { beginOAuth, consumeOAuth, oauthCookieName } from '@/core/auth/oauth-flow';
import { GET as start } from '@/app/api/auth/login/[provider]/route';
import { GET as staffStart } from '@/app/api/staff/auth/login/route';
import { GET as staffCallback } from '@/app/api/staff/auth/callback/route';
import { STAFF_SESSION_COOKIE_NAME } from '@/core/staff/staff-session-service';
import { GET as callback } from '@/app/api/auth/callback/[provider]/route';
import { SESSION_COOKIE_NAME, validateSessionToken } from '@/core/auth/session-service';
import { _resetConfigForTesting } from '@/core/config/env-validator';
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_APP_URL','https://zerivex.tech');vi.stubEnv('GOOGLE_CLIENT_ID','google-id');vi.stubEnv('GOOGLE_CLIENT_SECRET','google-secret');vi.stubEnv('GITHUB_CLIENT_ID','github-id');vi.stubEnv('GITHUB_CLIENT_SECRET','github-secret');_resetConfigForTesting();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();_resetConfigForTesting();});
describe('Browser-bound single-use OAuth flow',()=>{
 it('rejects the wrong browser and provider without consuming the legitimate attempt',async()=>{
  const attempt=await beginOAuth('google','https://www.zerivex.tech/login','/invite/token');const state=new URL(attempt.authorizationUrl).searchParams.get('state')!;
  expect(await consumeOAuth('google',state,'0'.repeat(64),'https://www.zerivex.tech/callback')).toBeNull();
  expect(await consumeOAuth('github',state,attempt.browserToken,'https://www.zerivex.tech/callback')).toBeNull();
  const correct=await consumeOAuth('google',state,attempt.browserToken,'https://www.zerivex.tech/callback');expect(correct?.returnTo).toBe('/invite/token');
  expect(await consumeOAuth('google',state,attempt.browserToken,'https://www.zerivex.tech/callback')).toBeNull();
 });
 it('does not store raw browser tokens, OAuth state or PKCE verifier',async()=>{
  await query('DELETE FROM oauth_login_attempts');const attempt=await beginOAuth('github','https://zerivex.tech/login','//attacker.test');
  const row=(await query<{state_hash:string;browser_token_hash:string;encrypted_verifier:string;return_to:string}>('SELECT * FROM oauth_login_attempts')).rows[0]!;
  expect(row.state_hash).not.toBe(new URL(attempt.authorizationUrl).searchParams.get('state'));expect(row.browser_token_hash).not.toBe(attempt.browserToken);expect(row.return_to).not.toBe('/dashboard');expect(row.encrypted_verifier.length).toBeGreaterThan(60);
 });
 it('expires attempts and atomically permits at most one simultaneous callback',async()=>{
  const expired=await beginOAuth('google','https://zerivex.tech/login',null);await query("UPDATE oauth_login_attempts SET expires_at=NOW()-INTERVAL '1 second'");
  expect(await consumeOAuth('google',new URL(expired.authorizationUrl).searchParams.get('state'),expired.browserToken,'https://zerivex.tech/callback')).toBeNull();
  const valid=await beginOAuth('github','https://zerivex.tech/login',null);const state=new URL(valid.authorizationUrl).searchParams.get('state');const outcomes=await Promise.all([consumeOAuth('github',state,valid.browserToken,'https://zerivex.tech/callback'),consumeOAuth('github',state,valid.browserToken,'https://zerivex.tech/callback')]);expect(outcomes.filter(Boolean)).toHaveLength(1);
 });
 it.each(['google','github'] as const)('completes %s sign-in through the real route and database session',async provider=>{
  const params={params:Promise.resolve({provider})};const started=await start(new NextRequest(`https://www.zerivex.tech/api/auth/login/${provider}?returnTo=%2Finvite%2Fpreserved`),params);
  expect(started.status).toBe(307);const auth=new URL(started.headers.get('location')!);expect(auth.searchParams.get('code_challenge_method')).toBe('S256');
  const binding=started.cookies.get(oauthCookieName(provider))!.value;
  const fetch=vi.fn().mockResolvedValueOnce(reply({access_token:'private-token'}));
  if(provider==='google')fetch.mockResolvedValueOnce(reply({sub:'new-google-user',email:'new-google@flow.test',email_verified:true,name:'New Google User'}));
  else fetch.mockResolvedValueOnce(reply({id:234,login:'new-github-user'})).mockResolvedValueOnce(reply([{email:'new-github@flow.test',verified:true,primary:true}]));
  vi.stubGlobal('fetch',fetch);
  const callbackUrl=new URL(`/api/auth/callback/${provider}`,'https://www.zerivex.tech');callbackUrl.searchParams.set('state',auth.searchParams.get('state')!);callbackUrl.searchParams.set('code','authorization-code');
  const response=await callback(new NextRequest(callbackUrl,{headers:{cookie:`${oauthCookieName(provider)}=${binding}`}}),params);
  expect(response.headers.get('location')).toBe('https://www.zerivex.tech/invite/preserved');
  expect(response.cookies.get(oauthCookieName(provider))?.value).toBe('');
  const token=response.cookies.get(SESSION_COOKIE_NAME)?.value;expect(token).toBeTruthy();expect((await validateSessionToken(token!))?.user.role).toBe('USER');
  const body=fetch.mock.calls[0]?.[1]?.body as URLSearchParams;expect(body.get('redirect_uri')).toBe(auth.searchParams.get('redirect_uri'));expect(body.get('code_verifier')).toBeTruthy();
 });
 it('consumes a denied consent and clears its browser cookie without issuing a session',async()=>{
  const attempt=await beginOAuth('github','https://zerivex.tech/login',null);const state=new URL(attempt.authorizationUrl).searchParams.get('state');
  const response=await callback(new NextRequest(`https://zerivex.tech/api/auth/callback/github?state=${state}&error=access_denied`,{headers:{cookie:`${oauthCookieName('github')}=${attempt.browserToken}`}}),{params:Promise.resolve({provider:'github'})});
  expect(response.headers.get('location')).toContain('oauth_denied');expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  expect(await consumeOAuth('github',state,attempt.browserToken,'https://zerivex.tech/callback')).toBeNull();
 });
 it('does not exchange a code without the original browser binding',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const response=await callback(new NextRequest('https://zerivex.tech/api/auth/callback/google?state='+'0'.repeat(48)+'&code=private'),{params:Promise.resolve({provider:'google'})});expect(response.headers.get('location')).toContain('invalid_state');expect(fetch).not.toHaveBeenCalled();
 });
 it('cannot turn a customer Google handshake into a staff login',async()=>{
  const attempt=await beginOAuth('google','https://zerivex.tech/login','/staff');const state=new URL(attempt.authorizationUrl).searchParams.get('state');
  expect(await consumeOAuth('google',state,attempt.browserToken,'https://zerivex.tech/callback','staff')).toBeNull();
  expect(await consumeOAuth('google',state,attempt.browserToken,'https://zerivex.tech/callback')).not.toBeNull();
 });
 it('issues only a staff cookie after Google identity, allowlist and explicit role checks',async()=>{
  vi.stubEnv('STAFF_ALLOWED_EMAILS','owner@staffflow.test');_resetConfigForTesting();
  const owner=(await query<{id:string}>("INSERT INTO users (email,email_verified_at) VALUES ('owner@staffflow.test',NOW()) RETURNING id")).rows[0]!.id;
  await query("INSERT INTO platform_roles (user_id,role) VALUES ($1,'STAFF_OWNER')",[owner]);
  const started=await staffStart(new NextRequest('https://zerivex.tech/api/staff/auth/login'));const auth=new URL(started.headers.get('location')!);
  expect(auth.searchParams.get('redirect_uri')).toBe('https://zerivex.tech/api/staff/auth/callback');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(reply({access_token:'token'})).mockResolvedValueOnce(reply({sub:'staff-owner',email:'owner@staffflow.test',email_verified:true})));
  const response=await staffCallback(new NextRequest(`https://zerivex.tech/api/staff/auth/callback?state=${auth.searchParams.get('state')}&code=code`,{headers:{cookie:`${oauthCookieName('google','staff')}=${started.cookies.get(oauthCookieName('google','staff'))!.value}`}}));
  expect(response.headers.get('location')).toBe('https://zerivex.tech/staff');expect(response.cookies.get(STAFF_SESSION_COOKIE_NAME)?.value).toBeTruthy();expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
 });
 it('refuses staff access without creating or promoting an account',async()=>{
  vi.stubEnv('STAFF_ALLOWED_EMAILS','outsider@staffflow.test');_resetConfigForTesting();
  const attempt=await beginOAuth('google','https://zerivex.tech/login','/staff','staff');const state=new URL(attempt.authorizationUrl).searchParams.get('state');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(reply({access_token:'token'})).mockResolvedValueOnce(reply({sub:'outsider',email:'outsider@staffflow.test',email_verified:true})));
  const response=await staffCallback(new NextRequest(`https://zerivex.tech/api/staff/auth/callback?state=${state}&code=code`,{headers:{cookie:`${oauthCookieName('google','staff')}=${attempt.browserToken}`}}));
  expect(response.headers.get('location')).toContain('unauthorized');expect(response.cookies.get(STAFF_SESSION_COOKIE_NAME)).toBeUndefined();expect((await query("SELECT id FROM users WHERE email='outsider@staffflow.test'")).rows).toHaveLength(0);
 });

});
