import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeGoogleCode } from '@/core/auth/oauth-service';
import { _resetConfigForTesting } from '@/core/config/env-validator';
import { OAuthExchangeError, authFailureDetails, classifyAuthFailure } from '@/core/auth/oauth-errors';
beforeEach(()=>{vi.stubEnv('GOOGLE_CLIENT_ID','test-client');vi.stubEnv('GOOGLE_CLIENT_SECRET','private-secret');_resetConfigForTesting();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();_resetConfigForTesting();});
describe('Safe OAuth failure diagnostics',()=>{
  it('identifies rejected client credentials without leaking the provider description',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'invalid_client',error_description:'sensitive provider information'}),{status:401})));
    const error=await exchangeGoogleCode('private-code','private-verifier').catch(e=>e);
    expect(classifyAuthFailure(error,'provider')).toBe('oauth_client_config');
    expect(authFailureDetails(error)).toEqual({httpStatus:401,providerError:'invalid_client'});
    expect(error.message).not.toContain('sensitive');expect(error.message).not.toContain('private');
  });
  it('separates expired authorization from credential rejection',()=>{expect(classifyAuthFailure(new OAuthExchangeError('Google',400,'invalid_grant'),'provider')).toBe('oauth_code_exchange');});
  it('does not echo arbitrary provider fields or database messages',()=>{
    const error=new OAuthExchangeError('Google',400,'private-token');expect(error.providerCode).toBe('unknown');
    expect(authFailureDetails({code:'42P01',message:'private database details'})).toEqual({databaseCode:'42P01'});
    expect(classifyAuthFailure(new Error('private database details'),'account')).toBe('account_setup_failed');
    expect(authFailureDetails({code:'a-secret-value'}).databaseCode).toBeUndefined();
  });
});
