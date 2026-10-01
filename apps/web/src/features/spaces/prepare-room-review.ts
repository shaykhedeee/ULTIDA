/** Navigation is allowed only after every persisted room-to-scene step succeeds. */
export async function prepareRoomReview<T>(steps: { save(): Promise<T | null>; approve(room: T): Promise<boolean>; compile(room: T): Promise<string | void> }): Promise<string | null> {
  const room = await steps.save();
  if (!room || !await steps.approve(room)) return null;
  return await steps.compile(room) || null;
}
