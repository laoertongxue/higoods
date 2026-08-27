export const POST_STAGE_CODE = 'POST' as const
export const POST_STAGE_NAME = '后道阶段' as const

export type PostStageProcessCode = 'BUTTONHOLE' | 'BUTTON_ATTACH' | 'IRON_PACK'
export type PostStageFlowNodeCode = 'ARRIVAL_CONFIRM' | 'QC' | 'RECHECK' | 'HANDOVER'

export const POST_STAGE_PROCESSES: Array<{ code: PostStageProcessCode; name: string }> = [
  { code: 'BUTTONHOLE', name: '开扣眼' },
  { code: 'BUTTON_ATTACH', name: '装扣子' },
  { code: 'IRON_PACK', name: '烫包' },
]

export const POST_STAGE_FLOW_NODES: Array<{ code: PostStageFlowNodeCode; name: string }> = [
  { code: 'ARRIVAL_CONFIRM', name: '到货确认' },
  { code: 'QC', name: '质检' },
  { code: 'RECHECK', name: '复检' },
  { code: 'HANDOVER', name: '后续交接' },
]

export function normalizePostStageProcessCode(code: string): PostStageProcessCode | null {
  const normalized = code.trim().toUpperCase()
  if (normalized === 'BUTTONHOLE') return 'BUTTONHOLE'
  if (normalized === 'BUTTON_ATTACH') return 'BUTTON_ATTACH'
  if (normalized === 'IRON_PACK') return 'IRON_PACK'
  return null
}

export function isPostStageFlowNode(value: string): boolean {
  return POST_STAGE_FLOW_NODES.some((item) => item.code === value)
}
