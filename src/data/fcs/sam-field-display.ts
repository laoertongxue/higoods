import type { SamCurrentFieldKey, SamFactoryFieldKey } from './process-craft-dict.ts'

export interface SamBusinessFieldDisplayDefinition {
  key: SamFactoryFieldKey
  label: string
  description: string
}

export const SAM_BUSINESS_FIELD_DISPLAY_DICT: Record<SamFactoryFieldKey, SamBusinessFieldDisplayDefinition> = {
  deviceCount: {
    key: 'deviceCount',
    label: '设备数量',
    description: '用于记录该工艺可投入的有效设备台数，是设备侧日能力的基础。',
  },
  deviceShiftMinutes: {
    key: 'deviceShiftMinutes',
    label: '单台默认日有效分钟',
    description: '用于记录单台设备默认一天真正可用于生产的有效分钟数，用来计算设备侧日能力。',
  },
  deviceEfficiencyValue: {
    key: 'deviceEfficiencyValue',
    label: '设备标准效率值',
    description: '用于记录设备在标准状态下的有效产出效率数值，用来计算设备侧日能力。',
  },
  deviceEfficiencyUnit: {
    key: 'deviceEfficiencyUnit',
    label: '设备效率单位',
    description: '用于说明设备标准效率值的业务口径，例如件/小时、米/分钟。',
  },
  staffCount: {
    key: 'staffCount',
    label: '人数',
    description: '用于记录该工艺可投入的标准人数，是人员侧日能力的基础。',
  },
  staffShiftMinutes: {
    key: 'staffShiftMinutes',
    label: '单人默认日有效分钟',
    description: '用于记录单人默认一天真正可用于生产的有效分钟数，用来计算人员侧日能力。',
  },
  staffEfficiencyValue: {
    key: 'staffEfficiencyValue',
    label: '人员标准效率值',
    description: '用于记录人员在标准状态下的有效产出效率数值，用来计算人员侧日能力。',
  },
  staffEfficiencyUnit: {
    key: 'staffEfficiencyUnit',
    label: '人员效率单位',
    description: '用于说明人员标准效率值的业务口径，帮助业务统一理解人工效率。',
  },
  setupMinutes: {
    key: 'setupMinutes',
    label: '固定准备分钟',
    description: '用于记录开机、上料、开版等固定准备时间，会占用当天真实可供给能力。',
  },
  switchMinutes: {
    key: 'switchMinutes',
    label: '切换准备分钟',
    description: '用于记录换款、换色、换模等切换时间，会占用当天真实可供给能力。',
  },
  efficiencyFactor: {
    key: 'efficiencyFactor',
    label: '工厂效率系数',
    description: '用于修正理论结果和这家工厂实际可兑现能力之间的偏差。',
  },
  batchLoadCapacity: {
    key: 'batchLoadCapacity',
    label: '单次有效装载量',
    description: '用于记录批次型工艺每次循环可以承载的有效装载量，是设备侧日能力的重要参数。',
  },
  batchLoadUnit: {
    key: 'batchLoadUnit',
    label: '装载量单位',
    description: '用于说明单次有效装载量的业务口径，例如公斤/批、卷/批。',
  },
  cycleMinutes: {
    key: 'cycleMinutes',
    label: '单次循环分钟',
    description: '用于记录一个完整循环通常需要多少分钟，用来计算单台默认日可运行批数。',
  },
}

export function getSamBusinessFieldLabel(key: SamFactoryFieldKey | SamCurrentFieldKey): string {
  return SAM_BUSINESS_FIELD_DISPLAY_DICT[key].label
}

export function getSamBusinessFieldDescription(key: SamFactoryFieldKey | SamCurrentFieldKey): string {
  return SAM_BUSINESS_FIELD_DISPLAY_DICT[key].description
}
