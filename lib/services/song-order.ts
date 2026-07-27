export interface OrderedSong {
  id: string;
  created_at: string;
  display_order?: number | null;
}

export function compareSongOrder(
  left: OrderedSong,
  right: OrderedSong
): number {
  const leftOrder = typeof left.display_order === 'number'
    ? left.display_order
    : Number.MAX_SAFE_INTEGER;
  const rightOrder = typeof right.display_order === 'number'
    ? right.display_order
    : Number.MAX_SAFE_INTEGER;
  const orderComparison = leftOrder - rightOrder;
  if (orderComparison !== 0) return orderComparison;

  const createdAtComparison = left.created_at.localeCompare(right.created_at);
  if (createdAtComparison !== 0) return createdAtComparison;
  return left.id.localeCompare(right.id);
}

export function sortSongs<T extends OrderedSong>(songs: readonly T[]): T[] {
  return [...songs].sort(compareSongOrder);
}

export function moveItemById<T extends { id: string }>(
  items: readonly T[],
  itemId: string,
  direction: -1 | 1
): T[] {
  const currentIndex = items.findIndex(item => item.id === itemId);
  const targetIndex = currentIndex + direction;
  if (
    currentIndex < 0
    || targetIndex < 0
    || targetIndex >= items.length
  ) {
    return [...items];
  }

  const reordered = [...items];
  [reordered[currentIndex], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[currentIndex],
  ];
  return reordered;
}

export function applyDenseSongOrder<T extends OrderedSong>(
  songs: readonly T[],
  orderedIds: readonly string[]
): T[] {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return sortSongs(songs.map(song => ({
    ...song,
    display_order: positions.get(song.id) ?? song.display_order ?? null,
  })));
}
