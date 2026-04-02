export type CapacityCalendarOverrideType = 'PAUSE'

export interface CapacityCalendarOverrideRecord {
  id: string
  factoryId: string
  processCode?: string
  craftCode?: string
  startDate: string
  endDate: string
  overrideType: CapacityCalendarOverrideType
  reason: string
  note?: string
}

const capacityCalendarOverrides: CapacityCalendarOverrideRecord[] = [
  {
    id: 'CAP-OVR-0001',
    factoryId: 'ID-F030',
    startDate: '2026-04-01',
    endDate: '2026-04-03',
    overrideType: 'PAUSE',
    reason: '整厂盘点',
    note: '盘点期间暂停整厂接单与排入日历。',
  },
  {
    id: 'CAP-OVR-0002',
    factoryId: 'ID-F001',
    processCode: 'SEW',
    startDate: '2026-04-04',
    endDate: '2026-04-08',
    overrideType: 'PAUSE',
    reason: '车缝主线切换',
    note: '车缝主线切换款式，窗口内暂停该工序新增承接。',
  },
  {
    id: 'CAP-OVR-0003',
    factoryId: 'ID-F001',
    processCode: 'SEW',
    craftCode: 'CRAFT_262145',
    startDate: '2026-04-02',
    endDate: '2026-04-05',
    overrideType: 'PAUSE',
    reason: '关键工艺设备检修',
    note: '基础连接设备检修，窗口内暂停该工艺承接。',
  },
  {
    id: 'CAP-OVR-0004',
    factoryId: 'ID-F030',
    processCode: 'SEW',
    craftCode: 'CRAFT_262145',
    startDate: '2026-03-24',
    endDate: '2026-03-25',
    overrideType: 'PAUSE',
    reason: '历史检修窗口',
    note: '已过期样例，用于验证例外列表的历史记录展示。',
  },
  {
    id: 'CAP-OVR-0005',
    factoryId: 'ID-F017',
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    overrideType: 'PAUSE',
    reason: '卫星工厂线体检修',
    note: '用于验证当前窗口内暂停会进入工厂日历、风险页、瓶颈页，并在任务分配里禁用工厂。',
  },
]

export interface CapacityCalendarOverrideInput {
  factoryId: string
  processCode?: string
  craftCode?: string
  startDate: string
  endDate: string
  overrideType?: CapacityCalendarOverrideType
  reason: string
  note?: string
}

function cloneOverride(item: CapacityCalendarOverrideRecord): CapacityCalendarOverrideRecord {
  return { ...item }
}

function normalizeOverrideInput(input: CapacityCalendarOverrideInput): CapacityCalendarOverrideInput {
  return {
    factoryId: input.factoryId.trim(),
    processCode: input.processCode?.trim() || undefined,
    craftCode: input.craftCode?.trim() || undefined,
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    overrideType: input.overrideType ?? 'PAUSE',
    reason: input.reason.trim(),
    note: input.note?.trim() || undefined,
  }
}

function validateOverrideInput(input: CapacityCalendarOverrideInput): void {
  if (!input.factoryId) {
    throw new Error('请选择工厂')
  }
  if (!input.startDate || !input.endDate) {
    throw new Error('请填写起止日期')
  }
  if (input.startDate > input.endDate) {
    throw new Error('结束日期不能早于开始日期')
  }
  if (!input.reason) {
    throw new Error('请填写暂停原因')
  }
  if (input.craftCode && !input.processCode) {
    throw new Error('选择工艺前必须先选择工序')
  }
  if ((input.overrideType ?? 'PAUSE') !== 'PAUSE') {
    throw new Error('当前阶段仅支持暂停例外')
  }
}

function buildNextOverrideId(): string {
  const max = capacityCalendarOverrides.reduce((highest, item) => {
    const numeric = Number(item.id.replace('CAP-OVR-', ''))
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest
  }, 0)
  return `CAP-OVR-${String(max + 1).padStart(4, '0')}`
}

export function listCapacityCalendarOverrides(): CapacityCalendarOverrideRecord[] {
  return capacityCalendarOverrides
    .map((item) => cloneOverride(item))
    .sort((left, right) => {
      if (left.startDate !== right.startDate) return right.startDate.localeCompare(left.startDate)
      return left.id.localeCompare(right.id)
    })
}

export function getCapacityCalendarOverrideById(id: string): CapacityCalendarOverrideRecord | undefined {
  const item = capacityCalendarOverrides.find((record) => record.id === id)
  return item ? cloneOverride(item) : undefined
}

export function createCapacityCalendarOverride(input: CapacityCalendarOverrideInput): CapacityCalendarOverrideRecord {
  const normalized = normalizeOverrideInput(input)
  validateOverrideInput(normalized)
  const record: CapacityCalendarOverrideRecord = {
    id: buildNextOverrideId(),
    factoryId: normalized.factoryId,
    processCode: normalized.processCode,
    craftCode: normalized.craftCode,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    overrideType: 'PAUSE',
    reason: normalized.reason,
    note: normalized.note,
  }
  capacityCalendarOverrides.unshift(record)
  return cloneOverride(record)
}

export function updateCapacityCalendarOverride(id: string, input: CapacityCalendarOverrideInput): CapacityCalendarOverrideRecord {
  const index = capacityCalendarOverrides.findIndex((record) => record.id === id)
  if (index < 0) {
    throw new Error('未找到对应的暂停例外')
  }

  const normalized = normalizeOverrideInput(input)
  validateOverrideInput(normalized)

  const next: CapacityCalendarOverrideRecord = {
    id,
    factoryId: normalized.factoryId,
    processCode: normalized.processCode,
    craftCode: normalized.craftCode,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    overrideType: 'PAUSE',
    reason: normalized.reason,
    note: normalized.note,
  }
  capacityCalendarOverrides.splice(index, 1, next)
  return cloneOverride(next)
}

export function removeCapacityCalendarOverride(id: string): void {
  const index = capacityCalendarOverrides.findIndex((record) => record.id === id)
  if (index >= 0) {
    capacityCalendarOverrides.splice(index, 1)
  }
}

export function expireCapacityCalendarOverride(id: string, endDate: string): CapacityCalendarOverrideRecord {
  const current = getCapacityCalendarOverrideById(id)
  if (!current) {
    throw new Error('未找到对应的暂停例外')
  }

  const nextEndDate = endDate < current.startDate ? current.startDate : endDate
  return updateCapacityCalendarOverride(id, {
    factoryId: current.factoryId,
    processCode: current.processCode,
    craftCode: current.craftCode,
    startDate: current.startDate,
    endDate: nextEndDate,
    overrideType: current.overrideType,
    reason: current.reason,
    note: current.note,
  })
}
