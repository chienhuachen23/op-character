import type { AdminCharacter } from '../../api/adminClient';

const SEED_IMAGE_PREFIX = '/characters/one_piece/';

function isUsableImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(SEED_IMAGE_PREFIX)) return false;
  return true;
}

export function characterHasImage(character: AdminCharacter): boolean {
  if (character.images?.some((image) => isUsableImageUrl(image.image_url))) {
    return true;
  }
  return isUsableImageUrl(character.image_url ?? '');
}

export function characterCoverImageUrl(character: AdminCharacter): string | undefined {
  const usable = (character.images ?? []).filter((image) => isUsableImageUrl(image.image_url));
  if (usable.length > 0) {
    return usable[usable.length - 1].image_url;
  }
  const legacy = character.image_url?.trim() ?? '';
  return legacy || undefined;
}

export function usableCharacterImages(character: AdminCharacter) {
  return (character.images ?? []).filter((image) => isUsableImageUrl(image.image_url));
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
