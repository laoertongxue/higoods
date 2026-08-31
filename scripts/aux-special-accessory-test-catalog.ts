import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type ChainKind = 'SPECIAL_CRAFT' | 'BINDING_PROCESS_ORDER' | 'LACE_PRODUCTION_ORDER'

export interface AuxSpecialAccessoryChain {
  id: string
  name: string
  kind: ChainKind
  operationId?: string
  craftCode?: string
  expectedTargetObject: '已裁部位' | '成衣' | '捆条' | '辅料' | '花边辅料'
  inputUnit: string
  outputUnit: string
  factoryId?: string
  commonScenarioIds: string[]
  specialScenarioIds: string[]
}

const COMMON_SCENARIOS = Array.from({ length: 18 }, (_, index) => `SC-${String(index + 1).padStart(2, '0')}`)
const LACE_COMMON_SCENARIOS = COMMON_SCENARIOS.filter((scenarioId) => !['SC-14', 'SC-16'].includes(scenarioId))

function specialScenarioIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-S${String(index + 1).padStart(2, '0')}`)
}

function craftChain(input: Omit<AuxSpecialAccessoryChain, 'kind' | 'commonScenarioIds' | 'specialScenarioIds'> & { specialCount: number }): AuxSpecialAccessoryChain {
  const { specialCount, ...chain } = input
  return {
    ...chain,
    kind: 'SPECIAL_CRAFT',
    commonScenarioIds: [...COMMON_SCENARIOS],
    specialScenarioIds: specialScenarioIds(input.id, specialCount),
  }
}

export const AUX_SPECIAL_ACCESSORY_CHAINS: AuxSpecialAccessoryChain[] = [
  craftChain({ id: 'AUX-01', name: '打揽', operationId: 'AUX-OP-DALAN', craftCode: 'CRAFT_000008', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-02', name: '打条', operationId: 'AUX-OP-STRIP', craftCode: 'CRAFT_000032', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-03', name: '烫画', operationId: 'AUX-OP-HEAT-TRANSFER', craftCode: 'CRAFT_008192', expectedTargetObject: '成衣', inputUnit: '件', outputUnit: '件', factoryId: 'FAC-FLOWER', specialCount: 6 }),
  craftChain({ id: 'AUX-04', name: '直喷', operationId: 'AUX-OP-DIRECT-PRINT', craftCode: 'CRAFT_016384', expectedTargetObject: '成衣', inputUnit: '件', outputUnit: '件', factoryId: 'FAC-FLOWER', specialCount: 6 }),
  craftChain({ id: 'AUX-05', name: '绣花', operationId: 'AUX-OP-EMBROIDERY', craftCode: 'CRAFT_3000001', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-06', name: '压褶', operationId: 'AUX-OP-PLEATING', craftCode: 'CRAFT_3000002', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-07', name: '贝壳绣', operationId: 'AUX-OP-SHELL-EMBROIDERY', craftCode: 'CRAFT_3000003', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-08', name: '曲牙绣', operationId: 'AUX-OP-CURVED-TEETH-EMBROIDERY', craftCode: 'CRAFT_3000004', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-09', name: '一字贝绣花', operationId: 'AUX-OP-STRAIGHT-SHELL-EMBROIDERY', craftCode: 'CRAFT_3000005', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-10', name: '盘扣', operationId: 'AUX-OP-BUTTON-LOOP', craftCode: 'CRAFT_3100001', expectedTargetObject: '捆条', inputUnit: '张', outputUnit: '个', factoryId: 'FAC-APF', specialCount: 6 }),
  craftChain({ id: 'AUX-11', name: '花朵', operationId: 'AUX-OP-FLOWER-MAKING', craftCode: 'CRAFT_3100002', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-12', name: '打褶', operationId: 'AUX-OP-GATHERING', craftCode: 'CRAFT_3100003', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'AUX-13', name: '烫钻', operationId: 'AUX-OP-HOTFIX-RHINESTONE', craftCode: 'CRAFT_3100004', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-APF', specialCount: 5 }),
  craftChain({ id: 'SPC-01', name: '模板工序', operationId: 'SPC-OP-TEMPLATE-PROCESS', craftCode: 'CRAFT_3000006', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-SPF', specialCount: 5 }),
  craftChain({ id: 'SPC-02', name: '激光开袋', operationId: 'SPC-OP-LASER-POCKET', craftCode: 'CRAFT_3000007', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-SPF', specialCount: 5 }),
  craftChain({ id: 'SPC-03', name: '特种车缝（花样机）', operationId: 'SPC-OP-PATTERN-MACHINE-SEWING', craftCode: 'CRAFT_3000008', expectedTargetObject: '已裁部位', inputUnit: '片', outputUnit: '片', factoryId: 'FAC-SPF', specialCount: 6 }),
  craftChain({ id: 'SPC-04', name: '橡筋定长切割', operationId: 'SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING', craftCode: 'CRAFT_3000009', expectedTargetObject: '辅料', inputUnit: 'BOM单位', outputUnit: '条', factoryId: 'FAC-SPF', specialCount: 6 }),
  {
    id: 'BIND-01', name: '捆条加工单', kind: 'BINDING_PROCESS_ORDER', expectedTargetObject: '捆条', inputUnit: '米', outputUnit: '米',
    commonScenarioIds: [...COMMON_SCENARIOS], specialScenarioIds: specialScenarioIds('BIND-01', 8),
  },
  {
    id: 'ACC-LACE-01', name: '花边生产单', kind: 'LACE_PRODUCTION_ORDER', expectedTargetObject: '花边辅料', inputUnit: '采购SKU单位', outputUnit: '采购SKU单位',
    commonScenarioIds: [...LACE_COMMON_SCENARIOS], specialScenarioIds: specialScenarioIds('LACE-01', 12),
  },
]

export interface VerificationResult {
  caseId: string
  chainId: string
  workOrderId?: string
  workOrderNo?: string
  status: 'passed' | 'failed' | 'not_applicable' | 'blocked_external'
  assertion: string
  evidence?: Record<string, unknown>
  error?: string
}

export class VerificationRecorder {
  readonly results: VerificationResult[] = []

  constructor(readonly suiteName: string) {}

  check(input: Omit<VerificationResult, 'status' | 'error'>, assertion: () => void): void {
    try {
      assertion()
      this.results.push({ ...input, status: 'passed' })
    } catch (error) {
      this.results.push({
        ...input,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  notApplicable(input: Omit<VerificationResult, 'status' | 'error'>): void {
    this.results.push({ ...input, status: 'not_applicable' })
  }

  blockedExternal(input: Omit<VerificationResult, 'status' | 'error'>): void {
    this.results.push({ ...input, status: 'blocked_external' })
  }

  finish(extra: Record<string, unknown> = {}): void {
    const failed = this.results.filter((result) => result.status === 'failed')
    const notApplicable = this.results.filter((result) => result.status === 'not_applicable')
    const blockedExternal = this.results.filter((result) => result.status === 'blocked_external')
    const evidenceRoot = process.env.AUX_SPECIAL_EVIDENCE_DIR
      ? resolve(process.env.AUX_SPECIAL_EVIDENCE_DIR)
      : resolve('output/verification/aux-special-accessory', process.env.VERIFICATION_PASS || 'adhoc')
    mkdirSync(evidenceRoot, { recursive: true })
    const outputPath = resolve(evidenceRoot, `${this.suiteName}.json`)
    writeFileSync(outputPath, `${JSON.stringify({
      suite: this.suiteName,
      passLabel: process.env.VERIFICATION_PASS || 'adhoc',
      generatedAt: new Date().toISOString(),
      totals: {
        all: this.results.length,
        passed: this.results.length - failed.length - notApplicable.length - blockedExternal.length,
        failed: failed.length,
        notApplicable: notApplicable.length,
        blockedExternal: blockedExternal.length,
      },
      ...extra,
      results: this.results,
    }, null, 2)}\n`)
    if (failed.length > 0) {
      const summary = failed.slice(0, 12).map((result) => `${result.caseId}: ${result.error}`).join('\n')
      throw new Error(`${this.suiteName} 有 ${failed.length} 条失败：\n${summary}\n完整证据：${outputPath}`)
    }
    console.log(`[${this.suiteName}] ${this.results.length - blockedExternal.length - notApplicable.length} 条通过，${blockedExternal.length} 条外部门禁，${notApplicable.length} 条不适用，证据：${outputPath}`)
  }
}

export function getChainByOperationId(operationId: string): AuxSpecialAccessoryChain | undefined {
  return AUX_SPECIAL_ACCESSORY_CHAINS.find((chain) => chain.operationId === operationId)
}

export function getExpectedScenarioCount(): number {
  return AUX_SPECIAL_ACCESSORY_CHAINS.reduce(
    (sum, chain) => sum + chain.commonScenarioIds.length + chain.specialScenarioIds.length,
    0,
  )
}
