interface Env {
  API_BASE: string;
  ULTIDA_WORKER_SHARED_SECRET: string;
  VERCEL_PROTECTION_BYPASS_SECRET?: string;
  AI_JOBS: {
    send(message: JobMessage): Promise<void>;
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

async function processOne(env: Env, jobId: string) {
  if (!env.API_BASE || !env.ULTIDA_WORKER_SHARED_SECRET) throw new Error('Worker API dispatch is not configured.');
  const response = await fetch(`${env.API_BASE.replace(/\/$/, '')}/internal/plan-jobs/process`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ultida-worker-secret': env.ULTIDA_WORKER_SHARED_SECRET,
      ...(env.VERCEL_PROTECTION_BYPASS_SECRET
        ? { 'x-vercel-protection-bypass': env.VERCEL_PROTECTION_BYPASS_SECRET }
        : {})
    },
    body: JSON.stringify({ requestedBy: 'cloudflare-queue', jobId })
  });
  if (!response.ok) throw new Error(`Ultida API returned HTTP ${response.status}.`);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      const suppliedSecret = request.headers.get('x-ultida-worker-secret');
      return Response.json({
        success: true,
        service: 'ultida-ai-worker',
        queueConsumer: true,
        // This is intentionally only a boolean. It lets the API prove that the
        // two deployments share a secret without returning any secret material.
        dispatchAuthenticated: Boolean(env.ULTIDA_WORKER_SHARED_SECRET && suppliedSecret === env.ULTIDA_WORKER_SHARED_SECRET),
      });
    }
    if (url.pathname === '/dispatch' && request.method === 'POST') {
      const suppliedSecret = request.headers.get('x-ultida-worker-secret');
      if (!env.ULTIDA_WORKER_SHARED_SECRET || suppliedSecret !== env.ULTIDA_WORKER_SHARED_SECRET) {
        return Response.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 });
      }
      const body = await request.json().then((value) => value as JobMessage).catch(() => null);
      if (body?.kind !== 'plan-analysis' || !body.jobId) {
        return Response.json({ success: false, code: 'INVALID_JOB_MESSAGE' }, { status: 400 });
      }
      await env.AI_JOBS.send(body);
      return Response.json({ success: true, queued: true }, { status: 202 });
    }
    return new Response('Not found', { status: 404 });
  },

  async queue(batch: MessageBatch<JobMessage>, env: Env) {
    for (const message of batch.messages) {
      try {
        if (message.body?.kind !== 'plan-analysis' || !message.body.jobId) throw new Error('Invalid plan-analysis queue message.');
        await processOne(env, message.body.jobId);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 10 });
      }
    }
  }
};
