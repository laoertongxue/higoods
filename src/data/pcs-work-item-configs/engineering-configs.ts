import { buildBuiltinProjectWorkItemConfigs } from '../pcs-project-domain-contract.ts'

const BUILTIN_CONFIGS = buildBuiltinProjectWorkItemConfigs()

export const engineeringWorkItemConfigs = BUILTIN_CONFIGS.filter((item) =>
  [
    'STYLE_ARCHIVE_CREATE',
    'PROJECT_TRANSFER_PREP',
    'PATTERN_TASK',
    'PATTERN_ARTWORK_TASK',
    'FIRST_SAMPLE',
    'PRE_PRODUCTION_SAMPLE',
    'SAMPLE_RETAIN_REVIEW',
    'SAMPLE_RETURN_HANDLE',
  ].includes(item.workItemTypeCode),
)

