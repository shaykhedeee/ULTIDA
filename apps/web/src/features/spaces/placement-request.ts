type Store = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const prefix='ultida.pending-placement.v1:';
/** Keep the request UUID until the server confirms success, including across reloads. */
export function placementRequestId(storage: Store, fingerprint: string): string {
 const key=prefix+fingerprint;
 const prior=storage.getItem(key);
 if (prior && /^[0-9a-f-]{36}$/i.test(prior)) return prior;
 const id=crypto.randomUUID();storage.setItem(key,id);return id;
}
export function completePlacementRequest(storage: Store, fingerprint: string) {storage.removeItem(prefix+fingerprint);}
