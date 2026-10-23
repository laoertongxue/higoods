/** Length conversion is a read projection; saved quantity and unit stay on their original fact. */
export function convertCuttingQuantity(value: number, from: string, to: string): number | null {
  if (!Number.isFinite(value)) return null
  const key = (unit: string) => {
    const normalized = unit.trim().toLowerCase()
    if (['yard', 'yards', 'yd', '码'].includes(normalized)) return 'yard'
    if (['m', 'meter', 'meters', '米'].includes(normalized)) return 'metre'
    return normalized
  }
  const source = key(from), target = key(to)
  if (!source || !target) return null
  if (source === target) return value
  if (source === 'yard' && target === 'metre') return value * 0.9144
  if (source === 'metre' && target === 'yard') return value / 0.9144
  return null
}
