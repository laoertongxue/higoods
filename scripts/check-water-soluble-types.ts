import type {
  TechnicalBomItem,
  TechnicalProcessEntry,
} from '../src/data/pcs-technical-data-version-types.ts'
import type { TechPackProcessEntry } from '../src/data/fcs/tech-packs.ts'

const technicalBomContract: TechnicalBomItem = {
  id: 'BOM-WATER-SOLUBLE-TYPE-CHECK',
  type: '辅料',
  name: '水溶花边',
  spec: '常规',
  materialCode: 'MAT-WATER-001',
  unit: '米',
  unitConsumption: 1,
  lossRate: 0,
  supplier: '示例供应商',
  waterSolubleRequirement: '是',
}

const technicalProcessContract: Pick<
  TechnicalProcessEntry,
  'triggerField' | 'targetObject' | 'targetObjectName'
> = {
  triggerField: 'waterSolubleRequirement',
  targetObject: 'BOM_MATERIAL',
  targetObjectName: 'BOM物料',
}

const legacyProcessContract: Pick<
  TechPackProcessEntry,
  'triggerField' | 'targetObject' | 'targetObjectName'
> = {
  triggerField: 'waterSolubleRequirement',
  targetObject: 'BOM_MATERIAL',
  targetObjectName: 'BOM物料',
}

void technicalBomContract
void technicalProcessContract
void legacyProcessContract
