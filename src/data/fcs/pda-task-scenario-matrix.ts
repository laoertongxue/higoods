import type { AssignmentMode, ProcessStage } from './process-types.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'

export type PdaMobileTaskStage = 'TODO' | 'RECEIVE' | 'EXEC' | 'HANDOVER'

export type PdaMobileProcessKey =
  | 'CUTTING'
  | 'SEWING'
  | 'WOOL'
  | 'PRINTING'
  | 'DYEING'
  | 'IRON_PACK'

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
    notes: '周哥毛织厂自有任务，整件毛织与部位毛织均按确认接收、加工填报、发起交出和人工完成加工单执行；缺少任一必需纱线的款色不可填报。',
  },
  {
    key: 'IRON_PACK',
    processCode: 'PROC_IRON_PACK',
    processNameZh: '烫包',
    stage: 'POST',
    primaryFactoryIds: [TEST_FACTORY_ID],
    preferredAssignmentMode: 'DIRECT',
    supportsTaskMatrix: true,
    notes: '烫包是后道阶段的实际工序；质检与复检由回货流程承接，不生成独立工序任务。',
  },
]

export const PDA_MOBILE_FACTORY_PROFILES: PdaMobileFactoryProfile[] = [
  {
    factoryId: TEST_FACTORY_ID,
    label: TEST_FACTORY_NAME,
    dominantProcesses: ['CUTTING', 'PRINTING', 'DYEING', 'SEWING', 'IRON_PACK'],
    secondaryProcesses: [],
    notes: '演示工厂统一为 F090，工厂端执行页按实际工序检索任务。',
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
