import type { ProcessTask } from './process-tasks.ts'
import type { ProcessWorkOrder } from './process-work-order-domain.ts'

export type PlatformProcessStatus =
  | '待下发'
  | '待接单'
  | '待开工'
  | '准备中'
  | '加工中'
  | '待送货'
  | '待回写'
  | '待审核'
  | '异常'
  | '已完成'
  | '已关闭'

export type PlatformProcessStatusCode =
  | 'WAIT_RELEASE'
  | 'WAIT_ACCEPT'
  | 'WAIT_START'
  | 'PREPARING'
  | 'PROCESSING'
  | 'WAIT_DELIVERY'
  | 'WAIT_WRITEBACK'
  | 'WAIT_REVIEW'
  | 'EXCEPTION'
  | 'COMPLETED'
  | 'CLOSED'

export type PlatformRiskLevel = '无风险' | '关注' | '预警' | '异常'

export interface PlatformProcessStatusResult {
  sourceType: string
  sourceId: string
  processType: string
  craftStatusCode: string
  craftStatusLabel: string
  mobileStatusCode: string
  mobileStatusLabel: string
  platformStatusCode: PlatformProcessStatusCode
  platformStatusLabel: PlatformProcessStatus
  platformStageLabel: string
  platformRiskLevel: PlatformRiskLevel
  platformRiskLabel: string
  platformActionHint: string
  platformOwnerHint: string
  canPlatformOperate: boolean
  canFactoryOperate: boolean
  reason: string
}

export interface ProcessPlatformStatusContext {
  sourceType?: string
  sourceId?: string
  processType?: string
  craftStatusCode?: string
  craftStatusLabel?: string
  mobileStatusCode?: string
  mobileStatusLabel?: string
}

interface StatusMeta {
  code: PlatformProcessStatusCode
  label: PlatformProcessStatus
  stage: string
  riskLevel: PlatformRiskLevel
  riskLabel: string
  actionHint: string
  ownerHint: string
  canPlatformOperate: boolean
  canFactoryOperate: boolean
}

export const PLATFORM_PROCESS_STATUS_OPTIONS: PlatformProcessStatus[] = [
  '待下发',
  '待接单',
  '待开工',
  '准备中',
  '加工中',
  '待送货',
  '待回写',
  '待审核',
  '异常',
  '已完成',
  '已关闭',
]

export const PLATFORM_PROCESS_STATUS_ORDER: Record<PlatformProcessStatus, number> = {
  异常: 1,
  待审核: 2,
  待回写: 3,
  待送货: 4,
  加工中: 5,
  准备中: 6,
  待开工: 7,
  待接单: 8,
  待下发: 9,
  已完成: 10,
  已关闭: 11,
}

export const PLATFORM_PROCESS_STATUS_CLASS: Record<PlatformProcessStatus, string> = {
  待下发: 'border-slate-200 bg-slate-50 text-slate-700',
  待接单: 'border-blue-200 bg-blue-50 text-blue-700',
  待开工: 'border-blue-200 bg-blue-50 text-blue-700',
  准备中: 'border-amber-200 bg-amber-50 text-amber-700',
  加工中: 'border-sky-200 bg-sky-50 text-sky-700',
  待送货: 'border-orange-200 bg-orange-50 text-orange-700',
  待回写: 'border-orange-200 bg-orange-50 text-orange-700',
  待审核: 'border-purple-200 bg-purple-50 text-purple-700',
  异常: 'border-red-200 bg-red-50 text-red-700',
  已完成: 'border-green-200 bg-green-50 text-green-700',
  已关闭: 'border-slate-200 bg-slate-100 text-slate-600',
}

const STATUS_META: Record<PlatformProcessStatusCode, Omit<StatusMeta, 'riskLabel' | 'actionHint' | 'ownerHint'>> = {
  WAIT_RELEASE: {
    code: 'WAIT_RELEASE',
    label: '待下发',
    stage: '任务下发',
    riskLevel: '关注',
    canPlatformOperate: true,
    canFactoryOperate: false,
  },
  WAIT_ACCEPT: {
    code: 'WAIT_ACCEPT',
    label: '待接单',
    stage: '工厂接单',
    riskLevel: '关注',
    canPlatformOperate: true,
    canFactoryOperate: false,
  },
  WAIT_START: {
    code: 'WAIT_START',
    label: '待开工',
    stage: '等待开工',
    riskLevel: '关注',
    canPlatformOperate: false,
    canFactoryOperate: true,
  },
  PREPARING: {
    code: 'PREPARING',
    label: '准备中',
    stage: '工艺准备',
    riskLevel: '关注',
    canPlatformOperate: false,
    canFactoryOperate: true,
  },
  PROCESSING: {
    code: 'PROCESSING',
    label: '加工中',
    stage: '工厂加工',
    riskLevel: '无风险',
    canPlatformOperate: false,
    canFactoryOperate: true,
  },
  WAIT_DELIVERY: {
    code: 'WAIT_DELIVERY',
    label: '待送货',
    stage: '工厂交出',
    riskLevel: '关注',
    canPlatformOperate: false,
    canFactoryOperate: true,
  },
  WAIT_WRITEBACK: {
    code: 'WAIT_WRITEBACK',
    label: '待回写',
    stage: '接收回写',
    riskLevel: '预警',
    canPlatformOperate: true,
    canFactoryOperate: false,
  },
  WAIT_REVIEW: {
    code: 'WAIT_REVIEW',
    label: '待审核',
    stage: '平台审核',
    riskLevel: '预警',
    canPlatformOperate: true,
    canFactoryOperate: false,
  },
  EXCEPTION: {
    code: 'EXCEPTION',
    label: '异常',
    stage: '异常处理',
    riskLevel: '异常',
    canPlatformOperate: true,
    canFactoryOperate: true,
  },
  COMPLETED: {
    code: 'COMPLETED',
    label: '已完成',
    stage: '已完成',
    riskLevel: '无风险',
    canPlatformOperate: false,
    canFactoryOperate: false,
  },
  CLOSED: {
    code: 'CLOSED',
    label: '已关闭',
    stage: '已关闭',
    riskLevel: '无风险',
    canPlatformOperate: false,
    canFactoryOperate: false,
  },
}

const PRINT_STATUS_MAP: Record<string, PlatformProcessStatusCode> = {
  WAIT_RELEASE: 'WAIT_RELEASE',
  待下发: 'WAIT_RELEASE',
  WAIT_ACCEPT: 'WAIT_ACCEPT',
  待接单: 'WAIT_ACCEPT',
  WAIT_START: 'WAIT_START',
  待开工: 'WAIT_START',
  WAIT_ARTWORK: 'PREPARING',
  WAIT_COLOR_TEST: 'PREPARING',
  COLOR_TEST_DONE: 'PREPARING',
  WAIT_PRINT: 'PREPARING',
  待花型: 'PREPARING',
  待调色测试: 'PREPARING',
  等打印: 'PREPARING',
  PRINTING: 'PROCESSING',
  PRINT_DONE: 'PROCESSING',
  WAIT_TRANSFER: 'PROCESSING',
  TRANSFERRING: 'PROCESSING',
  打印中: 'PROCESSING',
  打印完成: 'PROCESSING',
  待转印: 'PROCESSING',
  转印中: 'PROCESSING',
  TRANSFER_DONE: 'WAIT_DELIVERY',
  WAIT_HANDOVER: 'WAIT_DELIVERY',
  WAIT_DELIVERY: 'WAIT_DELIVERY',
  WAIT_HANDOUT: 'WAIT_DELIVERY',
  转印完成: 'WAIT_DELIVERY',
  待送货: 'WAIT_DELIVERY',
  待交出: 'WAIT_DELIVERY',
  HANDOVER_SUBMITTED: 'WAIT_WRITEBACK',
  WAIT_WRITEBACK: 'WAIT_WRITEBACK',
  待回写: 'WAIT_WRITEBACK',
  RECEIVER_WRITTEN_BACK: 'WAIT_REVIEW',
  WAIT_REVIEW: 'WAIT_REVIEW',
  REVIEWING: 'WAIT_REVIEW',
  待审核: 'WAIT_REVIEW',
  审核中: 'WAIT_REVIEW',
  REJECTED: 'EXCEPTION',
  AUDIT_REJECTED: 'EXCEPTION',
  QUANTITY_DIFFERENCE: 'EXCEPTION',
  HAS_DIFFERENCE: 'EXCEPTION',
  审核驳回: 'EXCEPTION',
  已驳回: 'EXCEPTION',
  数量差异: 'EXCEPTION',
  有差异: 'EXCEPTION',
  COMPLETED: 'COMPLETED',
  已完成: 'COMPLETED',
  CLOSED: 'CLOSED',
  已关闭: 'CLOSED',
}

const DYE_STATUS_MAP: Record<string, PlatformProcessStatusCode> = {
  WAIT_RELEASE: 'WAIT_RELEASE',
  待下发: 'WAIT_RELEASE',
  WAIT_ACCEPT: 'WAIT_ACCEPT',
  待接单: 'WAIT_ACCEPT',
  WAIT_START: 'WAIT_START',
  待开工: 'WAIT_START',
  WAIT_SAMPLE: 'PREPARING',
  WAIT_MATERIAL: 'PREPARING',
  SAMPLE_TESTING: 'PREPARING',
  SAMPLE_DONE: 'PREPARING',
  MATERIAL_READY: 'PREPARING',
  WAIT_VAT_PLAN: 'PREPARING',
  VAT_PLANNED: 'PREPARING',
  待样衣: 'PREPARING',
  待原料: 'PREPARING',
  打样中: 'PREPARING',
  打样完成: 'PREPARING',
  备料完成: 'PREPARING',
  待排缸: 'PREPARING',
  已排缸: 'PREPARING',
  DYEING: 'PROCESSING',
  DYEING_DONE: 'PROCESSING',
  DEHYDRATING: 'PROCESSING',
  DEHYDRATING_DONE: 'PROCESSING',
  DRYING: 'PROCESSING',
  DRYING_DONE: 'PROCESSING',
  SETTING: 'PROCESSING',
  SETTING_DONE: 'PROCESSING',
  ROLLING: 'PROCESSING',
  ROLLING_DONE: 'PROCESSING',
  PACKING: 'PROCESSING',
  染色中: 'PROCESSING',
  染色完成: 'PROCESSING',
  脱水中: 'PROCESSING',
  脱水完成: 'PROCESSING',
  烘干中: 'PROCESSING',
  烘干完成: 'PROCESSING',
  定型中: 'PROCESSING',
  定型完成: 'PROCESSING',
  打卷中: 'PROCESSING',
  打卷完成: 'PROCESSING',
  包装中: 'PROCESSING',
  PACKING_DONE: 'WAIT_DELIVERY',
  WAIT_HANDOVER: 'WAIT_DELIVERY',
  WAIT_DELIVERY: 'WAIT_DELIVERY',
  包装完成: 'WAIT_DELIVERY',
  待送货: 'WAIT_DELIVERY',
  待交出: 'WAIT_DELIVERY',
  HANDOVER_SUBMITTED: 'WAIT_WRITEBACK',
  WAIT_WRITEBACK: 'WAIT_WRITEBACK',
  待回写: 'WAIT_WRITEBACK',
  RECEIVER_WRITTEN_BACK: 'WAIT_REVIEW',
  WAIT_REVIEW: 'WAIT_REVIEW',
  REVIEWING: 'WAIT_REVIEW',
  待审核: 'WAIT_REVIEW',
  审核中: 'WAIT_REVIEW',
  REJECTED: 'EXCEPTION',
  AUDIT_REJECTED: 'EXCEPTION',
  QUANTITY_DIFFERENCE: 'EXCEPTION',
  HAS_DIFFERENCE: 'EXCEPTION',
  审核驳回: 'EXCEPTION',
  已驳回: 'EXCEPTION',
  数量差异: 'EXCEPTION',
  有差异: 'EXCEPTION',
  COMPLETED: 'COMPLETED',
  已完成: 'COMPLETED',
  CLOSED: 'CLOSED',
  已关闭: 'CLOSED',
}

const CUTTING_STATUS_MAP: Record<string, PlatformProcessStatusCode> = {
  WAIT_RELEASE: 'WAIT_RELEASE',
  待下发: 'WAIT_RELEASE',
  WAIT_ACCEPT: 'WAIT_ACCEPT',
  待接单: 'WAIT_ACCEPT',
  WAIT_MATERIAL_PREP: 'PREPARING',
  PARTIAL_MATERIAL_PREP: 'PREPARING',
  MATERIAL_PREPARED: 'PREPARING',
  WAIT_PICKUP: 'PREPARING',
  PICKED_UP: 'PREPARING',
  WAIT_MARKER: 'PREPARING',
  WAIT_SPREADING: 'PREPARING',
  待配料: 'PREPARING',
  部分配料: 'PREPARING',
  已配料: 'PREPARING',
  待领料: 'PREPARING',
  已领料: 'PREPARING',
  待唛架: 'PREPARING',
  待铺布: 'PREPARING',
  SPREADING: 'PROCESSING',
  WAIT_CUTTING: 'PROCESSING',
  CUTTING: 'PROCESSING',
  CUTTING_DONE: 'PROCESSING',
  WAIT_FEI_TICKET: 'PROCESSING',
  FEI_TICKET_GENERATING: 'PROCESSING',
  FEI_TICKET_DONE: 'PROCESSING',
  WAIT_INBOUND: 'PROCESSING',
  铺布中: 'PROCESSING',
  待裁剪: 'PROCESSING',
  裁剪中: 'PROCESSING',
  裁剪完成: 'PROCESSING',
  待菲票: 'PROCESSING',
  菲票生成中: 'PROCESSING',
  菲票已生成: 'PROCESSING',
  待入仓: 'PROCESSING',
  INBOUNDED: 'WAIT_DELIVERY',
  WAIT_HANDOVER: 'WAIT_DELIVERY',
  已入仓: 'WAIT_DELIVERY',
  待交出: 'WAIT_DELIVERY',
  WAIT_WRITEBACK: 'WAIT_WRITEBACK',
  待回写: 'WAIT_WRITEBACK',
  WAIT_REVIEW: 'WAIT_REVIEW',
  待审核: 'WAIT_REVIEW',
  HAS_DIFFERENCE: 'EXCEPTION',
  QUANTITY_DIFFERENCE: 'EXCEPTION',
  AUDIT_REJECTED: 'EXCEPTION',
  有差异: 'EXCEPTION',
  数量差异: 'EXCEPTION',
  审核驳回: 'EXCEPTION',
  COMPLETED: 'COMPLETED',
  已完成: 'COMPLETED',
  CLOSED: 'CLOSED',
  已关闭: 'CLOSED',
}

const SPECIAL_CRAFT_STATUS_MAP: Record<string, PlatformProcessStatusCode> = {
  WAIT_RELEASE: 'WAIT_RELEASE',
  待下发: 'WAIT_RELEASE',
  WAIT_ACCEPT: 'WAIT_ACCEPT',
  待接单: 'WAIT_ACCEPT',
  WAIT_RECEIVE: 'PREPARING',
  RECEIVED: 'PREPARING',
  WAIT_PROCESS: 'PREPARING',
  WAIT_PICKUP: 'PREPARING',
  IN_WAIT_PROCESS_WAREHOUSE: 'PREPARING',
  待接收: 'PREPARING',
  已接收: 'PREPARING',
  待加工: 'PREPARING',
  待领料: 'PREPARING',
  已入待加工仓: 'PREPARING',
  PROCESSING: 'PROCESSING',
  PROCESS_DONE: 'PROCESSING',
  COMPLETED_PROCESS: 'PROCESSING',
  加工中: 'PROCESSING',
  加工完成: 'PROCESSING',
  WAIT_HANDOVER: 'WAIT_DELIVERY',
  HANDED_OVER: 'WAIT_WRITEBACK',
  待交出: 'WAIT_DELIVERY',
  已交出: 'WAIT_WRITEBACK',
  WAIT_WRITEBACK: 'WAIT_WRITEBACK',
  WRITTEN_BACK: 'WAIT_REVIEW',
  待回写: 'WAIT_WRITEBACK',
  已回写: 'WAIT_REVIEW',
  WAIT_REVIEW: 'WAIT_REVIEW',
  待审核: 'WAIT_REVIEW',
  DIFFERENCE: 'EXCEPTION',
  OBJECTION: 'EXCEPTION',
  ABNORMAL: 'EXCEPTION',
  HAS_DIFFERENCE: 'EXCEPTION',
  DIFF_WAIT_PROCESS: 'EXCEPTION',
  有差异: 'EXCEPTION',
  差异: 'EXCEPTION',
  差异待处理: 'EXCEPTION',
  数量差异: 'EXCEPTION',
  审核驳回: 'EXCEPTION',
  异议中: 'EXCEPTION',
  异常: 'EXCEPTION',
  COMPLETED: 'COMPLETED',
  已完成: 'COMPLETED',
  CLOSED: 'CLOSED',
  已关闭: 'CLOSED',
}

const POST_FINISHING_STATUS_MAP: Record<string, PlatformProcessStatusCode> = {
  待接收领料: 'PREPARING',
  接收中: 'PREPARING',
  已接收: 'PREPARING',
  待质检: 'PREPARING',
  质检完成: 'PREPARING',
  待后道: 'PREPARING',
  后道完成: 'PREPARING',
  待复检: 'PREPARING',
  质检中: 'PROCESSING',
  后道中: 'PROCESSING',
  复检中: 'PROCESSING',
  复检完成: 'WAIT_DELIVERY',
  待交出: 'WAIT_DELIVERY',
  已交出: 'WAIT_WRITEBACK',
  待回写: 'WAIT_WRITEBACK',
  已回写: 'WAIT_REVIEW',
  待审核: 'WAIT_REVIEW',
  有差异: 'EXCEPTION',
  平台处理中: 'EXCEPTION',
  接收差异: 'EXCEPTION',
  质检异常: 'EXCEPTION',
  复检差异: 'EXCEPTION',
  数量差异: 'EXCEPTION',
  审核驳回: 'EXCEPTION',
  已完成: 'COMPLETED',
  已关闭: 'CLOSED',
}

const RISK_HINTS: Record<PlatformProcessStatusCode, { riskLabel: string; actionHint: string; ownerHint: string }> = {
  WAIT_RELEASE: {
    riskLabel: '加工任务尚未下发',
    actionHint: '平台下发加工任务',
    ownerHint: '平台',
  },
  WAIT_ACCEPT: {
    riskLabel: '等待工厂接单',
    actionHint: '跟进工厂接单',
    ownerHint: '工艺工厂',
  },
  WAIT_START: {
    riskLabel: '工厂已接单，等待开工',
    actionHint: '跟进工厂开工',
    ownerHint: '工艺工厂',
  },
  PREPARING: {
    riskLabel: '工艺准备未完成',
    actionHint: '跟进工艺准备节点',
    ownerHint: '工艺工厂',
  },
  PROCESSING: {
    riskLabel: '工厂内部加工中',
    actionHint: '等待工厂完成加工后送货',
    ownerHint: '工艺工厂',
  },
  WAIT_DELIVERY: {
    riskLabel: '工厂已完成加工，待送出',
    actionHint: '催办工厂交出或送货',
    ownerHint: '工艺工厂',
  },
  WAIT_WRITEBACK: {
    riskLabel: '接收方尚未回写实收',
    actionHint: '跟进接收方回写实收',
    ownerHint: '接收方',
  },
  WAIT_REVIEW: {
    riskLabel: '等待平台或接收方审核',
    actionHint: '处理交出审核',
    ownerHint: '平台 / 接收方',
  },
  EXCEPTION: {
    riskLabel: '存在差异或审核驳回，需要处理',
    actionHint: '平台处理差异并确认下一步',
    ownerHint: '平台',
  },
  COMPLETED: {
    riskLabel: '加工单已完成',
    actionHint: '归档或查看记录',
    ownerHint: '平台',
  },
  CLOSED: {
    riskLabel: '加工单已关闭',
    actionHint: '查看关闭原因',
    ownerHint: '平台',
  },
}

const SPECIFIC_HINTS: Record<string, Partial<Record<PlatformProcessStatusCode, Partial<typeof RISK_HINTS[PlatformProcessStatusCode]>>>> = {
  PRINT: {
    PREPARING: {
      riskLabel: '花型、调色或打印排产准备未完成',
      actionHint: '跟进花型调色和打印排产',
      ownerHint: '印花工厂',
    },
    PROCESSING: {
      riskLabel: '印花工厂内部加工中',
      actionHint: '等待打印或转印完成后送货',
      ownerHint: '印花工厂',
    },
    WAIT_DELIVERY: {
      riskLabel: '印花加工完成，待交出',
      actionHint: '催办印花工厂交出面料',
      ownerHint: '印花工厂',
    },
  },
  DYE: {
    PREPARING: {
      riskLabel: '样衣、原料或排缸准备未完成',
      actionHint: '跟进原料到厂和染缸安排',
      ownerHint: '染厂 / 仓库',
    },
    PROCESSING: {
      riskLabel: '染厂内部加工中',
      actionHint: '等待染色、后整和包装完成后送货',
      ownerHint: '染厂',
    },
    WAIT_DELIVERY: {
      riskLabel: '染色加工完成，待交出',
      actionHint: '催办染厂交出面料',
      ownerHint: '染厂',
    },
  },
  CUTTING: {
    PREPARING: {
      riskLabel: '配料、领料或唛架铺布准备未完成',
      actionHint: '跟进仓库配料和裁床准备',
      ownerHint: '仓库 / 裁床',
    },
    PROCESSING: {
      riskLabel: '裁床加工中',
      actionHint: '跟进裁剪、菲票和入仓节点',
      ownerHint: '裁床',
    },
    WAIT_DELIVERY: {
      riskLabel: '裁片已入仓或待交出',
      actionHint: '安排裁片交出或后续工序接收',
      ownerHint: '裁床 / 仓库',
    },
    EXCEPTION: {
      riskLabel: '裁片数量差异待处理',
      actionHint: '平台核对菲票、原始裁片单和差异记录',
      ownerHint: '平台',
    },
  },
  SPECIAL_CRAFT: {
    PREPARING: {
      riskLabel: '工艺工厂尚未完成接收或加工准备',
      actionHint: '跟进工艺工厂接收裁片',
      ownerHint: '特殊工艺工厂',
    },
    PROCESSING: {
      riskLabel: '特殊工艺加工中',
      actionHint: '等待工艺完成后交出',
      ownerHint: '特殊工艺工厂',
    },
    WAIT_DELIVERY: {
      riskLabel: '特殊工艺完成，待交出',
      actionHint: '催办工艺工厂交出裁片',
      ownerHint: '特殊工艺工厂',
    },
    EXCEPTION: {
      riskLabel: '裁片数量差异待处理',
      actionHint: '平台处理差异',
      ownerHint: '平台',
    },
  },
  POST_FINISHING: {
    PREPARING: {
      riskLabel: '后道接收、质检或复检准备未完成',
      actionHint: '跟进后道工厂接收领料和质检复检',
      ownerHint: '后道工厂',
    },
    PROCESSING: {
      riskLabel: '后道工厂内部加工或质检复检中',
      actionHint: '跟进后道、质检或复检进度',
      ownerHint: '后道工厂',
    },
    WAIT_DELIVERY: {
      riskLabel: '后道复检完成，待交出',
      actionHint: '催办后道工厂交出成衣',
      ownerHint: '后道工厂',
    },
    EXCEPTION: {
      riskLabel: '后道存在成衣件数差异或复检异常',
      actionHint: '平台处理后道差异',
      ownerHint: '平台',
    },
  },
}

function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim()
}

function resolveCode(map: Record<string, PlatformProcessStatusCode>, status: unknown, fallback: PlatformProcessStatusCode): PlatformProcessStatusCode {
  const raw = normalizeStatus(status)
  if (!raw) return fallback
  return map[raw] ?? fallback
}

function buildResult(code: PlatformProcessStatusCode, context: ProcessPlatformStatusContext): PlatformProcessStatusResult {
  const base = STATUS_META[code]
  const processType = normalizeStatus(context.processType || 'UNKNOWN')
  const defaultHints = RISK_HINTS[code]
  const specificHints = SPECIFIC_HINTS[processType]?.[code] ?? {}
  const hints = { ...defaultHints, ...specificHints }

  return {
    sourceType: context.sourceType || 'PROCESS_STATUS',
    sourceId: context.sourceId || '-',
    processType,
    craftStatusCode: context.craftStatusCode || normalizeStatus(context.craftStatusLabel || code),
    craftStatusLabel: context.craftStatusLabel || normalizeStatus(context.craftStatusCode || base.label),
    mobileStatusCode: context.mobileStatusCode || '',
    mobileStatusLabel: context.mobileStatusLabel || '',
    platformStatusCode: code,
    platformStatusLabel: base.label,
    platformStageLabel: base.stage,
    platformRiskLevel: base.riskLevel,
    platformRiskLabel: hints.riskLabel,
    platformActionHint: hints.actionHint,
    platformOwnerHint: hints.ownerHint,
    canPlatformOperate: base.canPlatformOperate,
    canFactoryOperate: base.canFactoryOperate,
    reason: `${context.craftStatusLabel || context.craftStatusCode || '未知状态'} 映射为 ${base.label}`,
  }
}

export function mapPrintStatusToPlatformStatus(status: unknown, context: ProcessPlatformStatusContext = {}): PlatformProcessStatusResult {
  return buildResult(resolveCode(PRINT_STATUS_MAP, status, 'EXCEPTION'), {
    ...context,
    processType: 'PRINT',
    craftStatusCode: context.craftStatusCode || normalizeStatus(status),
  })
}

export function mapDyeStatusToPlatformStatus(status: unknown, context: ProcessPlatformStatusContext = {}): PlatformProcessStatusResult {
  return buildResult(resolveCode(DYE_STATUS_MAP, status, 'EXCEPTION'), {
    ...context,
    processType: 'DYE',
    craftStatusCode: context.craftStatusCode || normalizeStatus(status),
  })
}

export function mapCuttingStatusToPlatformStatus(status: unknown, context: ProcessPlatformStatusContext = {}): PlatformProcessStatusResult {
  return buildResult(resolveCode(CUTTING_STATUS_MAP, status, 'EXCEPTION'), {
    ...context,
    processType: 'CUTTING',
    craftStatusCode: context.craftStatusCode || normalizeStatus(status),
  })
}

export function mapSpecialCraftStatusToPlatformStatus(status: unknown, context: ProcessPlatformStatusContext = {}): PlatformProcessStatusResult {
  return buildResult(resolveCode(SPECIAL_CRAFT_STATUS_MAP, status, 'EXCEPTION'), {
    ...context,
    processType: 'SPECIAL_CRAFT',
    craftStatusCode: context.craftStatusCode || normalizeStatus(status),
  })
}

export function mapPostFinishingStatusToPlatformStatus(status: unknown, context: ProcessPlatformStatusContext = {}): PlatformProcessStatusResult {
  return buildResult(resolveCode(POST_FINISHING_STATUS_MAP, status, 'EXCEPTION'), {
    ...context,
    processType: 'POST_FINISHING',
    craftStatusCode: context.craftStatusCode || normalizeStatus(status),
  })
}

export function mapCraftStatusToPlatformStatus(params: ProcessPlatformStatusContext & { status?: unknown }): PlatformProcessStatusResult {
  const status = params.status ?? params.craftStatusCode ?? params.craftStatusLabel
  switch (params.processType) {
    case 'PRINT':
    case 'PRINTING':
      return mapPrintStatusToPlatformStatus(status, { ...params, processType: 'PRINT' })
    case 'DYE':
    case 'DYEING':
      return mapDyeStatusToPlatformStatus(status, { ...params, processType: 'DYE' })
    case 'CUT':
    case 'CUTTING':
      return mapCuttingStatusToPlatformStatus(status, { ...params, processType: 'CUTTING' })
    case 'SPECIAL':
    case 'SPECIAL_CRAFT':
      return mapSpecialCraftStatusToPlatformStatus(status, { ...params, processType: 'SPECIAL_CRAFT' })
    case 'POST':
    case 'POST_FINISHING':
      return mapPostFinishingStatusToPlatformStatus(status, { ...params, processType: 'POST_FINISHING' })
    default:
      return buildResult('EXCEPTION', {
        ...params,
        processType: params.processType || 'UNKNOWN',
        craftStatusCode: normalizeStatus(status),
        craftStatusLabel: params.craftStatusLabel || '未知状态',
      })
  }
}

export function getPlatformStatusForProcessWorkOrder(workOrder: ProcessWorkOrder): PlatformProcessStatusResult {
  return mapCraftStatusToPlatformStatus({
    sourceType: 'PROCESS_WORK_ORDER',
    sourceId: workOrder.workOrderId,
    processType: workOrder.processType,
    craftStatusCode: workOrder.status,
    craftStatusLabel: workOrder.statusLabel,
    status: workOrder.status,
  })
}

function getRuntimeTaskProcessType(task: ProcessTask): string {
  if (task.processCode.includes('PRINT')) return 'PRINT'
  if (task.processCode.includes('DYE')) return 'DYE'
  if (task.processCode.includes('CUT')) return 'CUTTING'
  if (task.processCode.includes('POST') || task.processNameZh.includes('后道')) return 'POST_FINISHING'
  if (task.processCode.includes('SPECIAL') || task.processCode.includes('CRAFT')) return 'SPECIAL_CRAFT'
  return task.processNameZh.includes('印花')
    ? 'PRINT'
    : task.processNameZh.includes('染')
      ? 'DYE'
      : task.processNameZh.includes('裁')
        ? 'CUTTING'
        : task.processNameZh.includes('后道')
          ? 'POST_FINISHING'
          : task.processNameZh.includes('特殊') || task.processNameZh.includes('打揽') || task.processNameZh.includes('打条') || task.processNameZh.includes('捆条')
          ? 'SPECIAL_CRAFT'
          : 'UNKNOWN'
}

function getRuntimeTaskStatusCode(task: ProcessTask): PlatformProcessStatusCode {
  if (task.status === 'CANCELLED') return 'CLOSED'
  if (task.status === 'DONE') return 'COMPLETED'
  if (task.status === 'BLOCKED') return 'EXCEPTION'
  if (task.status === 'IN_PROGRESS') return 'PROCESSING'
  if (task.assignmentStatus === 'UNASSIGNED' || task.assignmentStatus === 'ASSIGNING') return 'WAIT_RELEASE'
  if (task.assignmentStatus === 'BIDDING') return 'WAIT_ACCEPT'
  if (task.assignmentStatus === 'ASSIGNED' || task.assignmentStatus === 'AWARDED') return 'WAIT_START'
  return 'WAIT_START'
}

export function getPlatformStatusForRuntimeTask(task: ProcessTask): PlatformProcessStatusResult {
  const processType = getRuntimeTaskProcessType(task)
  const statusCode = getRuntimeTaskStatusCode(task)
  const craftStatusLabel =
    task.status === 'NOT_STARTED'
      ? '待开工'
      : task.status === 'IN_PROGRESS'
        ? '进行中'
        : task.status === 'BLOCKED'
          ? '生产暂停'
          : task.status === 'DONE'
            ? '已完成'
            : task.status === 'CANCELLED'
              ? '已关闭'
              : task.status

  return buildResult(statusCode, {
    sourceType: 'RUNTIME_PROCESS_TASK',
    sourceId: task.taskId,
    processType,
    craftStatusCode: task.status,
    craftStatusLabel,
    mobileStatusCode: task.status,
    mobileStatusLabel: craftStatusLabel,
  })
}

export function listPlatformStatusOptions(): PlatformProcessStatus[] {
  return [...PLATFORM_PROCESS_STATUS_OPTIONS]
}
