import { after, before, test } from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { listCatalog } from '@ultida/catalog-core';

let vite, browser, baseUrl;
before(async () => {
  vite = await createServer({
    configFile: false, root: resolve('apps/web'),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'room-catalog-fixture', configureServer(server) {
      server.middlewares.use('/__room-test', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await server.transformIndexHtml('/__room-test', `<div id="root"></div><script type="module">
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { MemoryRouter } from 'react-router-dom';
          import { DesignFlowWorkspace } from '/src/components/design/DesignFlowWorkspace.tsx';
          createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, null,
            React.createElement(DesignFlowWorkspace, { stage: 'Design', focus: 'modules', projectId: 'fixture',
              planApproved: true, briefComplete: true, sceneVersionId: null, sceneApproved: false,
              modules: [], materials: [], onSceneCreated: async () => {}, onSceneApproved: async () => false })));
        </script>`));
      });
    } }],
  });
  await vite.listen();
  baseUrl = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); await vite?.close(); });

async function roomPage(catalogHandler) {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/catalog/modules')) return catalogHandler(route, url.searchParams.get('room'));
    let payload = {};
    if (url.pathname.endsWith('/spaces')) payload = { spaces: [
      { id: 'kitchen', name: 'Kitchen', room_type: 'kitchen', geometry_json: { worldPolygon: [] } },
      { id: 'dining', name: 'Dining', room_type: 'dining', geometry_json: { worldPolygon: [] } },
    ] };
    if (url.pathname.endsWith('/floor-plan/active')) payload = { walls: [], openings: [] };
    await route.fulfill({ json: payload });
  });
  await page.goto(`${baseUrl}/__room-test`);
  return page;
}

test('switching rooms clears filters that hide the new room catalog', async () => {
  const page = await roomPage((route, room) => route.fulfill({ json: { modules: listCatalog(room) } }));
  try {
    await expect(page.locator('button.catalog-item').first()).toBeVisible();
    await expect(page.locator('button.catalog-item button')).toHaveCount(0);
    await page.getByLabel(/^Module family/).selectOption('kitchen-base');
    await page.getByPlaceholder('TV wall, glass crockery, loft wardrobe').fill('base');
    await page.getByLabel(/^Place in/).selectOption('dining');
    await expect(page.locator('button.catalog-item').filter({ hasText: '1800 Full-Wall Crockery' })).toBeVisible();
    await page.getByPlaceholder('TV wall, glass crockery, loft wardrobe').fill('nothing-matches-this');
    await expect(page.getByRole('button', { name: 'Clear catalog filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear catalog filters' }).click();
    await expect(page.locator('button.catalog-item').first()).toBeVisible();
  } finally { await page.close(); }
});

test('failed catalog request retains bundled room templates', async () => {
  const page = await roomPage((route) => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
  try {
    await page.getByLabel(/^Place in/).selectOption('dining');
    await expect(page.locator('button.catalog-item').filter({ hasText: '1800 Full-Wall Crockery' })).toBeVisible();
  } finally { await page.close(); }
});

test('late responses cannot replace the selected room catalog', async () => {
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  const page = await roomPage(async (route, room) => {
    if (room === 'kitchen') await delayed;
    await route.fulfill({ json: { modules: listCatalog(room) } }).catch(() => {});
  });
  try {
    await page.getByLabel(/^Place in/).selectOption('dining');
    await expect(page.locator('button.catalog-item').filter({ hasText: '1800 Full-Wall Crockery' })).toBeVisible();
    release();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('button.catalog-item').filter({ hasText: '1800 Full-Wall Crockery' })).toBeVisible();
  } finally { release(); await page.close(); }
});
