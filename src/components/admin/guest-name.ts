export function formatGuestNameWithKana(
  name: string,
  nameKanaOrRoman?: string | null,
): string {
  return `${name}（${nameKanaOrRoman?.trim() || '—'}）`
}
