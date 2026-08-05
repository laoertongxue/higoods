import type { EffectiveTaskAssignment } from './effective-task-assignments'
import type { ProductionReturnRuleSnapshot } from './production-return-fulfillment'
import type { TaskFulfillmentPolicy } from './task-fulfillment-policy'

export type ProductionContractStatus = 'EFFECTIVE' | 'INVALIDATED' | 'GENERATION_FAILED'

export interface SignedContractScan {
  scanId: string
  fileName: string
  mimeType: 'image/jpeg' | 'image/png'
  size: number
  dataUrl: string
  sortOrder: number
  uploadedAt: string
  uploadedBy: string
}

export interface ProductionContract {
  contractId: string
  contractNo: string
  version: number
  assignmentId: string
  runtimeTaskId: string
  lineageRuntimeTaskId: string
  productionOrderId: string
  productionOrderNo?: string
  taskNo?: string
  factoryId: string
  factoryName: string
  processNames: string[]
  skuLines: EffectiveTaskAssignment['skuLines']
  assignedQty: number
  assignmentDate: string
  returnRuleSnapshot: ProductionReturnRuleSnapshot
  status: ProductionContractStatus
  generatedAt: string
  generatedBy: string
  invalidatedAt?: string
  invalidatedReason?: string
  replacedByContractId?: string
  generationError?: string
  scans: SignedContractScan[]
}

export interface ProductionContractAuditLog {
  auditId: string
  contractId: string
  action: 'GENERATED' | 'GENERATION_FAILED' | 'RETRIED' | 'INVALIDATED' | 'PRINTED' | 'SCAN_UPLOADED' | 'SCAN_REORDERED' | 'SCAN_REMOVED'
  detail: string
  operatedAt: string
  operatedBy: string
}

const contracts = new Map<string, ProductionContract>()
let contractSeq = 0
let scanSeq = 0
let auditSeq = 0
const contractAuditLogs: ProductionContractAuditLog[] = []
const STORAGE_KEY = 'higood:fcs:production-contracts:v2'

interface PersistedProductionContractState {
  contracts: ProductionContract[]
  auditLogs: ProductionContractAuditLog[]
  contractSeq: number
  scanSeq: number
  auditSeq: number
}

function persistContractState(): void {
  if (typeof window === 'undefined') return
  try {
    const value: PersistedProductionContractState = {
      contracts: [...contracts.values()],
      auditLogs: contractAuditLogs,
      contractSeq,
      scanSeq,
      auditSeq,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 原型在隐私模式或存储空间不足时仍可继续当前页面操作。
  }
}

function hydrateContractState(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const value = JSON.parse(raw) as PersistedProductionContractState
    value.contracts?.forEach((contract) => contracts.set(contract.contractId, {
      ...contract,
      lineageRuntimeTaskId: contract.lineageRuntimeTaskId || contract.runtimeTaskId,
    }))
    contractAuditLogs.push(...(value.auditLogs || []))
    contractSeq = value.contractSeq || value.contracts?.length || 0
    scanSeq = value.scanSeq || 0
    auditSeq = value.auditSeq || value.auditLogs?.length || 0
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

function appendContractAudit(contractId: string, action: ProductionContractAuditLog['action'], detail: string, operatedAt: string, operatedBy: string): void {
  auditSeq += 1
  contractAuditLogs.push({ auditId: `CONTRACT-AUD-${String(auditSeq).padStart(6, '0')}`, contractId, action, detail, operatedAt, operatedBy })
}

function cloneContract(contract: ProductionContract): ProductionContract {
  return structuredClone(contract)
}

function contractVersionForTask(lineageRuntimeTaskId: string): number {
  return [...contracts.values()].filter((item) => item.lineageRuntimeTaskId === lineageRuntimeTaskId).length + 1
}

export function generateProductionContract(input: {
  assignment: EffectiveTaskAssignment
  policy: TaskFulfillmentPolicy
  returnRuleSnapshot: ProductionReturnRuleSnapshot | null
  processNames: string[]
  generatedAt: string
  generatedBy: string
  lineageRuntimeTaskId?: string
}): ProductionContract | null {
  if (!input.policy.contractRequired) return null
  if (!input.returnRuleSnapshot) throw new Error('有合同任务必须先生成回货规则快照')
  if (!input.assignment.factoryId || !input.assignment.factoryName) throw new Error('只有确认具体加工厂后才能生成合同')
  contractSeq += 1
  const lineageRuntimeTaskId = input.lineageRuntimeTaskId || input.assignment.runtimeTaskId
  const version = contractVersionForTask(lineageRuntimeTaskId)
  const contractId = `CONTRACT-${String(contractSeq).padStart(6, '0')}`

  for (const previous of contracts.values()) {
    if (previous.lineageRuntimeTaskId !== lineageRuntimeTaskId || previous.status !== 'EFFECTIVE') continue
    const sharesSku = previous.skuLines.some((previousLine) => input.assignment.skuLines.some((nextLine) => nextLine.skuCode === previousLine.skuCode))
    if (!sharesSku) continue
    previous.status = 'INVALIDATED'
    previous.invalidatedAt = input.generatedAt
    previous.invalidatedReason = '任务分配事实发生变化，旧合同失效留痕'
    previous.replacedByContractId = contractId
    appendContractAudit(previous.contractId, 'INVALIDATED', previous.invalidatedReason, input.generatedAt, input.generatedBy)
  }

  const contract: ProductionContract = {
    contractId,
    contractNo: `SC-${input.assignment.productionOrderNo || input.assignment.productionOrderId}-${String(version).padStart(2, '0')}`,
    version,
    assignmentId: input.assignment.assignmentId,
    runtimeTaskId: input.assignment.runtimeTaskId,
    lineageRuntimeTaskId,
    productionOrderId: input.assignment.productionOrderId,
    productionOrderNo: input.assignment.productionOrderNo,
    taskNo: input.assignment.taskNo,
    factoryId: input.assignment.factoryId,
    factoryName: input.assignment.factoryName,
    processNames: [...input.processNames],
    skuLines: input.assignment.skuLines.map((line) => ({ ...line })),
    assignedQty: input.assignment.assignedQty,
    assignmentDate: input.assignment.businessAssignedAt.slice(0, 10),
    returnRuleSnapshot: structuredClone(input.returnRuleSnapshot),
    status: 'EFFECTIVE',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    scans: [],
  }
  contracts.set(contractId, contract)
  appendContractAudit(contractId, 'GENERATED', `已按分配${contract.assignmentId}生成V${contract.version}合同`, input.generatedAt, input.generatedBy)
  persistContractState()
  return cloneContract(contract)
}

export function recordProductionContractGenerationFailure(input: {
  assignment: EffectiveTaskAssignment
  policy: TaskFulfillmentPolicy
  returnRuleSnapshot: ProductionReturnRuleSnapshot
  processNames: string[]
  generatedAt: string
  generatedBy: string
  error: string
  lineageRuntimeTaskId?: string
}): ProductionContract {
  contractSeq += 1
  const contractId = `CONTRACT-${String(contractSeq).padStart(6, '0')}`
  const contract: ProductionContract = {
    contractId,
    contractNo: `SC-${input.assignment.productionOrderNo || input.assignment.productionOrderId}-FAILED`,
    version: contractVersionForTask(input.lineageRuntimeTaskId || input.assignment.runtimeTaskId),
    assignmentId: input.assignment.assignmentId,
    runtimeTaskId: input.assignment.runtimeTaskId,
    lineageRuntimeTaskId: input.lineageRuntimeTaskId || input.assignment.runtimeTaskId,
    productionOrderId: input.assignment.productionOrderId,
    productionOrderNo: input.assignment.productionOrderNo,
    taskNo: input.assignment.taskNo,
    factoryId: input.assignment.factoryId,
    factoryName: input.assignment.factoryName,
    processNames: [...input.processNames],
    skuLines: input.assignment.skuLines.map((line) => ({ ...line })),
    assignedQty: input.assignment.assignedQty,
    assignmentDate: input.assignment.businessAssignedAt.slice(0, 10),
    returnRuleSnapshot: structuredClone(input.returnRuleSnapshot),
    status: 'GENERATION_FAILED',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    generationError: input.error,
    scans: [],
  }
  contracts.set(contractId, contract)
  appendContractAudit(contractId, 'GENERATION_FAILED', input.error, input.generatedAt, input.generatedBy)
  persistContractState()
  return cloneContract(contract)
}

export function retryProductionContractGeneration(contractId: string, operatedAt: string, operatedBy: string): ProductionContract {
  const contract = contracts.get(contractId)
  if (!contract) throw new Error('未找到合同记录')
  if (contract.status !== 'GENERATION_FAILED') throw new Error('只有生成失败的合同可以重试')
  contract.status = 'EFFECTIVE'
  contract.generationError = undefined
  contract.generatedAt = operatedAt
  contract.generatedBy = operatedBy
  appendContractAudit(contractId, 'RETRIED', '合同生成重试成功', operatedAt, operatedBy)
  persistContractState()
  return cloneContract(contract)
}

export function invalidateProductionContractsForTask(input: {
  runtimeTaskId: string
  invalidatedAt: string
  reason: string
}): ProductionContract[] {
  const invalidated: ProductionContract[] = []
  for (const contract of contracts.values()) {
    if (contract.runtimeTaskId !== input.runtimeTaskId || contract.status !== 'EFFECTIVE') continue
    contract.status = 'INVALIDATED'
    contract.invalidatedAt = input.invalidatedAt
    contract.invalidatedReason = input.reason
    invalidated.push(cloneContract(contract))
    appendContractAudit(contract.contractId, 'INVALIDATED', input.reason, input.invalidatedAt, '系统')
  }
  persistContractState()
  return invalidated
}

export function addSignedContractScans(contractId: string, files: Array<Omit<SignedContractScan, 'scanId' | 'sortOrder'>>): ProductionContract {
  const contract = contracts.get(contractId)
  if (!contract) throw new Error('未找到合同记录')
  if (files.length === 0) throw new Error('请选择签订后的合同扫描图片')
  for (const file of files) {
    if (file.mimeType !== 'image/jpeg' && file.mimeType !== 'image/png') throw new Error(`${file.fileName}只支持JPG或PNG图片`)
    scanSeq += 1
    contract.scans.push({ ...file, scanId: `SCAN-${String(scanSeq).padStart(6, '0')}`, sortOrder: contract.scans.length + 1 })
    appendContractAudit(contractId, 'SCAN_UPLOADED', `${file.fileName}上传成功`, file.uploadedAt, file.uploadedBy)
  }
  persistContractState()
  return cloneContract(contract)
}

export function removeSignedContractScan(contractId: string, scanId: string, operatedAt = new Date().toISOString(), operatedBy = '生产计划员'): ProductionContract {
  const contract = contracts.get(contractId)
  if (!contract) throw new Error('未找到合同记录')
  const removed = contract.scans.find((item) => item.scanId === scanId)
  contract.scans = contract.scans.filter((item) => item.scanId !== scanId).map((item, index) => ({ ...item, sortOrder: index + 1 }))
  if (removed) appendContractAudit(contractId, 'SCAN_REMOVED', `${removed.fileName}已删除，证据变更已二次确认`, operatedAt, operatedBy)
  persistContractState()
  return cloneContract(contract)
}

export function reorderSignedContractScan(contractId: string, scanId: string, direction: 'UP' | 'DOWN'): ProductionContract {
  const contract = contracts.get(contractId)
  if (!contract) throw new Error('未找到合同记录')
  const index = contract.scans.findIndex((item) => item.scanId === scanId)
  if (index < 0) throw new Error('未找到扫描件')
  const target = direction === 'UP' ? index - 1 : index + 1
  if (target < 0 || target >= contract.scans.length) return cloneContract(contract)
  const next = [...contract.scans]
  ;[next[index], next[target]] = [next[target], next[index]]
  contract.scans = next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 }))
  appendContractAudit(contractId, 'SCAN_REORDERED', `${scanId}${direction === 'UP' ? '上移' : '下移'}`, new Date().toISOString(), '生产计划员')
  persistContractState()
  return cloneContract(contract)
}

export function getProductionContract(contractId: string): ProductionContract | undefined {
  const contract = contracts.get(contractId)
  return contract ? cloneContract(contract) : undefined
}

export function listProductionContracts(filter: { runtimeTaskId?: string; productionOrderId?: string; assignmentId?: string } = {}): ProductionContract[] {
  return [...contracts.values()]
    .filter((item) => !filter.runtimeTaskId || item.runtimeTaskId === filter.runtimeTaskId)
    .filter((item) => !filter.productionOrderId || item.productionOrderId === filter.productionOrderId)
    .filter((item) => !filter.assignmentId || item.assignmentId === filter.assignmentId)
    .map(cloneContract)
}

export function listMissingSignedContractScanTodos(): ProductionContract[] {
  return [...contracts.values()]
    .filter((item) => item.status === 'EFFECTIVE' && item.scans.length === 0)
    .map(cloneContract)
}

export function recordProductionContractPrint(contractId: string, operatedAt: string, operatedBy: string): ProductionContractAuditLog {
  const contract = contracts.get(contractId)
  if (!contract) throw new Error('未找到合同记录')
  appendContractAudit(contractId, 'PRINTED', `打印${contract.contractNo} V${contract.version}`, operatedAt, operatedBy)
  persistContractState()
  return { ...contractAuditLogs[contractAuditLogs.length - 1] }
}

export function listProductionContractAuditLogs(contractId?: string): ProductionContractAuditLog[] {
  return contractAuditLogs.filter((item) => !contractId || item.contractId === contractId).map((item) => ({ ...item }))
}

export function resetProductionContractsForTests(): void {
  contracts.clear()
  contractSeq = 0
  scanSeq = 0
  auditSeq = 0
  contractAuditLogs.splice(0)
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
}

hydrateContractState()
