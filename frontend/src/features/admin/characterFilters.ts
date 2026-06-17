import type { AdminCharacter } from '../../api/adminClient';

export function characterHasImage(character: AdminCharacter): boolean {
  const url = character.image_url?.trim() ?? '';
  if (!url) return false;
  if (url.startsWith('/characters/one_piece/')) return false;
  return true;
}

export function matchesCharacterSearch(character: AdminCharacter, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    character.name_zh.toLowerCase().includes(q) ||
    character.name_en.toLowerCase().includes(q)
  );
}

export function filterCharacters(
  characters: AdminCharacter[],
  options: {
    searchQuery: string;
    onlyNoImage: boolean;
    onlyInactive: boolean;
  }
): AdminCharacter[] {
  return characters.filter((character) => {
    if (!matchesCharacterSearch(character, options.searchQuery)) return false;
    if (options.onlyNoImage && characterHasImage(character)) return false;
    if (options.onlyInactive && character.is_active) return false;
    return true;
  });
}
