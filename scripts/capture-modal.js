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
  const page = pages.find(p => p.url.includes('dashboard') || p.url.includes('targets') || p.url.includes('3000')) || pages[0];
  if (!page) {
    console.error('No page found in Chrome');
    process.exit(1);
  }

  console.log('Connecting to page:', page.title, page.url);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(res => ws.on('open', res));

  await sendCDP(ws, 'Page.enable');
  await sendCDP(ws, 'Runtime.enable');

  console.log('Navigating to http://localhost:3000/dashboard/targets...');
  await sendCDP(ws, 'Page.navigate', { url: 'http://localhost:3000/dashboard/targets' });
  await new Promise(r => setTimeout(r, 2000));

  // 1. Desktop Dark Mode (Register Target Modal)
  console.log('Setting Desktop Dark...');
  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1320,
    height: 840,
    deviceScaleFactor: 2,
    mobile: false
  });
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      // Click register button
      const buttons = Array.from(document.querySelectorAll('button'));
      const regBtn = buttons.find(b => b.textContent.includes('Register') || b.textContent.includes('Add Target'));
      if (regBtn) regBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  const darkRegScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_register_dark.png'), Buffer.from(darkRegScreenshot.data, 'base64'));
  console.log('Saved modal_register_dark.png');

  // 2. Desktop Light Mode (Register Target Modal)
  console.log('Setting Desktop Light...');
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const lightRegScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_register_light.png'), Buffer.from(lightRegScreenshot.data, 'base64'));
  console.log('Saved modal_register_light.png');

  // Close Register Modal & Open Delete Confirmation Modal
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      // Close current modal
      const closeBtn = document.querySelector('.zmd-close-btn');
      if (closeBtn) closeBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // 3. Desktop Delete Confirmation Modal (size: sm, role: alertdialog)
  console.log('Opening Delete Confirmation Modal...');
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      const delBtn = document.querySelector('.ztt-btn-delete');
      if (delBtn) delBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const deleteModalScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_delete_confirm_dark.png'), Buffer.from(deleteModalScreenshot.data, 'base64'));
  console.log('Saved modal_delete_confirm_dark.png');

  // Close delete modal and open register modal for responsive viewports
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      const closeBtn = document.querySelector('.zmd-close-btn');
      if (closeBtn) closeBtn.click();
      const buttons = Array.from(document.querySelectorAll('button'));
      const regBtn = buttons.find(b => b.textContent.includes('Register') || b.textContent.includes('Add Target'));
      if (regBtn) regBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  // 4. Tablet Viewport (834px)
  console.log('Capturing Tablet 834px...');
  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 834,
    height: 1194,
    deviceScaleFactor: 2,
    mobile: false
  });
  await new Promise(r => setTimeout(r, 800));
  const tabletScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_tablet_834px.png'), Buffer.from(tabletScreenshot.data, 'base64'));
  console.log('Saved modal_tablet_834px.png');

  // 5. Mobile Viewport (390px)
  console.log('Capturing Mobile 390px...');
  await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 800));
  const mobileScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_mobile_390px.png'), Buffer.from(mobileScreenshot.data, 'base64'));
  console.log('Saved modal_mobile_390px.png');

  ws.close();
  console.log('All modal screenshots captured successfully!');
}

run().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
