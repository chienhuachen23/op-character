import type { AdminCharacter } from '../../api/adminClient';

export interface CharacterCsvRow {
  name_zh: string;
  name_en: string;
}

const HEADER_PATTERNS = ['name_zh', '中文名', 'chinese', '中文名称'];

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(',').toLowerCase();
  return HEADER_PATTERNS.some((pattern) => joined.includes(pattern.toLowerCase()));
}

export function parseCharacterCsv(text: string): CharacterCsvRow[] {
  const normalized = text.replace(/^\uFEFF/, '').trim();
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows: CharacterCsvRow[] = [];
  let startIndex = 0;
  const firstCells = parseCsvLine(lines[0]);
  if (isHeaderRow(firstCells)) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const name_zh = (cells[0] || '').trim();
    const name_en = (cells[1] || '').trim();
    if (!name_zh && !name_en) continue;
    rows.push({ name_zh, name_en });
  }

  return rows;
}

export function exportCharactersCsv(characters: AdminCharacter[], themeSlug: string): void {
  const header = '中文名,英文名\n';
  const body = characters
    .map((character) => `${escapeCsvCell(character.name_zh)},${escapeCsvCell(character.name_en)}`)
    .join('\n');
  const blob = new Blob([`\uFEFF${header}${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${themeSlug}-characters.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCharacterTemplateCsv(themeSlug: string): void {
  const blob = new Blob(['\uFEFF中文名,英文名\n路飞,Luffy\n'], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${themeSlug}-characters-template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
