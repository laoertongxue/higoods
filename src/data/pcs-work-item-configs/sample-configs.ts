import { buildBuiltinProjectWorkItemConfigs } from '../pcs-project-domain-contract.ts'

const BUILTIN_CONFIGS = buildBuiltinProjectWorkItemConfigs()

export const sampleWorkItemConfigs = BUILTIN_CONFIGS.filter((item) =>
  [
    'FEASIBILITY_REVIEW',
    'SAMPLE_SHOOT_FIT',
    'SAMPLE_CONFIRM',
    'SAMPLE_COST_REVIEW',
    'SAMPLE_PRICING',
  ].includes(item.workItemTypeCode),
)

