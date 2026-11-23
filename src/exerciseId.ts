/** `custom_front_squat` from "Front squat!"; a numeric suffix keeps ids unique. */
export function customId(name: string, existing: Record<string, unknown>): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = `custom_${slug || 'exercise'}`;
  if (!Object.hasOwn(existing, base)) return base;
  let i = 2;
  while (Object.hasOwn(existing, `${base}_${i}`)) i++;
  return `${base}_${i}`;
}
