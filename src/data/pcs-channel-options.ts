export const PCS_CHANNEL_OPTIONS = [
  { code: 'tiktok', name: 'TikTok' },
  { code: 'shopee', name: '虾皮' },
  { code: 'independent-site', name: '独立站' },
] as const

export type PcsChannelCode = (typeof PCS_CHANNEL_OPTIONS)[number]['code']

export const DEFAULT_PCS_CHANNEL_CODE: PcsChannelCode = 'tiktok'

const PCS_CHANNEL_NAME_MAP: Record<PcsChannelCode, string> = Object.fromEntries(
  PCS_CHANNEL_OPTIONS.map((item) => [item.code, item.name]),
) as Record<PcsChannelCode, string>

export function isPcsChannelCode(value: string | null | undefined): value is PcsChannelCode {
  return PCS_CHANNEL_OPTIONS.some((item) => item.code === value)
}

export function normalizePcsChannelCode(value: string | null | undefined): PcsChannelCode | '' {
  const rawValue = String(value || '').trim()
  const normalized = rawValue.toLowerCase()
  if (!normalized) return ''
  if (normalized.includes('tiktok')) return 'tiktok'
  if (normalized.includes('shopee') || rawValue.includes('虾皮')) return 'shopee'
  if (normalized.includes('independent') || rawValue.includes('独立')) return 'independent-site'
  return ''
}

export function normalizePcsChannelCodes(values: string[] | null | undefined): PcsChannelCode[] {
  const result: PcsChannelCode[] = []
  ;(values || []).forEach((value) => {
    const channelCode = normalizePcsChannelCode(value)
    if (channelCode && !result.includes(channelCode)) result.push(channelCode)
  })
  return result
}

export function getPcsChannelNameByCode(channelCode: string | null | undefined): string {
  const normalized = normalizePcsChannelCode(channelCode)
  return normalized ? PCS_CHANNEL_NAME_MAP[normalized] : ''
}

export function getPcsChannelNamesByCodes(channelCodes: string[] | null | undefined): string[] {
  return normalizePcsChannelCodes(channelCodes).map((channelCode) => PCS_CHANNEL_NAME_MAP[channelCode])
}
