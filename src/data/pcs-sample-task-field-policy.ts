import type { FirstSampleTaskRecord } from './pcs-first-sample-types.ts'

export type FirstSampleNodeEntryFieldKey =
  | 'sourceTechPackVersionId'
  | 'factoryId'
  | 'targetSite'
  | 'sampleMaterialMode'
  | 'samplePurpose'

export type FirstSampleCompletionFieldKey =
  | 'sampleCode'
  | 'sampleImageIds'
  | 'fitConfirmationSummary'
  | 'productionReadinessNote'
  | 'confirmedAt'

export const FIRST_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS: Array<{
  fieldKey: FirstSampleNodeEntryFieldKey
  label: string
}> = [
  { fieldKey: 'sourceTechPackVersionId', label: '来源技术包版本' },
  { fieldKey: 'factoryId', label: '工厂' },
  { fieldKey: 'targetSite', label: '打样区域' },
  { fieldKey: 'sampleMaterialMode', label: '样衣材质模式' },
  { fieldKey: 'samplePurpose', label: '样衣用途' },
]

export const FIRST_SAMPLE_COMPLETION_REQUIRED_FIELDS: Array<{
  fieldKey: FirstSampleCompletionFieldKey
  label: string
}> = [
  { fieldKey: 'sampleCode', label: '结果编号' },
  { fieldKey: 'sampleImageIds', label: '样衣图片' },
  { fieldKey: 'fitConfirmationSummary', label: '版型确认说明' },
  { fieldKey: 'productionReadinessNote', label: '生产准备说明' },
  { fieldKey: 'confirmedAt', label: '确认时间' },
]

export const FIRST_SAMPLE_PROJECT_META_FIELD_KEYS = [
  'sourceTaskType',
  'sourceTaskId',
  'sourceTaskCode',
  'sourceTechPackVersionId',
  'sourceTechPackVersionCode',
  'sourceTechPackVersionLabel',
  'factoryId',
  'factoryName',
  'targetSite',
  'sampleMaterialMode',
  'samplePurpose',
  'sampleCode',
  'sampleImageIds',
  'fitConfirmationSummary',
  'artworkConfirmationSummary',
  'productionReadinessNote',
  'reuseAsFirstOrderBasisFlag',
  'reuseAsFirstOrderBasisConfirmedAt',
  'reuseAsFirstOrderBasisConfirmedBy',
  'reuseAsFirstOrderBasisNote',
  'confirmedAt',
  'sourceType',
  'upstreamModule',
  'upstreamObjectType',
  'upstreamObjectId',
  'upstreamObjectCode',
  'status',
] as const

export type FirstSampleProjectMetaFieldKey = (typeof FIRST_SAMPLE_PROJECT_META_FIELD_KEYS)[number]

function isBlankValue(value: unknown): boolean {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  return String(value).trim() === ''
}

export function getFirstSampleNodeEntryMissingFields(
  input: Partial<Record<FirstSampleNodeEntryFieldKey, unknown>>,
): string[] {
  return FIRST_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS
    .filter((field) => isBlankValue(input[field.fieldKey]))
    .map((field) => field.label)
}

export function getFirstSampleCompletionMissingFields(task: Partial<FirstSampleTaskRecord>): string[] {
  return FIRST_SAMPLE_COMPLETION_REQUIRED_FIELDS
    .filter((field) => isBlankValue(task[field.fieldKey]))
    .map((field) => field.label)
}

export function isFirstSampleCompletedStatus(status: string | null | undefined): boolean {
  return status === '已通过'
}

export function getFirstSampleTaskFieldPolicySummary(): {
  nodeEntryRequiredFields: typeof FIRST_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS
  completionRequiredFields: typeof FIRST_SAMPLE_COMPLETION_REQUIRED_FIELDS
} {
  return {
    nodeEntryRequiredFields: FIRST_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS,
    completionRequiredFields: FIRST_SAMPLE_COMPLETION_REQUIRED_FIELDS,
  }
}
