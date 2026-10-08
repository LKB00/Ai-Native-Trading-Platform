/** Where the thread was scrolled, kept across remounts (switching Agent/Terminal views) and reset when another conversation opens. */
export const saved: { pinned: boolean; top: number | null } = { pinned: true, top: null }
export const resetScroll = () => { saved.pinned = true; saved.top = null }
