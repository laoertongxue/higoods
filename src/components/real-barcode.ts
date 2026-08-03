import { escapeHtml } from '../utils.ts'

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
] as const

function encodeCode128B(value: string): number[] {
  const codes = Array.from(value).map((character) => {
    const code = character.charCodeAt(0) - 32
    if (code < 0 || code > 94) throw new Error('Code 128 条码只支持标准英文、数字和符号。')
    return code
  })
  const checksum = (104 + codes.reduce((total, code, index) => total + code * (index + 1), 0)) % 103
  return [104, ...codes, checksum, 106]
}

export function renderCode128Barcode(value: string, label = '库位条码'): string {
  const normalized = value.trim()
  if (!normalized) return ''
  const patterns = encodeCode128B(normalized).map((code) => CODE128_PATTERNS[code])
  const quietZone = 10
  const moduleCount = patterns.reduce((total, pattern) => total + Array.from(pattern).reduce((sum, width) => sum + Number(width), 0), quietZone * 2)
  let cursor = quietZone
  const bars: string[] = []
  patterns.forEach((pattern) => {
    Array.from(pattern).forEach((widthText, index) => {
      const width = Number(widthText)
      if (index % 2 === 0) bars.push(`<rect x="${cursor}" y="0" width="${width}" height="56" fill="currentColor" />`)
      cursor += width
    })
  })
  return `<svg viewBox="0 0 ${moduleCount} 56" role="img" aria-label="${escapeHtml(label)}" preserveAspectRatio="none" class="h-14 w-full text-black" data-real-barcode data-barcode-value="${escapeHtml(normalized)}">${bars.join('')}</svg>`
}
