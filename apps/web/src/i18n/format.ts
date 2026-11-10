/**
 * A route's average as people write it: "7,8" in Spanish, "7.8" in English.
 * Always one decimal, so "8" reads "8,0" and cards line up.
 */
export function formatAverage(value: number, language: string): string {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
