import type { MaterialVariantProcessStep } from './pcs-material-variant-types.ts'

export interface FcsCraftDictRef {
  processCode: string
  processName: string
  craftStage: string
}

const MIRROR: Record<string, FcsCraftDictRef> = {
  'craft-dye': { processCode: 'craft-dye', processName: '染色', craftStage: 'POST' },
  'craft-print': { processCode: 'craft-print', processName: '印花', craftStage: 'PROD' },
  'craft-embroider': { processCode: 'craft-embroider', processName: '绣花', craftStage: 'PROD' },
  'craft-wash': { processCode: 'craft-wash', processName: '水洗', craftStage: 'POST' },
  'craft-finish': { processCode: 'craft-finish', processName: '后整理', craftStage: 'POST' },
}

export function getFcsCraftDictRef(processCode: string): FcsCraftDictRef | null {
  return MIRROR[processCode] || null
}

export function listFcsCraftDictRefs(): FcsCraftDictRef[] {
  return Object.values(MIRROR)
}

export function resolveVariantProcessFromFcsDict(step: MaterialVariantProcessStep): FcsCraftDictRef | null {
  return getFcsCraftDictRef(step.processCode) || getFcsCraftDictRef(`craft-${step.processType}`)
}
