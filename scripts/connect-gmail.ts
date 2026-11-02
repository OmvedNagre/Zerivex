import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import { loadLocalEnvironment } from './lib/environment';
loadLocalEnvironment();
async function main() {
  const id=process.env.GMAIL_CLIENT_ID;const secret=process.env.GMAIL_CLIENT_SECRET;
  if(!id || !secret) throw new Error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in ignored .env.local first');
  const redirect='http://127.0.0.1:5367/oauth/callback';const state=randomBytes(32).toString('hex');
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  Object.entries({client_id:id,redirect_uri:redirect,response_type:'code',scope:'openid email https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',state,login_hint:'zerivex.secure@gmail.com'}).forEach(([k,v])=>auth.searchParams.set(k,v));
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url || '/',redirect);if(url.pathname!=='/oauth/callback'){res.writeHead(404).end();return;}
    const received=url.searchParams.get('state') || '';if(received.length!==state.length || !timingSafeEqual(Buffer.from(received),Buffer.from(state))){res.writeHead(403).end('Invalid state');return;}
    try {
      const code=url.searchParams.get('code');if(!code)throw new Error('Authorization denied');
      const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),body:new URLSearchParams({client_id:id,client_secret:secret,code,redirect_uri:redirect,grant_type:'authorization_code'})});
      if(!response.ok)throw new Error('Token exchange failed');const tokens=await response.json();
      const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${tokens.access_token}`}});
      if(!profileResponse.ok)throw new Error('Could not verify sender');const profile=await profileResponse.json();
      if(profile.email!=='zerivex.secure@gmail.com' || !profile.email_verified || !tokens.refresh_token)throw new Error('Connect the verified zerivex.secure@gmail.com account and grant offline access');
      const file='.env.local';const content=await fs.readFile(file,'utf8').catch(()=>'');const lines=content.split('\n').filter(l=>!l.startsWith('GMAIL_REFRESH_TOKEN='));lines.push(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);await fs.writeFile(file,lines.join('\n')+'\n',{mode:0o600});await fs.chmod(file,0o600);
      res.writeHead(200,{'Content-Type':'text/plain'}).end('Zerivex sender connected. You may close this tab.');console.log('Sender verified and refresh credential saved to ignored .env.local. No email was sent.');
    } catch {res.writeHead(400).end('Connection failed. Retry and choose the Zerivex sender account.');console.error('Gmail connection failed; no credentials were logged.');process.exitCode=1;}
    finally {server.close();clearTimeout(timer);}
  });
  const timer=setTimeout(()=>{server.close();console.error('Gmail connection timed out. Run again to retry.');},10*60*1000);
  server.on('error',()=>{clearTimeout(timer);console.error('Gmail callback server could not start; ensure port 5367 is available.');process.exitCode=1;});
  server.listen(5367,'127.0.0.1',()=>console.log(`Open this URL in your browser and choose zerivex.secure@gmail.com:\n${auth.toString()}`));
}
main().catch(()=>{console.error('Set Gmail client credentials in ignored .env.local and register http://127.0.0.1:5367/oauth/callback in Google Cloud. No credentials were logged.');process.exitCode=1;});
