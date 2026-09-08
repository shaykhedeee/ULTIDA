# Floor-plan vision policy

## Decision

ULTIDA uses a Guided + Auto pipeline. The designer can calibrate and draw
advisory room guides immediately; deterministic tracing and OCR produce
geometry evidence; Cloudflare vision is a bounded semantic verifier. Accepted
`plan.v1` geometry remains the only authority for spaces, layouts, scenes,
drawings and production.

## Provider policy

- Cloudflare is the automatic hosted provider. Its Llama 4 Scout adapter is
  used only for room labels, opening classification, dimension ambiguity and
  topology review after deterministic evidence exists.
- Gemini is an opt-in enrichment provider after a funded health check. It is
  never required for the Guided + Auto route.
- OpenAI is not an automatic plan-analysis or render fallback.
- Cloudflare FLUX.2 is the automatic hosted renderer. LocalAI and ComfyUI are
  optional studio-local providers and require an explicit future selection.

## Evaluated tools

- OpenCV stays in the server-side preprocessing/tracing path. It is suitable
  for line work, morphology, connected components and opening-gap evidence.
- OCR is evidence for labels and printed dimensions; original text and parsed
  millimetres are both retained for review.
- YOLO cannot detect architectural symbols reliably without a licensed,
  representative floor-plan training set. It is not added as a generic model.
- SAM 2 is promptable segmentation, not a measurement or topology engine. It
  may later assist manual region selection, but cannot approve rooms or walls.
- Browser OCR is not the production default because it adds device-dependent
  latency on large plans. It remains a possible offline assist.
- Google Cloud Vision and hosted Hugging Face demos are not added now: they
  introduce another billing/reliability boundary without replacing guided
  tracing and validation.

## Non-negotiable safeguards

- AI proposals are evidence, never silent measured geometry.
- User-drawn guides improve crop coverage; they are not verified rooms.
- Each active analysis has a bounded timeout, progress stage and terminal
  outcome; the browser never owns retries for a running job.
- Final Production requires verified dimensions and wall-attached openings.
