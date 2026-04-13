import { buildBuiltinProjectWorkItemConfigs } from '../pcs-project-domain-contract.ts'

const BUILTIN_CONFIGS = buildBuiltinProjectWorkItemConfigs()

export const projectWorkItemConfigs = BUILTIN_CONFIGS.filter((item) =>
  ['PROJECT_INIT', 'SAMPLE_ACQUIRE', 'SAMPLE_INBOUND_CHECK'].includes(item.workItemTypeCode),
)

