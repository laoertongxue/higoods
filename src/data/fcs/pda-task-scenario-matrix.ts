import type { AssignmentMode, ProcessStage } from './process-types.ts'

export type PdaMobileTaskStage = 'TODO' | 'RECEIVE' | 'EXEC' | 'HANDOVER'

export type PdaMobileProcessKey =
  | 'CUTTING'
  | 'SEWING'
  | 'PRINTING'
  | 'DYEING'
  | 'IRONING'
  | 'PACKAGING'
  | 'QC'
  | 'FINISHING'

export interface PdaMobileProcessDefinition {
  key: PdaMobileProcessKey
  processCode: string
  processNameZh: string
  stage: ProcessStage
  primaryFactoryIds: string[]
  preferredAssignmentMode: AssignmentMode
  supportsTaskMatrix: boolean
  notes: string
}

export interface PdaMobileFactoryProfile {
  factoryId: string
  label: string
  dominantProcesses: PdaMobileProcessKey[]
  secondaryProcesses: PdaMobileProcessKey[]
  notes: string
}

export const PDA_MOBILE_TASK_STAGE_MINIMUMS: Record<PdaMobileTaskStage, number> = {
  TODO: 2,
  RECEIVE: 3,
  EXEC: 5,
  HANDOVER: 3,
}

export const PDA_MOBILE_PROCESS_DEFINITIONS: PdaMobileProcessDefinition[] = [
  {
    key: 'CUTTING',
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    primaryFactoryIds: ['ID-F004'],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '裁片走专项 PDA 链，保留多 execution、UNBOUND、merge batch 和写回后状态。',
  },
  {
    key: 'SEWING',
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    primaryFactoryIds: ['ID-F001'],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '普通成衣厂主工序，接单、执行、交接都应长期占主要比例。',
  },
  {
    key: 'PRINTING',
    processCode: 'PROC_PRINT',
    processNameZh: '印花',
    stage: 'SPECIAL',
    primaryFactoryIds: ['ID-F002'],
    preferredAssignmentMode: 'BIDDING',
    supportsTaskMatrix: true,
    notes: '印花专厂以报价、中标、执行、交接场景为主。',
  },
  {
    key: 'DYEING',
    processCode: 'PROC_DYE',
    processNameZh: '染色',
    stage: 'SPECIAL',
    primaryFactoryIds: ['ID-F003'],
    preferredAssignmentMode: 'BIDDING',
    supportsTaskMatrix: true,
    notes: '染色专厂以招标承接和异常暂停场景为主。',
  },
  {
    key: 'IRONING',
    processCode: 'PROC_IRON',
    processNameZh: '整烫',
    stage: 'POST',
    primaryFactoryIds: ['ID-F001'],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '后道常规工序，需覆盖待接单、执行中、待交出、已交接。',
  },
  {
    key: 'PACKAGING',
    processCode: 'PROC_PACK',
    processNameZh: '包装',
    stage: 'POST',
    primaryFactoryIds: ['ID-F001'],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '普通成衣厂后道工序，需体现包装待领辅料与待交出。',
  },
  {
    key: 'QC',
    processCode: 'PROC_QC',
    processNameZh: '质检',
    stage: 'POST',
    primaryFactoryIds: ['ID-F001'],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '工厂端移动应用已有质检/结算入口，任务链只补执行与交接 mock，不改结算业务事实。',
  },
  {
    key: 'FINISHING',
    processCode: 'PROC_FINISHING',
    processNameZh: '后整理',
    stage: 'POST',
    primaryFactoryIds: ['ID-F001'],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '后整任务用于支撑普通成衣厂执行页不再被裁片任务主导。',
  },
]

export const PDA_MOBILE_FACTORY_PROFILES: PdaMobileFactoryProfile[] = [
  {
    factoryId: 'ID-F001',
    label: '普通成衣工厂',
    dominantProcesses: ['SEWING', 'IRONING', 'PACKAGING', 'QC', 'FINISHING'],
    secondaryProcesses: ['CUTTING'],
    notes: '执行页应以车缝/后道工序为主，不允许继续主要由裁片任务构成。',
  },
  {
    factoryId: 'ID-F002',
    label: '印花专厂',
    dominantProcesses: ['PRINTING'],
    secondaryProcesses: [],
    notes: '接单、执行、交接都以印花任务为主。',
  },
  {
    factoryId: 'ID-F003',
    label: '染色专厂',
    dominantProcesses: ['DYEING'],
    secondaryProcesses: [],
    notes: '接单、执行、交接都以染色任务为主。',
  },
  {
    factoryId: 'ID-F004',
    label: '裁片专厂',
    dominantProcesses: ['CUTTING'],
    secondaryProcesses: [],
    notes: '仍由裁片专项任务链主导，只补外围待办/交接可见性。',
  },
]

export function getPdaMobileProcessDefinition(key: PdaMobileProcessKey): PdaMobileProcessDefinition | undefined {
  return PDA_MOBILE_PROCESS_DEFINITIONS.find((item) => item.key === key)
}

export function getPdaMobileFactoryProfile(factoryId: string): PdaMobileFactoryProfile | undefined {
  return PDA_MOBILE_FACTORY_PROFILES.find((item) => item.factoryId === factoryId)
}
