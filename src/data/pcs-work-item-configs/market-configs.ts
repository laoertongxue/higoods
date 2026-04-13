import { buildBuiltinProjectWorkItemConfigs } from '../pcs-project-domain-contract.ts'

const BUILTIN_CONFIGS = buildBuiltinProjectWorkItemConfigs()

export const marketWorkItemConfigs = BUILTIN_CONFIGS.filter((item) =>
  [
    'CHANNEL_PRODUCT_LISTING',
    'VIDEO_TEST',
    'LIVE_TEST',
    'TEST_DATA_SUMMARY',
    'TEST_CONCLUSION',
  ].includes(item.workItemTypeCode),
)

