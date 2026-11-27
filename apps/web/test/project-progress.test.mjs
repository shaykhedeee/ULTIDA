import { test } from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

test('mobile Project Progress saves a revised PDF alongside its approved predecessor', async () => {
  const vite = await createServer({
    configFile: false, root: resolve('apps/web'), server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'project-progress-fixture', enforce: 'pre',
      resolveId(source) { if (/\/lib\/supabase(?:\.ts)?$/.test(source)) return '\0progress-auth'; },
      load(id) {
        if (id === '\0progress-auth') return "export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})},storage:{from:()=>({uploadToSignedUrl:async()=>({error:null})})}};";
      },
      configureServer(server) {
        server.middlewares.use('/__progress', async (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.end(await server.transformIndexHtml('/__progress', '<div id="root"></div><script type="module">' +
            "import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';" +
            "import {PipelineWorkspace} from '/src/features/pipeline/PipelineWorkspace.tsx';" +
            "createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:['/projects/project/pipeline']},React.createElement(Routes,null,React.createElement(Route,{path:'/projects/:projectId/pipeline',element:React.createElement(PipelineWorkspace)}))));</script>"));
        });
      },
    }],
  });
  let browser;
  try {
    await vite.listen();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    const rooms = [{ id: 'kitchen', name: 'Kitchen', roomType: 'kitchen' }, { id: 'bedroom', name: 'Bedroom', roomType: 'bedroom' }];
    const original = { id: 'first', projectId: 'project', roomId: 'kitchen', roomName: 'Kitchen',
      title: 'Kitchen elevation', category: 'Working Drawing', revision: 'R01', owner: 'Editor one',
      sourceType: 'external_drive_link', externalUrl: 'https://example.com/approved.pdf', approvalStatus: 'Approved', updatedAt: '2026-11-27' };
    let pipeline = { version: 1, tasks: [], files: [original] };
    await page.route('**/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/studio/pipeline')) return route.fulfill({ json: { projects: [{ projectId: 'project', projectName: 'Test project', rooms, pipeline }] } });
      if (path.endsWith('/initiate')) return route.fulfill({ json: { success: true, assetId: 'pdf-asset', storagePath: 'private/revised.pdf', token: 'fixture' } });
      if (path.endsWith('/complete')) return route.fulfill({ json: { success: true, assetId: 'pdf-asset' } });
      if (request.method() === 'PUT') {
        const body = request.postDataJSON();
        expect(body.expectedVersion).toBe(1);
        expect(body.files[0]).toMatchObject({ roomId: 'kitchen', parentId: 'first', originalName: 'revised.pdf', round: 'R02', nextAction: 'Check beam clearance', notes: 'Added pencil drawers' });
        pipeline = { version: 2, tasks: body.tasks, files: [{ ...body.files[0], sequence: 2 }, ...body.files.slice(1)] };
        return route.fulfill({ json: { success: true, pipeline } });
      }
      return route.fulfill({ json: { rooms, pipeline } });
    });
    const url = 'http://127.0.0.1:' + vite.httpServer.address().port + '/__progress';
    await page.goto(url);
    await expect(page.getByRole('navigation', { name: 'Project phases' }).getByRole('button')).toHaveCount(8);
    await page.getByLabel('Previous version').selectOption('first');
    await page.getByLabel('Revision round').fill('R02');
    await page.getByLabel('Next action', { exact: true }).fill('Check beam clearance');
    await page.getByLabel('What changed').fill('Added pencil drawers');
    await page.locator('input[type=file]').setInputFiles({ name: 'revised.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-test-fixture') });
    await page.getByRole('button', { name: 'Save Revision' }).click();
    await expect(page.getByText('Next action: Check beam clearance')).toBeVisible();
    await page.reload();
    await expect(page.getByText('R02 · v2')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open External Link' })).toHaveAttribute('href', original.externalUrl);
  } finally {
    await browser?.close();
    await vite.close();
  }
});
