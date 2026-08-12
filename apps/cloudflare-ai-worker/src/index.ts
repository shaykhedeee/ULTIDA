interface Env {
  API_BASE: string;
  ULTIDA_WORKER_SHARED_SECRET: string;
  VERCEL_PROTECTION_BYPASS_SECRET?: string;
  AI_JOBS: {
    send(message: DispatchMessage): Promise<void>;
  };
}

interface QueueMessage<T> {
  body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

interface MessageBatch<T> {
  messages: Array<QueueMessage<T>>;
}

type JobMessage = { jobId: string; kind: 'plan-analysis' };
type DispatchMessage = JobMessage & { callbackBase?: string };

async function sameSecret(expected: string | undefined, supplied: string | null) {
  if (!expected || !supplied) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
  ]);
  const a = new Uint8Array(left); const b = new Uint8Array(right);
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

function resolveCallbackBase(env: Env, message?: DispatchMessage) {
  const candidate = message?.callbackBase?.trim();
  if (!candidate) return env.API_BASE.replace(/\/$/, '');
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('The queued job callback URL is invalid.');
  }
  // Only deployment URLs may be supplied by the authenticated API. This keeps
  // a compromised queue message from turning the Worker into an arbitrary
  // authenticated request proxy.
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || !url.pathname.startsWith('/api')) {
    throw new Error('The queued job callback URL is not an approved ULTIDA deployment API.');
  }
  return url.toString().replace(/\/$/, '');
}

async function processOne(env: Env, jobId?: string, message?: DispatchMessage) {
  if (!env.API_BASE || !env.ULTIDA_WORKER_SHARED_SECRET) throw new Error('Worker API dispatch is not configured.');
  const response = await fetch(`${resolveCallbackBase(env, message)}/internal/plan-jobs/process`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ultida-worker-secret': env.ULTIDA_WORKER_SHARED_SECRET,
      ...(env.VERCEL_PROTECTION_BYPASS_SECRET
        ? { 'x-vercel-protection-bypass': env.VERCEL_PROTECTION_BYPASS_SECRET }
        : {})
    },
    body: JSON.stringify(jobId
      ? { requestedBy: 'cloudflare-queue', jobId }
      : { requestedBy: 'cloudflare-sweep' })
  });
  if (!response.ok) throw new Error(`Ultida API returned HTTP ${response.status}.`);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    // Keep the Worker root human-readable. Cloudflare's dashboard and a
    // browser visit commonly probe `/`; returning a 404 there made a healthy
    // queue consumer look broken even though `/health` was green.
    if (url.pathname === '/' || url.pathname === '/health') {
      const suppliedSecret = request.headers.get('x-ultida-worker-secret');
      return Response.json({
        success: true,
        service: 'ultida-ai-worker',
        message: 'ULTIDA AI worker is online. Use /health for readiness and POST /dispatch for authenticated jobs.',
        queueConsumer: true,
        // This is intentionally only a boolean. It lets the API prove that the
        // two deployments share a secret without returning any secret material.
        dispatchAuthenticated: await sameSecret(env.ULTIDA_WORKER_SHARED_SECRET, suppliedSecret),
      });
    }
    if (url.pathname === '/dispatch' && request.method === 'POST') {
      const suppliedSecret = request.headers.get('x-ultida-worker-secret');
      if (!await sameSecret(env.ULTIDA_WORKER_SHARED_SECRET, suppliedSecret)) {
        return Response.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 });
      }
      const body = await request.json().then((value) => value as DispatchMessage).catch(() => null);
      if (body?.kind !== 'plan-analysis' || !body.jobId) {
        return Response.json({ success: false, code: 'INVALID_JOB_MESSAGE' }, { status: 400 });
      }
      await env.AI_JOBS.send(body);
      return Response.json({ success: true, queued: true }, { status: 202 });
    }
    return new Response('Not found', { status: 404 });
  },

  async queue(batch: MessageBatch<DispatchMessage>, env: Env) {
    for (const message of batch.messages) {
      try {
        if (message.body?.kind !== 'plan-analysis' || !message.body.jobId) throw new Error('Invalid plan-analysis queue message.');
        await processOne(env, message.body.jobId, message.body);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 10 });
      }
    }
  },

  // Queue messages are the fast path. This tiny scheduled sweep is the
  // durable path: it claims one queued analysis through the authenticated API
  // every minute, covering a missed handoff or a transient queue outage even
  // when the designer has closed the browser.
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    ctx.waitUntil(processOne(env).catch(() => undefined));
  }
};
