import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetConfigForTesting } from '@/core/config/env-validator';
import { getOAuthAuthorizationUrl, exchangeGoogleCode, exchangeGitHubCode } from '@/core/auth/oauth-service';
import { oauthOrigin, oauthRequestUrl, safeOAuthReturnTo } from '@/core/auth/oauth-config';
import { classifyAuthFailure } from '@/core/auth/oauth-errors';
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_APP_URL','https://zerivex.tech');vi.stubEnv('GOOGLE_CLIENT_ID','google-id');vi.stubEnv('GOOGLE_CLIENT_SECRET','google-secret');vi.stubEnv('GITHUB_CLIENT_ID','github-id');vi.stubEnv('GITHUB_CLIENT_SECRET','github-secret');_resetConfigForTesting();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();_resetConfigForTesting();});
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
describe('Rebuilt OAuth provider transports',()=>{
 it.each(['google','github'] as const)('uses PKCE and its own client for %s',provider=>{const u=new URL(getOAuthAuthorizationUrl(provider,'state','challenge','https://www.zerivex.tech/api/auth/callback/'+provider));expect(u.searchParams.get('client_id')).toBe(provider+'-id');expect(u.searchParams.get('code_challenge_method')).toBe('S256');expect(u.searchParams.get('redirect_uri')).toContain('https://www.zerivex.tech/');expect(u.searchParams.has('access_type')).toBe(false);});
 it('permits the configured www counterpart while rejecting unrelated callback hosts',()=>{expect(oauthOrigin('https://www.zerivex.tech/login')).toBe('https://www.zerivex.tech');expect(()=>oauthOrigin('https://zerivex.tech.attacker.test')).toThrow();expect(()=>getOAuthAuthorizationUrl('google','state','challenge','https://attacker.test/api/auth/callback/google')).toThrow();});
 it.each(['//attacker.test','/\\attacker.test','https://attacker.test','/dashboard\nLocation:evil','javascript:alert(1)'])('rejects unsafe return path %s',path=>expect(safeOAuthReturnTo(path)).toBe('/dashboard'));
 it('keeps the complete invitation return path',()=>expect(safeOAuthReturnTo('/invite/inv_123?source=email')).toBe('/invite/inv_123?source=email'));
 it('uses the stored callback and verifier during Google exchange',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(reply({access_token:'token'})).mockResolvedValueOnce(reply({sub:'google-user',email:'new@example.test',email_verified:true}));vi.stubGlobal('fetch',fetch);
  const profile=await exchangeGoogleCode('code','verifier','https://www.zerivex.tech/api/auth/callback/google');expect(profile.isEmailVerified).toBe(true);
  const body=fetch.mock.calls[0]?.[1]?.body as URLSearchParams;expect(body.get('redirect_uri')).toBe('https://www.zerivex.tech/api/auth/callback/google');expect(body.get('code_verifier')).toBe('verifier');
 });
 it('rejects truthy but nonboolean Google email verification',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(reply({access_token:'token'})).mockResolvedValueOnce(reply({sub:'id',email:'user@example.test',email_verified:'true'})));await expect(exchangeGoogleCode('code','verifier')).rejects.toThrow('unverified_email');});
 it('handles GitHub token errors even when its HTTP response is 200',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(reply({error:'incorrect_client_credentials',error_description:'do not log this'})));const error=await exchangeGitHubCode('code','verifier').catch(e=>e);expect(classifyAuthFailure(error,'provider')).toBe('oauth_client_config');expect(error.message).not.toContain('do not log');});
 it('checks GitHub profile and verified primary email before creating an identity',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(reply({access_token:'token'})).mockResolvedValueOnce(reply({id:42,login:'builder'})).mockResolvedValueOnce(reply([{email:'bad@example.test',primary:true,verified:false},{email:'verified@example.test',primary:false,verified:true}])));
  expect((await exchangeGitHubCode('code','verifier')).email).toBe('verified@example.test');
 });
 it('rejects failed GitHub user requests before fetching or trusting emails',async()=>{const fetch=vi.fn().mockResolvedValueOnce(reply({access_token:'token'})).mockResolvedValueOnce(reply({message:'not authorized'},401));vi.stubGlobal('fetch',fetch);await expect(exchangeGitHubCode('code','verifier')).rejects.toThrow('profile_unavailable');expect(fetch).toHaveBeenCalledTimes(2);});
 it('rejects GitHub users with no verified email',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(reply({access_token:'token'})).mockResolvedValueOnce(reply({id:42,login:'builder'})).mockResolvedValueOnce(reply([{email:'user@example.test',primary:true,verified:false}])));await expect(exchangeGitHubCode('code','verifier')).rejects.toThrow('unverified_email');});
 it('resolves a framework-internal request URL using only an explicitly trusted public host',()=>{
   expect(oauthRequestUrl({url:'http://localhost:3000/api/auth/login/google',headers:new Headers({host:'www.zerivex.tech'})})).toBe('https://www.zerivex.tech/api/auth/login/google');
   expect(()=>oauthRequestUrl({url:'https://zerivex.tech/api/auth/login/google',headers:new Headers({host:'evil.test'})})).toThrow();
   expect(()=>oauthRequestUrl({url:'https://zerivex.tech/api/auth/login/google',headers:new Headers({host:'evil@zerivex.tech'})})).toThrow();
 });

});
