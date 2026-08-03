import type { IncomingMessage, ServerResponse } from 'node:http';

// Vercel discovers this catch-all as a Node serverless function. Loading the
// Express app lazily gives deployed diagnostics a stable, non-secret response
// if a workspace dependency is missing during function initialisation.
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    // Vite deployments sometimes register a catch-all function only one
    // segment deep. vercel.json rewrites all /api/* paths here and preserves
    // the original path in a query value; restore it before Express routes.
    const requestUrl = new URL(request.url ?? '/', 'https://ultida.local');
    const rewrittenPath = requestUrl.searchParams.get('__ultida_path');
    if (rewrittenPath) {
      requestUrl.searchParams.delete('__ultida_path');
      request.url = `/api/${rewrittenPath.replace(/^\/+/, '')}${requestUrl.search}`;
    }
    // Vercel must execute the compiled API. Importing the TypeScript source
    // here works inconsistently across builders and can hide missing package
    // builds until the first authenticated request.
    const { app } = await import('../apps/api/dist/index.js');
    return app(request as never, response as never);
  } catch (error) {
    console.error('ULTIDA API bootstrap failed', {
      message: error instanceof Error ? error.message : 'Unknown module initialization error.',
    });
    response.statusCode = 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      success: false,
      code: 'API_BOOTSTRAP_FAILED',
      message: 'The API could not start. Check the deployment runtime logs using this request ID.',
      requestId: typeof request.headers['x-vercel-id'] === 'string' ? request.headers['x-vercel-id'] : null,
    }));
  }
}
