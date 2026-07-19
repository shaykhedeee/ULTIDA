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

app.post('/api/visual-proposals', async (request, response) => {
  const parsed = VisualProposalRequestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, code: 'INVALID_REQUEST', issues: parsed.error.issues });
  const result = await gateway.createVisualProposal(parsed.data);
  return response.status(result.status === 'unavailable' ? 503 : 202).json({ success: result.status !== 'unavailable', result });
});

app.use((_request, response) => response.status(404).json({ success: false, code: 'NOT_FOUND' }));

app.listen(port, '127.0.0.1', () => console.log(`ULTIDA API http://127.0.0.1:${port}`));
