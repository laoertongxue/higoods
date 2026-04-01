export const CAPACITY_TIGHT_THRESHOLD_RATIO = 0.2
export const CAPACITY_OVERLOAD_REMAINING_THRESHOLD = 0
export const CAPACITY_STANDARD_TIME_LABEL = '标准工时'
export const CAPACITY_NO_REPLAY_SAM_NOTE = '当前整个 FCS 不存在复盘工时 SAM，当前只基于标准工时、已占用、已冻结和时间窗口做判断。'
export const CAPACITY_DATE_INCOMPLETE_NOTE = '日期不足时仅提示无法准确判断，不做硬拦截，需求继续保留在待分配或未排期池中。'

export interface CapacityRuleLine {
  label: string
  description: string
}

export interface CapacityRuleSection {
  key: 'SUPPLY_DEMAND' | 'DATE_LANDING' | 'RESULT_CALCULATION'
  title: string
  lines: CapacityRuleLine[]
}

export interface CapacityThresholdRule {
  label: string
  description: string
}

export function calculateCapacityRemainingStandardHours(input: {
  supplyStandardHours: number
  committedStandardHours: number
  frozenStandardHours: number
}): number {
  return roundCapacityRuleValue(
    input.supplyStandardHours - input.committedStandardHours - input.frozenStandardHours,
  )
}

export function isCapacityTight(input: {
  supplyStandardHours: number
  remainingStandardHours: number
}): boolean {
  if (input.supplyStandardHours <= 0) return false
  if (input.remainingStandardHours < CAPACITY_OVERLOAD_REMAINING_THRESHOLD) return false
  return input.remainingStandardHours / input.supplyStandardHours < CAPACITY_TIGHT_THRESHOLD_RATIO
}

export function roundCapacityRuleValue(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function formatCapacityThresholdPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export const CAPACITY_RULE_SECTIONS: CapacityRuleSection[] = [
  {
    key: 'SUPPLY_DEMAND',
    title: '供给与需求口径',
    lines: [
      {
        label: '供给来源',
        description: '默认日可供给标准工时来源于产能档案当前已维护字段的自动计算结果。',
      },
      {
        label: '需求来源',
        description: '任务总标准工时来源于技术包工序项基线落到任务对象后的结果，不额外引入复盘工时。',
      },
      {
        label: '冻结 / 占用说明',
        description: '已冻结表示待确认但已预留的标准工时，已占用表示已确认进入工厂执行的标准工时。',
      },
    ],
  },
  {
    key: 'DATE_LANDING',
    title: '日期落点规则',
    lines: [
      {
        label: '有开始与结束窗口',
        description: '按时间窗口覆盖的自然日逐天落到日历中，窗口内每天共享同一条标准工时对象。',
      },
      {
        label: '只有单日期',
        description: '只有单个有效日期时，需求直接落到该单天，不额外展开成多日窗口。',
      },
      {
        label: '无完整日期',
        description: '日期不足时保留在未排期或待分配池中，仅提示无法准确判断，不在具体工厂日历上硬扣减。',
      },
    ],
  },
  {
    key: 'RESULT_CALCULATION',
    title: '结果计算规则',
    lines: [
      {
        label: '剩余计算规则',
        description: '剩余标准工时 = 供给标准工时 - 已占用标准工时 - 已冻结标准工时。',
      },
      {
        label: '待分配含义',
        description: '待分配表示任务已有标准工时对象，但还没有稳定落到具体工厂，因此不直接扣到工厂日历。',
      },
      {
        label: '未排期含义',
        description: '未排期表示任务缺少完整日期窗口，当前只保留需求对象，待补齐日期后再参与逐日判断。',
      },
    ],
  },
]

export const CAPACITY_THRESHOLD_RULES: CapacityThresholdRule[] = [
  {
    label: '紧张阈值',
    description: `当前固定为剩余标准工时 / 供给标准工时 < ${formatCapacityThresholdPercent(CAPACITY_TIGHT_THRESHOLD_RATIO)}。`,
  },
  {
    label: '超载定义',
    description: '当前固定为剩余标准工时 < 0，即当前供给已无法覆盖已占用与已冻结需求。',
  },
  {
    label: '日期不足处理',
    description: CAPACITY_DATE_INCOMPLETE_NOTE,
  },
  {
    label: '当前阶段说明',
    description: CAPACITY_NO_REPLAY_SAM_NOTE,
  },
]
