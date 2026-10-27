/**
 * Serializes concurrent or rapid autosave/explicit save operations per room ID
 * so out-of-order network responses cannot overwrite newer room state or trigger
 * spurious 409 conflicts.
 */
const queuesByRoom = new Map<string, Promise<unknown>>();

export function enqueueRoomSave<T>(roomId: string, task: () => Promise<T>): Promise<T> {
  const key = roomId.trim() || 'default-room';
  const previous = queuesByRoom.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => task())
    .finally(() => {
      if (queuesByRoom.get(key) === next) {
        queuesByRoom.delete(key);
      }
    });
  queuesByRoom.set(key, next);
  return next;
}
