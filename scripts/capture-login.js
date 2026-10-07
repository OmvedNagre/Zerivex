const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('/Users/omvednagre/node_modules/ws');

const ARTIFACTS_DIR = '/Users/omvednagre/.gemini/antigravity-ide/brain/071a94ab-99be-4587-ab58-65d50ff790d6';

function getPages() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function sendCDP(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === id) {
        ws.off('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  const pages = await getPages();
  const page = pages.find(p => p.url.includes('dashboard') || p.url.includes('login') || p.url.includes('3000')) || pages[0];
  if (!page) {
    console.error('No dashboard or login page found in Chrome');
    process.exit(1);
  }

  console.log('Connecting to page:', page.title, page.url);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(res => ws.on('open', res));

  await sendCDP(ws, 'Page.enable');
  await sendCDP(ws, 'Runtime.enable');

  // 1. Desktop Dark Mode (Clean login)
  console.log('Navigating to http://localhost:3000/login...');
  await sendCDP(ws, 'Page.navigate', { url: 'http://localhost:3000/login' });
  await new Promise(r => setTimeout(r, 1500));

  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1320,
    height: 840,
    deviceScaleFactor: 2,
    mobile: false
  });

  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.classList.remove('light');"
  });
  await new Promise(r => setTimeout(r, 500));

  console.log('Capturing: login_desktop_dark.png');
  let shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'login_desktop_dark.png'), Buffer.from(shot.data, 'base64'));

  // 2. Desktop Light Mode (Google button contrast audit verification)
  console.log('Switching to Light Mode...');
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'light'); document.documentElement.classList.add('light');"
  });
  await new Promise(r => setTimeout(r, 500));

  console.log('Capturing: login_desktop_light.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'login_desktop_light.png'), Buffer.from(shot.data, 'base64'));

  // 3. Error State (invalid_state error) in Dark Mode
  console.log('Navigating to http://localhost:3000/login?error=invalid_state...');
  await sendCDP(ws, 'Page.navigate', { url: 'http://localhost:3000/login?error=invalid_state' });
  await new Promise(r => setTimeout(r, 1000));

  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.classList.remove('light');"
  });
  await new Promise(r => setTimeout(r, 400));

  console.log('Capturing: login_error_dark.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'login_error_dark.png'), Buffer.from(shot.data, 'base64'));

  // 4. Error State (auth_failed error) in Light Mode
  console.log('Switching to Light Mode for error state...');
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'light'); document.documentElement.classList.add('light');"
  });
  await new Promise(r => setTimeout(r, 400));

  console.log('Capturing: login_error_light.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'login_error_light.png'), Buffer.from(shot.data, 'base64'));

  // 5. Tablet 834px Viewport
  console.log('Setting viewport to 834px tablet...');
  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 834,
    height: 1194,
    deviceScaleFactor: 2,
    mobile: false
  });
  await sendCDP(ws, 'Page.navigate', { url: 'http://localhost:3000/login' });
  await new Promise(r => setTimeout(r, 1000));
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.classList.remove('light');"
  });
  await new Promise(r => setTimeout(r, 400));

  console.log('Capturing: login_tablet_834px.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'login_tablet_834px.png'), Buffer.from(shot.data, 'base64'));

  // 6. Mobile 390px Viewport
  console.log('Setting viewport to 390px mobile...');
  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 500));

  console.log('Capturing: login_mobile_390px.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'login_mobile_390px.png'), Buffer.from(shot.data, 'base64'));

  // Reset to dark
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.classList.remove('light');"
  });

  ws.close();
  console.log('All login screenshots captured successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
