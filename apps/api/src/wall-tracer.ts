import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Resolve the only runtime wall-tracing adapter bundled with the API.
 * The Python file deliberately lives beside the API package, not inside the
 * historical floorplan-analyser workspace, so local, compiled and deployed
 * API processes execute the same implementation.
 */
export function resolveWallTracerPath(): string | null {
  const candidate = fileURLToPath(new URL('../cv/wall_tracer.py', import.meta.url));
  return existsSync(candidate) ? candidate : null;
}
