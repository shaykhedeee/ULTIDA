import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { VisualProposalRequestSchema } from '@ultida/contracts';
import { createProviderGateway } from '@ultida/provider-gateway';

const app = express();
const port = Number(process.env.PORT || 8800);
const gateway = createProviderGateway(process.env);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ success: true, app: 'ultida', version: '0.1.0', providers: gateway.status() });
});

app.get('/api/providers', (_request, response) => response.json({ success: true, providers: gateway.status() }));

app.post('/api/plan/analyze', (request, response) => {
  const { projectId, fileName, mimeType, dataUrl } = request.body ?? {};
  if (typeof projectId !== 'string' || typeof fileName !== 'string' || typeof mimeType !== 'string' || typeof dataUrl !== 'string') {
    return response.status(400).json({ success: false, code: 'INVALID_PLAN_UPLOAD', message: 'A project, file name, MIME type and file payload are required.' });
  }
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match || !['image/png', 'image/jpeg', 'application/pdf'].includes(mimeType)) {
    return response.status(400).json({ success: false, code: 'UNSUPPORTED_PLAN', message: 'Upload a PNG, JPEG or PDF floor plan.' });
  }
  const bytes = Buffer.byteLength(match[2], 'base64');
  if (bytes > 25 * 1024 * 1024) return response.status(413).json({ success: false, code: 'PLAN_TOO_LARGE', message: 'Floor plans must be smaller than 25 MB.' });
  return response.status(202).json({ success: true, analysis: { projectId, fileName, mimeType, bytes, status: 'review_required', confidence: 0, walls: [], rooms: [], openings: [], dimensions: [], message: 'Plan received. Calibrate one known wall, then run geometry detection.' } });
});

app.post('/api/visual-proposals', async (request, response) => {
  const parsed = VisualProposalRequestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, code: 'INVALID_REQUEST', issues: parsed.error.issues });
  const result = await gateway.createVisualProposal(parsed.data);
  return response.status(result.status === 'unavailable' ? 503 : 202).json({ success: result.status !== 'unavailable', result });
});

app.use((_request, response) => response.status(404).json({ success: false, code: 'NOT_FOUND' }));

app.listen(port, '127.0.0.1', () => console.log(`ULTIDA API http://127.0.0.1:${port}`));
