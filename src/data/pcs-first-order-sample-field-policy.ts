import type { FirstOrderSampleTaskRecord, FirstOrderSampleTaskStatus } from './pcs-first-order-sample-types.ts'

export const FIRST_ORDER_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS: Array<{
  fieldKey: keyof Pick<
    FirstOrderSampleTaskRecord,
    | 'sourceFirstSampleTaskId'
    | 'sourceTechPackVersionId'
    | 'factoryId'
    | 'targetSite'
    | 'sampleChainMode'
    | 'specialSceneReasonCodes'
    | 'productionReferenceRequiredFlag'
    | 'chinaReviewRequiredFlag'
    | 'correctFabricRequiredFlag'
  >
  label: string
  conditional?: true
}> = [
  { fieldKey: 'sourceFirstSampleTaskId', label: '来源首版样衣任务' },
  { fieldKey: 'sourceTechPackVersionId', label: '来源技术包版本' },
  { fieldKey: 'factoryId', label: '工厂' },
  { fieldKey: 'targetSite', label: '打样区域' },
  { fieldKey: 'sampleChainMode', label: '首单确认方式' },
  { fieldKey: 'specialSceneReasonCodes', label: '特殊场景原因', conditional: true },
]

export const FIRST_ORDER_SAMPLE_COMPLETION_REQUIRED_FIELDS: Array<{
  fieldKey: keyof Pick<
    FirstOrderSampleTaskRecord,
    | 'samplePlanLines'
    | 'finalReferenceNote'
    | 'sampleCode'
    | 'conclusionResult'
    | 'conclusionNote'
    | 'confirmedAt'
    | 'confirmedBy'
  >
  label: string
}> = [
  { fieldKey: 'samplePlanLines', label: '样衣计划行' },
  { fieldKey: 'finalReferenceNote', label: '最终参照说明' },
  { fieldKey: 'sampleCode', label: '结果编号' },
  { fieldKey: 'conclusionResult', label: '确认结果' },
  { fieldKey: 'conclusionNote', label: '确认说明' },
  { fieldKey: 'confirmedAt', label: '首单确认时间' },
  { fieldKey: 'confirmedBy', label: '首单确认人' },
]

export const FIRST_ORDER_SAMPLE_PROJECT_META_FIELD_KEYS = [
  'sourceFirstSampleTaskId',
  'sourceFirstSampleTaskCode',
  'sourceFirstSampleCode',
  'sourceTechPackVersionId',
  'sourceTechPackVersionCode',
  'sourceTechPackVersionLabel',
  'factoryId',
  'factoryName',
  'targetSite',
  'sampleChainMode',
  'specialSceneReasonCodes',
  'specialSceneReasonText',
  'productionReferenceRequiredFlag',
  'chinaReviewRequiredFlag',
  'correctFabricRequiredFlag',
  'samplePlanLines',
  'finalReferenceNote',
  'patternVersion',
  'artworkVersion',
  'sampleCode',
  'conclusionResult',
  'conclusionNote',
  'confirmedAt',
  'confirmedBy',
  'sourceType',
  'upstreamModule',
  'upstreamObjectType',
  'upstreamObjectId',
  'upstreamObjectCode',
  'status',
] as const

export function isFirstOrderSamplePassedStatus(status: FirstOrderSampleTaskStatus | string | undefined): boolean {
  return status === '已通过'
}

export function getFirstOrderSampleNodeEntryMissingFields(
  input: Partial<Pick<
    FirstOrderSampleTaskRecord,
    | 'sourceFirstSampleTaskId'
    | 'sourceTechPackVersionId'
    | 'factoryId'
    | 'targetSite'
    | 'sampleChainMode'
    | 'specialSceneReasonCodes'
  >>,
): string[] {
  return FIRST_ORDER_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS
    .filter((item) => {
      if (item.fieldKey === 'specialSceneReasonCodes') {
        return input.sampleChainMode !== '复用首版结论' && (!Array.isArray(input.specialSceneReasonCodes) || input.specialSceneReasonCodes.length === 0)
      }
      const value = input[item.fieldKey]
      return value === undefined || value === null || String(value).trim() === ''
    })
    .map((item) => item.label)
}

export function getFirstOrderSampleCompletionMissingFields(task: Partial<FirstOrderSampleTaskRecord>): string[] {
  return FIRST_ORDER_SAMPLE_COMPLETION_REQUIRED_FIELDS
    .filter((item) => {
      const value = task[item.fieldKey]
      if (item.fieldKey === 'samplePlanLines') return !Array.isArray(value) || value.length === 0
      if (item.fieldKey === 'conclusionResult') return value !== '通过'
      return value === undefined || value === null || String(value).trim() === ''
    })
    .map((item) => item.label)
}

export function getFirstOrderSampleTaskFieldPolicySummary(): {
  nodeEntryRequiredFields: typeof FIRST_ORDER_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS
  completionRequiredFields: typeof FIRST_ORDER_SAMPLE_COMPLETION_REQUIRED_FIELDS
} {
  return {
    nodeEntryRequiredFields: FIRST_ORDER_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS,
    completionRequiredFields: FIRST_ORDER_SAMPLE_COMPLETION_REQUIRED_FIELDS,
  }
}
