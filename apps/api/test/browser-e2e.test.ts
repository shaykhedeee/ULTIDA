import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from '../src/index.js';
import puppeteer from 'puppeteer-core';

async function withServer<T>(callback: (baseUrl: string) => Promise<T>) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try { return await callback(`http://127.0.0.1:${address.port}`); } finally {
    // Chromium can keep the fetch socket alive briefly after the page closes.
    // Close idle/active connections explicitly so the TAP child can terminate.
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('Browser headless verification of api documentation & status endpoints', async (t) => {
  await withServer(async (baseUrl) => {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\USER';
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Users\\USER\\.cache\\puppeteer\\chrome\\win64-150.0.7871.24\\chrome-win64\\chrome.exe',
      path.join(userProfile, '.cache', 'puppeteer', 'chrome', 'win64-150.0.7871.24', 'chrome-win64', 'chrome.exe'),
      path.join(userProfile, '.cache', 'puppeteer', 'chrome', 'win64-146.0.7680.153', 'chrome-win64', 'chrome.exe'),
      path.join(userProfile, '.cache', 'puppeteer', 'chrome', 'win64-146.0.7680.153', 'chrome-win64', 'chrome')
    ];
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || possiblePaths.find(p => fs.existsSync(p));
    if (!execPath) {
      t.skip('No supported Chrome or Edge executable is installed for this optional browser check.');
      return;
    }
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: execPath,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 10000
      });
    } catch (error) {
      t.skip(`A browser executable was found but could not be launched in this environment: ${error instanceof Error ? error.message : 'unknown launch error'}`);
      return;
    }
    try {
      const page = await browser.newPage();
      
      const payload = await page.evaluate(async (url) => {
        const res = await fetch(`${url}/api/health`);
        return res.json();
      }, baseUrl);
      
      assert.equal(payload.app, 'ultida');
      assert.ok(Array.isArray(payload.providers));
    } finally {
      await browser.close();
    }
  });
});
