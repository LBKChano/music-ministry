export const ROLE_SYMBOL_KEYS = [
  'microphone',
  'keyboard',
  'guitar',
  'drums',
  'music',
  'reading',
  'presentation',
  'sound',
  'camera',
  'hospitality',
  'person',
] as const;

export type RoleSymbolKey = typeof ROLE_SYMBOL_KEYS[number];

export interface RoleSymbolDescriptor {
  key: RoleSymbolKey | null;
  label: string;
  iosIcon: string;
  androidIcon:
    | 'mic'
    | 'piano'
    | 'music-note'
    | 'album'
    | 'menu-book'
    | 'present-to-all'
    | 'volume-up'
    | 'camera-alt'
    | 'groups'
    | 'person';
}

export const ROLE_SYMBOL_OPTIONS: readonly RoleSymbolDescriptor[] = [
  { key: null, label: 'General', iosIcon: 'person.fill', androidIcon: 'person' },
  { key: 'microphone', label: 'Microphone', iosIcon: 'mic.fill', androidIcon: 'mic' },
  { key: 'keyboard', label: 'Keyboard', iosIcon: 'pianokeys', androidIcon: 'piano' },
  { key: 'guitar', label: 'Guitar', iosIcon: 'guitars', androidIcon: 'music-note' },
  { key: 'drums', label: 'Drums', iosIcon: 'drum.fill', androidIcon: 'album' },
  { key: 'music', label: 'Music', iosIcon: 'music.note', androidIcon: 'music-note' },
  { key: 'reading', label: 'Reading', iosIcon: 'book.closed.fill', androidIcon: 'menu-book' },
  { key: 'presentation', label: 'Presentation', iosIcon: 'rectangle.on.rectangle', androidIcon: 'present-to-all' },
  { key: 'sound', label: 'Sound', iosIcon: 'speaker.wave.3.fill', androidIcon: 'volume-up' },
  { key: 'camera', label: 'Camera', iosIcon: 'camera.fill', androidIcon: 'camera-alt' },
  { key: 'hospitality', label: 'Hospitality', iosIcon: 'person.2.fill', androidIcon: 'groups' },
  { key: 'person', label: 'Person', iosIcon: 'person.fill', androidIcon: 'person' },
] as const;

const roleSymbolByKey = new Map(
  ROLE_SYMBOL_OPTIONS
    .filter((option): option is RoleSymbolDescriptor & { key: RoleSymbolKey } => option.key !== null)
    .map(option => [option.key, option]),
);

export function normalizeRoleSymbolKey(value: unknown): RoleSymbolKey | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLocaleLowerCase();
  return ROLE_SYMBOL_KEYS.includes(normalized as RoleSymbolKey)
    ? normalized as RoleSymbolKey
    : null;
}

export function resolveRoleSymbol(value: unknown): RoleSymbolDescriptor {
  const key = normalizeRoleSymbolKey(value);
  return key ? roleSymbolByKey.get(key) ?? ROLE_SYMBOL_OPTIONS[0] : ROLE_SYMBOL_OPTIONS[0];
}

export function normalizeRoleName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function resolveRoleSymbolForName(
  roles: readonly { name: string; icon_key?: string | null }[],
  roleName: string,
): RoleSymbolDescriptor {
  const normalizedRoleName = normalizeRoleName(roleName);
  const role = roles.find(candidate => normalizeRoleName(candidate.name) === normalizedRoleName);
  return resolveRoleSymbol(role?.icon_key);
}
