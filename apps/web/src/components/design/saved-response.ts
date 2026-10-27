/** A resolved fetch is not a saved mutation: require both transport and API acknowledgement. */
export async function requireSavedResponse(response: Response): Promise<void> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.message || `Save was not confirmed (HTTP ${response.status}).`);
  }
}
