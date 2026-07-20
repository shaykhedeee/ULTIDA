import { PlanProposalSchema } from '@ultida/plan-core';

type Environment = Record<string, string | undefined>;
type Input = { dataUrl: string; fileName: string; mimeType: string };
const prompt = `Analyze this interior floor plan image. Return JSON only in this shape: {"proposals":[{"kind":"wall|opening|room|dimension","confidence":0.0,"geometry":{},"note":""}]}. Use pixel coordinates from the supplied image for x/y values. For walls use x1,y1,x2,y2. For rooms use x,y,width,height. For openings use x,y,width,kind where kind is 0 for door and 1 for window. For dimensions use x1,y1,x2,y2,valueMm only when a written dimension is legible. Do not invent dimensions. Set confidence below 0.7 when uncertain. Every proposal requires designer review and must never be treated as approved geometry.`;

function parseProposals(raw: string) {
  const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()) as { proposals?: unknown[] };
  const proposals = (parsed.proposals ?? []).map((item, index) => { const value = item as { kind?: unknown; confidence?: unknown; geometry?: unknown; note?: unknown }; return { id: crypto.randomUUID(), kind: value.kind, confidence: value.confidence, source: 'ocr' as const, status: 'needs_review' as const, geometry: value.geometry, note: typeof value.note === 'string' ? value.note : `Provider proposal ${index + 1} requires review.` }; });
  const result = PlanProposalSchema.array().safeParse(proposals);
  if (!result.success) throw new Error('Plan analyzer returned an invalid proposal shape.');
  return result.data;
}

async function analyzeOpenAi(environment: Environment, input: Input) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${environment.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: environment.OPENAI_VISION_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt }, { role: 'user', content: [{ type: 'text', text: `Floor plan file: ${input.fileName}` }, { type: 'image_url', image_url: { url: input.dataUrl } }] }] }) });
  if (!response.ok) throw new Error(`OpenAI plan analyzer failed with status ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI plan analyzer returned no proposal content.');
  return parseProposals(content);
}

async function analyzeGemini(environment: Environment, input: Input) {
  const model = environment.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(environment.GEMINI_API_KEY ?? '')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generationConfig: { temperature: 0, responseMimeType: 'application/json' }, contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: input.mimeType, data: input.dataUrl.split(',')[1] } }] }] }) });
  if (!response.ok) throw new Error(`Gemini plan analyzer failed with status ${response.status}.`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!content) throw new Error('Gemini plan analyzer returned no proposal content.');
  return parseProposals(content);
}

export async function analyzePlanWithProvider(environment: Environment, input: Input) {
  if (environment.OPENAI_API_KEY) return { provider: 'openai', proposals: await analyzeOpenAi(environment, input) };
  if (environment.GEMINI_API_KEY) return { provider: 'gemini', proposals: await analyzeGemini(environment, input) };
  return null;
}
