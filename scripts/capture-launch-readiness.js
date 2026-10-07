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
  const page = pages.find(p => p.url.includes('launch-readiness') || p.url.includes('dashboard')) || pages[0];
  if (!page) {
    console.error('No dashboard page found in Chrome');
    process.exit(1);
  }

  console.log('Connecting to page:', page.title, page.url);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(res => ws.on('open', res));

  // Enable Page, Runtime, DOM
  await sendCDP(ws, 'Page.enable');
  await sendCDP(ws, 'Runtime.enable');

  // Log in via mock auth first to ensure clean session
  console.log('Authenticating via mock login...');
  await sendCDP(ws, 'Page.navigate', { url: 'http://localhost:3000/api/auth/login/mock' });
  await new Promise(r => setTimeout(r, 1000));

  // Navigate to launch-readiness
  console.log('Navigating to launch-readiness...');
  await sendCDP(ws, 'Page.navigate', { url: 'http://localhost:3000/dashboard/launch-readiness' });
  await new Promise(r => setTimeout(r, 2000));

  // Desktop Dark Mode Viewport
  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1320,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false
  });

  // Ensure Dark theme
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.classList.remove('light');"
  });
  await new Promise(r => setTimeout(r, 500));

  // 1. Screenshot: Subsystems Tab (Dark Mode)
  console.log('Capturing: readiness_subsystems_dark.png');
  let shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'readiness_subsystems_dark.png'), Buffer.from(shot.data, 'base64'));

  // 2. Click 'Dogfooding Self-Scan Report' tab
  console.log('Clicking Self-Scan tab...');
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "Array.from(document.querySelectorAll('.zlr-tab-btn')).find(b => b.textContent.includes('Self-Scan'))?.click()"
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('Capturing: readiness_selfscan_dark.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'readiness_selfscan_dark.png'), Buffer.from(shot.data, 'base64'));

  // 3. Click 'Pre-Launch Checklist' tab
  console.log('Clicking Checklist tab...');
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "Array.from(document.querySelectorAll('.zlr-tab-btn')).find(b => b.textContent.includes('Checklist'))?.click()"
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('Capturing: readiness_checklist_dark.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'readiness_checklist_dark.png'), Buffer.from(shot.data, 'base64'));

  // 4. Switch to Light Mode (Audit P0 verification)
  console.log('Switching to Light Mode...');
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'light'); document.documentElement.classList.add('light');"
  });
  // Switch back to Subsystems tab in Light Mode
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "Array.from(document.querySelectorAll('.zlr-tab-btn')).find(b => b.textContent.includes('Subsystem'))?.click()"
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('Capturing: readiness_subsystems_light.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'readiness_subsystems_light.png'), Buffer.from(shot.data, 'base64'));

  // Light Mode Self-Scan tab
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "Array.from(document.querySelectorAll('.zlr-tab-btn')).find(b => b.textContent.includes('Self-Scan'))?.click()"
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('Capturing: readiness_selfscan_light.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'readiness_selfscan_light.png'), Buffer.from(shot.data, 'base64'));

  // 5. Audit P1 verification: Intermediate tablet width (834px)
  console.log('Setting viewport to 834px (Audit P1 range)...');
  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 834,
    height: 1194,
    deviceScaleFactor: 2,
    mobile: false
  });
  // Switch back to Subsystems tab
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "Array.from(document.querySelectorAll('.zlr-tab-btn')).find(b => b.textContent.includes('Subsystem'))?.click()"
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('Capturing: readiness_tablet_834px.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'readiness_tablet_834px.png'), Buffer.from(shot.data, 'base64'));

  // 6. Mobile Viewport (390px)
  console.log('Setting viewport to 390px mobile...');
  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 600));

  console.log('Capturing: readiness_mobile_390px.png');
  shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'readiness_mobile_390px.png'), Buffer.from(shot.data, 'base64'));

  // Reset to dark theme for user
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: "document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.classList.remove('light');"
  });

  ws.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
