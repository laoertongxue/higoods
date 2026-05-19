import type { AssignmentMode, ProcessStage } from './process-types.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'

export type PdaMobileTaskStage = 'TODO' | 'RECEIVE' | 'EXEC' | 'HANDOVER'

export type PdaMobileProcessKey =
  | 'CUTTING'
  | 'SEWING'
  | 'WOOL'
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
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '裁片走专项 PDA 链，保留多 execution、UNBOUND、merge batch 和写回后状态。',
  },
  {
    key: 'SEWING',
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '普通成衣厂主工序，接单、执行、交接都应长期占主要比例。',
  },
  {
    key: 'WOOL',
    processCode: 'PROC_WOOL',
    processNameZh: '毛织',
    stage: 'SPECIAL',
    primaryFactoryIds: ['OWN_WOOL_FACTORY'],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '周哥毛织厂自有任务，覆盖整件毛织与部位毛织的接单、收纱、开工、关键节点和交出。',
  },
  {
    key: 'PRINTING',
    processCode: 'PROC_PRINT',
    processNameZh: '印花',
    stage: 'SPECIAL',
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'BIDDING',
    supportsTaskMatrix: true,
    notes: '印花专厂以报价、中标、执行、交接场景为主。',
  },
  {
    key: 'DYEING',
    processCode: 'PROC_DYE',
    processNameZh: '染色',
    stage: 'SPECIAL',
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'BIDDING',
    supportsTaskMatrix: true,
    notes: '染色专厂以招标承接和异常暂停场景为主。',
  },
  {
    key: 'IRONING',
    processCode: 'PROC_IRON',
    processNameZh: '整烫',
    stage: 'POST',
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '后道常规工序，需覆盖待接单、执行中、待交出、已交接。',
  },
  {
    key: 'PACKAGING',
    processCode: 'PROC_PACK',
    processNameZh: '包装',
    stage: 'POST',
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '普通成衣厂后道工序，需体现包装待领辅料与待交出。',
  },
  {
    key: 'QC',
    processCode: 'PROC_QC',
    processNameZh: '质检',
    stage: 'POST',
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '工厂端移动应用已有质检/结算入口，任务链只补执行与交接 mock，不改结算业务事实。',
  },
  {
    key: 'FINISHING',
    processCode: 'PROC_FINISHING',
    processNameZh: '后整理',
    stage: 'POST',
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '后整任务用于支撑普通成衣厂执行页不再被裁片任务主导。',
  },
]

export const PDA_MOBILE_FACTORY_PROFILES: PdaMobileFactoryProfile[] = [
  {
    factoryId: TEST_FACTORY_ID,
    label: TEST_FACTORY_NAME,
    dominantProcesses: ['CUTTING', 'PRINTING', 'DYEING', 'SEWING', 'IRONING', 'PACKAGING', 'QC', 'FINISHING'],
    secondaryProcesses: [],
    notes: '演示工厂统一为 F090，工厂端执行页可检索印花、染色、裁片和后续工序任务。',
  },
  {
    factoryId: 'OWN_WOOL_FACTORY',
    label: '周哥毛织厂',
    dominantProcesses: ['WOOL'],
    secondaryProcesses: [],
    notes: '自有毛织厂账号，移动端处理整件毛织和部位毛织任务。',
  },
]

export function getPdaMobileProcessDefinition(key: PdaMobileProcessKey): PdaMobileProcessDefinition | undefined {
  return PDA_MOBILE_PROCESS_DEFINITIONS.find((item) => item.key === key)
}

export function getPdaMobileFactoryProfile(factoryId: string): PdaMobileFactoryProfile | undefined {
  return PDA_MOBILE_FACTORY_PROFILES.find((item) => item.factoryId === factoryId)
}
