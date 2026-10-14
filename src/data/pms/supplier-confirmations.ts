import { preparePmsSupplierPurchaseConfirmation, publishPmsMaterialPurchaseOrders, getPmsMaterialPurchaseOrder, hydratePmsMaterialPurchaseOrdersFromIdb, listPmsMaterialPurchaseOrders } from './material-purchase-orders.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords, pmsGetEntityVersion } from './idb-storage.ts'
import { appendPmsLog, nextPmsSequence, PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'

let confirmationHydrationPromise: Promise<void> | null = null
export function hydratePmsSupplierConfirmationsFromIdb(): Promise<void> {
  if (confirmationHydrationPromise) return confirmationHydrationPromise
  confirmationHydrationPromise = (async () => {
    const stored = await pmsAll<PmsSupplierConfirmation>(PMS_STORES.pmsSupplierConfirmations)
    const rt = getRuntime()
    for (const saved of stored) {
      const existing = rt.confirmations.find(item => item.confirmationNo === saved.confirmationNo)
      if (existing) Object.assign(existing, saved)
      else rt.confirmations.unshift(saved)
    }
    for (const row of rt.confirmations) row._pmsBaseVersion = await pmsGetEntityVersion(PMS_STORES.pmsSupplierConfirmations, row.confirmationNo)
  })()
  return confirmationHydrationPromise
}
async function commitConfirmation(confirmation: PmsSupplierConfirmation, log: Parameters<typeof appendPmsLog>[0], operationId?: string, confirmOrder = false, operationSignature?:string): Promise<void> {
  const wasConfirmed = getPmsSupplierConfirmation(confirmation.confirmationNo)?.status === '已确认'
  const reopenOrder = wasConfirmed && confirmation.status !== '已确认'
  const editsConfirmed = reopenOrder || (wasConfirmed && log.action === '保存并确认')
  if (confirmOrder || editsConfirmed) await hydratePmsMaterialPurchaseOrdersFromIdb()
  const currentOrder = editsConfirmed ? getPmsMaterialPurchaseOrder(confirmation.purchaseOrderNo) : undefined
  if (editsConfirmed && !currentOrder) throw new PmsDomainError('CONF_ORDER_MISSING','关联采购单不存在，发货修改未保存')
  if (currentOrder && ['已到货','已入库','已关闭'].includes(currentOrder.status)) throw new PmsDomainError('CONF_ORDER_LOCKED',`关联采购单${currentOrder.status}，不能修改已确认发货资料。使用“查看确认单”核对历史资料`)
  const order = confirmOrder ? preparePmsSupplierPurchaseConfirmation(confirmation.purchaseOrderNo) : reopenOrder && currentOrder ? { ...structuredClone(currentOrder), supplierConfirmed:false, supplierConfirmedAt:'' } : undefined
  const result = await pmsCommitRecords([{store:PMS_STORES.pmsSupplierConfirmations,value:confirmation},...(order ? [{store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value:order}] : [])],{operationId,operationSignature:operationSignature || JSON.stringify({action:log.action,beforeValue:log.beforeValue,afterValue:log.afterValue,reason:log.reason}),log})
  const saved = result.values[0] as PmsSupplierConfirmation
  const existing = getPmsSupplierConfirmation(saved.confirmationNo)
  if (existing) Object.assign(existing, saved)
  else getRuntime().confirmations.unshift(saved)
  Object.assign(confirmation,saved)
  if (order) publishPmsMaterialPurchaseOrders([result.values[1] as typeof order])
}

export type PmsConfirmationStatus = '待确认' | '已编辑' | '已确认'
export type PmsLabelStatus = '未生成' | '已生成' | '已打印' | '部分打印' | '已重打' | '异常'

export interface PmsConfirmationRoll {
  rollNo: string
  packageNo: string
  boxNo: string
  qty: number
  weight: number
  remark: string
  labelNo: string
  labelStatus: PmsLabelStatus
  printCount: number
  printedAt: string
  printedBy: string
  qrContent: string
}

export interface PmsConfirmationBoxSpec {
  boxNo: string
  length: number
  width: number
  height: number
  volume: number
  remark: string
}

export interface PmsConfirmationPackageDetail {
  packageDetailNo: string
  packageMethod: string
  qty: number
  unit: string
  remark: string
}

export interface PmsSupplierConfirmation {
  confirmationNo: string
  purchaseOrderNo: string
  inboundNo: string
  relationNo: string
  materialCode: string
  materialName: string
  materialImageUrl: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  unit: string
  packageUnit: string
  packageQty: number
  supplierName: string
  status: PmsConfirmationStatus
  editor: string
  updatedAt: string
  confirmedBy: string
  confirmedAt: string
  rolls: PmsConfirmationRoll[]
  boxSpecs: PmsConfirmationBoxSpec[]
  packageDetails: PmsConfirmationPackageDetail[]
  actualShipmentQty?: number
  packageCount?: number
  totalBoxCount?: number
  totalWeight?: number
  totalVolume?: number
  shipmentDate?: string
  shipmentRemark?: string
  purchaseRemark?: string
  internalRemark?: string
  // § 2.4.3.6 乐观锁
  _pmsBaseVersion?: number
}

interface PmsConfirmationRuntime {
  confirmations: PmsSupplierConfirmation[]
}

let runtime: PmsConfirmationRuntime | null = null
let rollSequence = 0

function qrText(confirmation: PmsSupplierConfirmation, roll: PmsConfirmationRoll): string {
  const boxSpec = confirmation.boxSpecs.find((spec) => spec.boxNo === roll.boxNo)
  return [
    `SKU：${confirmation.materialCode}`,
    `采购单号：${confirmation.purchaseOrderNo}`,
    `基础单位：${confirmation.unit}`,
    `包装单位：${confirmation.packageUnit}`,
    `卷号：${roll.rollNo}`,
    `包装号：${roll.packageNo}`,
    `箱号：${roll.boxNo}`,
    ...(boxSpec ? [`箱规：${boxSpec.length}×${boxSpec.width}×${boxSpec.height}cm，体积 ${boxSpec.volume}cm³`] : []),
    `包装数量：1${confirmation.packageUnit}`,
    `基础数量：${roll.qty}${confirmation.unit}`,
    ...(roll.weight > 0 ? [`每卷重量：${roll.weight}kg`] : []),
    `供应商：${confirmation.supplierName}`,
    `打印日期：${new Date().toISOString().slice(0, 10)}`,
  ].join('\n')
}

function buildBoxSpec(boxNo: string, length: number, width: number, height: number, remark = ''): PmsConfirmationBoxSpec {
  return { boxNo, length, width, height, volume: calculatePmsBoxVolume(length, width, height), remark }
}

function buildPackageDetail(packageMethod: string, qty: number, unit: string, remark = ''): PmsConfirmationPackageDetail {
  return { packageDetailNo: nextPmsSequence('PKGD', 4), packageMethod, qty, unit, remark }
}

function buildRoll(confirmationNo: string, packageNo: string, boxNo: string, qty: number, weight: number, index: number, rollNo = ''): PmsConfirmationRoll {
  rollSequence += 1
  return {
    rollNo: rollNo || `${confirmationNo}-R${String(index + 1).padStart(3, '0')}`,
    packageNo,
    boxNo,
    qty,
    weight,
    remark: '',
    labelNo: '',
    labelStatus: '未生成',
    printCount: 0,
    printedAt: '',
    printedBy: '',
    qrContent: '',
  }
}

function buildInitialRuntime(): PmsConfirmationRuntime {
  const confirmations: PmsSupplierConfirmation[] = []
  const order1 = getPmsMaterialPurchaseOrder('CGF-2026-0001')
  const order2 = getPmsMaterialPurchaseOrder('CGF-2026-0002')
  const order3 = getPmsMaterialPurchaseOrder('CGF-2026-0005')
  const order4 = getPmsMaterialPurchaseOrder('CGF-2026-0004')
  if (order1) {
    const confirmation: PmsSupplierConfirmation = {
      confirmationNo: 'CONF-2026-0001', purchaseOrderNo: order1.purchaseOrderNo, inboundNo: 'YRK-20260614-001', relationNo: 'GH-FAB-20260610-001',
      materialCode: order1.materialCode, materialName: order1.materialName, materialImageUrl: order1.materialImageUrl,
      styleCode: order1.styleCode, styleName: order1.styleName, styleImageUrl: order1.styleImageUrl,
      unit: order1.unit, packageUnit: '卷', packageQty: 100, supplierName: order1.supplierName,
      status: '待确认', editor: '王采购', updatedAt: '2026-06-13T10:00:00+07:00', confirmedBy: '', confirmedAt: '',
      rolls: [
        buildRoll('CONF-2026-0001', 'F2606100001', 'BOX-001', 100, 12, 0),
        buildRoll('CONF-2026-0001', 'F2606100002', 'BOX-001', 100, 11.8, 1),
        buildRoll('CONF-2026-0001', 'F2606100003', 'BOX-002', 100, 12.3, 2),
        buildRoll('CONF-2026-0001', 'F2606100004', 'BOX-002', 100, 12.1, 3),
        buildRoll('CONF-2026-0001', 'F2606100005', 'BOX-003', 100, 11.9, 4),
        buildRoll('CONF-2026-0001', 'F2606100006', 'BOX-003', 52, 6.2, 5),
      ],
      boxSpecs: [
        buildBoxSpec('BOX-001', 60, 40, 35, '主箱，装 2 卷'),
        buildBoxSpec('BOX-002', 60, 40, 38, '装 2 卷'),
        buildBoxSpec('BOX-003', 55, 38, 32, '尾箱，装 1 卷与尾卷'),
      ],
      packageDetails: [buildPackageDetail('卷装', 6, '卷', '每卷 100 米，尾卷 52 米')],
    }
    confirmations.push(confirmation)
  }
  if (order2) {
    const confirmation: PmsSupplierConfirmation = {
      confirmationNo: 'CONF-2026-0002', purchaseOrderNo: order2.purchaseOrderNo, inboundNo: 'YRK-20260612-002', relationNo: 'GH-ACC-20260609-002',
      materialCode: order2.materialCode, materialName: order2.materialName, materialImageUrl: order2.materialImageUrl,
      styleCode: order2.styleCode, styleName: order2.styleName, styleImageUrl: order2.styleImageUrl,
      unit: order2.unit, packageUnit: '盒', packageQty: 1000, supplierName: order2.supplierName,
      status: '待确认', editor: '王采购', updatedAt: '2026-06-12T09:30:00+07:00', confirmedBy: '', confirmedAt: '',
      rolls: [
        buildRoll('CONF-2026-0002', 'B2606090001', 'CTN-01', 1, 0.4, 0),
        buildRoll('CONF-2026-0002', 'B2606090002', 'CTN-01', 1, 0.4, 1),
        buildRoll('CONF-2026-0002', 'B2606090003', 'CTN-02', 1, 0.4, 2),
      ],
      boxSpecs: [
        buildBoxSpec('CTN-01', 50, 35, 30, '装 2 盒'),
        buildBoxSpec('CTN-02', 50, 35, 30, '装 1 盒'),
      ],
      packageDetails: [buildPackageDetail('盒装', 3, '盒', '每盒 1000 个，共 3000 个')],
    }
    confirmations.push(confirmation)
  }
  if (order3) {
    const confirmation: PmsSupplierConfirmation = {
      confirmationNo: 'CONF-2026-0003', purchaseOrderNo: order3.purchaseOrderNo, inboundNo: 'YRK-20260612-003', relationNo: 'GH-ACC-20260609-003',
      materialCode: order3.materialCode, materialName: order3.materialName, materialImageUrl: order3.materialImageUrl,
      styleCode: order3.styleCode, styleName: order3.styleName, styleImageUrl: order3.styleImageUrl,
      unit: order3.unit, packageUnit: '箱', packageQty: 120, supplierName: order3.supplierName,
      status: '已确认', editor: '王采购', updatedAt: '2026-06-12T15:00:00+07:00', confirmedBy: '陈主管', confirmedAt: '2026-06-12T16:20:00+07:00',
      rolls: [],
      boxSpecs: [buildBoxSpec('CTN-01', 45, 35, 30, '缝纫线整箱')],
      packageDetails: [buildPackageDetail('箱装', 1, '箱', '20 卷/箱')],
    }
    confirmations.push(confirmation)
  }
  if (order4) {
    const confirmation: PmsSupplierConfirmation = {
      confirmationNo: 'CONF-2026-0004', purchaseOrderNo: order4.purchaseOrderNo, inboundNo: 'YRK-20260615-001', relationNo: 'GH-FAB-20260611-001',
      materialCode: order4.materialCode, materialName: order4.materialName, materialImageUrl: order4.materialImageUrl,
      styleCode: order4.styleCode, styleName: order4.styleName, styleImageUrl: order4.styleImageUrl,
      unit: order4.unit, packageUnit: '卷', packageQty: 100, supplierName: order4.supplierName,
      status: '待确认', editor: '王采购', updatedAt: '2026-06-14T09:00:00+07:00', confirmedBy: '', confirmedAt: '',
      rolls: [],
      boxSpecs: [],
      packageDetails: [],
    }
    confirmations.push(confirmation)
  }

  for (const order of listPmsMaterialPurchaseOrders().filter(order => !confirmations.some(row => row.purchaseOrderNo === order.purchaseOrderNo) && !order.pcsSource && !order.tmfTipSource).slice(0, 2)) {
    confirmations.push({ confirmationNo:`CONF-2026-${String(confirmations.length + 1).padStart(4,'0')}`,purchaseOrderNo:order.purchaseOrderNo,inboundNo:'',relationNo:'',materialCode:order.materialCode,materialName:order.materialName,materialImageUrl:order.materialImageUrl,styleCode:order.styleCode,styleName:order.styleName,styleImageUrl:order.styleImageUrl,unit:order.unit,packageUnit:'卷',packageQty:100,supplierName:order.supplierName,status:'待确认',editor:'王采购',updatedAt:'2026-10-13T09:00:00+07:00',confirmedBy:'',confirmedAt:'',rolls:[],boxSpecs:[],packageDetails:[] })
  }
  runtime = { confirmations }
  const fabric = confirmations[0]
  if (fabric) {
    fabric.rolls.slice(0, 2).forEach((roll, index) => {
      roll.labelNo = `LAB-20260613-${String(index + 1).padStart(4, '0')}`
      roll.labelStatus = '已生成'
      roll.qrContent = qrText(fabric, roll)
    })
  }
  const buttons = confirmations[1]
  if (buttons) {
    buttons.rolls.forEach((roll, index) => {
      roll.labelNo = `LAB-20260612-${String(index + 1).padStart(4, '0')}`
      roll.labelStatus = '已生成'
      roll.qrContent = qrText(buttons, roll)
    })
    buttons.rolls[0].printCount = 1
    buttons.rolls[0].printedAt = '2026-06-12T10:20:00+07:00'
    buttons.rolls[0].printedBy = '王采购'
    buttons.rolls[0].labelStatus = '已打印'
  }
  const thread = confirmations[2]
  if (thread && order3) {
    thread.rolls = [buildRoll('CONF-2026-0003', 'T2606090001', 'CTN-01', 1, 13, 0)]
    const roll = thread.rolls[0]
    roll.labelNo = 'LAB-20260612-0009'
    roll.printCount = 1
    roll.printedAt = '2026-06-12T15:10:00+07:00'
    roll.printedBy = '王采购'
    roll.labelStatus = '已打印'
    roll.qrContent = qrText(thread, roll)
  }
  return runtime
}

function getRuntime(): PmsConfirmationRuntime {
  if (!runtime) {
    runtime = buildInitialRuntime()
  }
  return runtime
}

export function listPmsSupplierConfirmations(): PmsSupplierConfirmation[] {
  return getRuntime().confirmations
}

export function getPmsSupplierConfirmation(confirmationNo: string): PmsSupplierConfirmation | undefined {
  return getRuntime().confirmations.find((confirmation) => confirmation.confirmationNo === confirmationNo)
}

export function derivePmsLabelStatus(roll: PmsConfirmationRoll): PmsLabelStatus {
  if (roll.labelStatus === '异常') return '异常'
  if (!roll.labelNo) return '未生成'
  if (roll.printCount === 0) return '已生成'
  return roll.printCount > 1 ? '已重打' : '已打印'
}

export function summarizePmsConfirmationLabels(confirmation: PmsSupplierConfirmation): PmsLabelStatus {
  const statuses = confirmation.rolls.map(derivePmsLabelStatus)
  if (statuses.length === 0) return '未生成'
  if (statuses.some(status=>status==='异常'))return '异常'
  if (statuses.every((status) => status === '未生成')) return '未生成'
  if (statuses.every((status) => status === '已打印' || status === '已重打')) {
    return statuses.some((status) => status === '已重打') ? '已重打' : '已打印'
  }
  return statuses.some(status=>status==='已打印'||status==='已重打') ? '部分打印' : '已生成'
}

export async function generatePmsConfirmationRolls(
  confirmationNo: string,
  input: {
    rollCount: number
    qtyPerPackage: number
    packageUnit: string
    boxCount: number
    rollNoPrefix?: string
    metersPerRoll?: number
    weightPerRoll?: number
    startSequence?: number
  },
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await Promise.all([hydratePmsSupplierConfirmationsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb()])
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  if (confirmation.status === '已确认') throw new PmsDomainError('CONF_LOCKED', '已确认的确认单不能重新生成包装明细')
  const numbered = input.rollNoPrefix !== undefined || input.metersPerRoll !== undefined || input.weightPerRoll !== undefined || input.startSequence !== undefined
  const rollNoPrefix = (input.rollNoPrefix ?? '').trim()
  const metersPerRoll = input.metersPerRoll
  const startSequence = input.startSequence
  if (numbered) {
    if (!rollNoPrefix) throw new PmsDomainError('CONF_ROLL_PREFIX_REQUIRED', '卷号前缀不能为空')
    if (metersPerRoll === undefined || !Number.isFinite(metersPerRoll) || metersPerRoll <= 0) throw new PmsDomainError('CONF_METERS_PER_ROLL_INVALID', '每包装基础数量必须大于 0')
    if (startSequence === undefined || !Number.isInteger(startSequence) || startSequence < 1) throw new PmsDomainError('CONF_START_SEQUENCE_INVALID', '起始序号必须是大于等于 1 的整数')
    if (input.weightPerRoll !== undefined && (!Number.isFinite(input.weightPerRoll) || input.weightPerRoll <= 0)) throw new PmsDomainError('CONF_WEIGHT_PER_ROLL_INVALID', '每卷重量必须大于 0')
  } else if (!Number.isInteger(input.rollCount) || input.rollCount <= 0) {
    throw new PmsDomainError('CONF_ROLL_COUNT_INVALID', '包装数量必须是大于 0 的整数')
  }
  if (!Number.isFinite(input.qtyPerPackage) || input.qtyPerPackage <= 0) throw new PmsDomainError('CONF_QTY_INVALID', '每个包装的数量必须大于 0')
  if (!Number.isInteger(input.boxCount) || input.boxCount <= 0) throw new PmsDomainError('CONF_BOX_INVALID', '箱数必须是大于 0 的整数')
  if (confirmation.rolls.length > 0) throw new PmsDomainError('CONF_ROLLS_EXIST', '包装明细已存在，不能重复生成')
  const order = getPmsMaterialPurchaseOrder(confirmation.purchaseOrderNo)
  if (!order) throw new PmsDomainError('MPO_NOT_FOUND', `面辅料采购单 ${confirmation.purchaseOrderNo} 不存在`)
  if (!input.packageUnit.trim()) throw new PmsDomainError('CONF_UNIT_REQUIRED', '包装单位不能为空')

  confirmation.packageUnit = input.packageUnit.trim()
  confirmation.packageQty = input.qtyPerPackage
  let remaining = roundPmsQty(order.orderedQty, 2)
  const rollCount = numbered && metersPerRoll ? Math.max(1, Math.ceil(roundPmsQty(order.orderedQty, 2) / metersPerRoll)) : input.rollCount
  confirmation.rolls = Array.from({ length: rollCount }, (_, index) => {
    const isLast = index === rollCount - 1
    const qty = numbered && metersPerRoll
      ? roundPmsQty(isLast ? remaining : Math.min(metersPerRoll, remaining), 2)
      : isLast ? remaining : roundPmsQty(Math.min(input.qtyPerPackage, remaining / (rollCount - index)), 2)
    remaining = roundPmsQty(remaining - qty, 2)
    const boxIndex = Math.min(input.boxCount, Math.floor((index * input.boxCount) / rollCount) + 1)
    const rollNo = numbered && startSequence !== undefined ? `${rollNoPrefix}-${startSequence + index}` : ''
    return buildRoll(confirmationNo, `${confirmationNo.replace('CONF-', 'P')}-${String(index + 1).padStart(3, '0')}`, `BOX-${String(boxIndex).padStart(3, '0')}`, qty, numbered ? roundPmsQty(input.weightPerRoll ?? 0, 2) : 0, index, rollNo)
  })
  confirmation.status = '已编辑'
  confirmation.editor = actor.name
  confirmation.updatedAt = new Date().toISOString()
  await commitConfirmation(confirmation, {
    objectType: 'supplier-confirmation',
    objectId: confirmationNo,
    action: '生成包装明细',
    beforeValue: '',
    afterValue: numbered && startSequence !== undefined ? `${confirmation.rolls.length} 个包装 · ${rollNoPrefix}-${startSequence} 起 · ${order.orderedQty} ${order.unit}` : `${confirmation.rolls.length} 个包装 · ${order.orderedQty} ${order.unit}`,
    reason: '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  }, operationId, false, JSON.stringify({confirmationNo,input}))
  return confirmation
}

export function calculatePmsBoxVolume(length: number, width: number, height: number): number {
  return roundPmsQty(length * width * height, 4)
}

function markConfirmationPackageEdited(confirmation: PmsSupplierConfirmation): void {
  if (confirmation.status === '已确认') {
    confirmation.status = '已编辑'
    confirmation.confirmedBy = ''
    confirmation.confirmedAt = ''
  }
}

export async function addPmsConfirmationBoxSpec(
  confirmationNo: string,
  input: { boxNo: string; length: number; width: number; height: number; volume?: number; remark?: string },
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  const boxNo = input.boxNo.trim()
  if (!boxNo) throw new PmsDomainError('CONF_BOX_NO_REQUIRED', '箱号不能为空')
  if (confirmation.boxSpecs.some((spec) => spec.boxNo === boxNo)) throw new PmsDomainError('CONF_BOX_NO_DUPLICATE', `箱号 ${boxNo} 已存在`)
  if (!Number.isFinite(input.length) || input.length <= 0 || !Number.isFinite(input.width) || input.width <= 0 || !Number.isFinite(input.height) || input.height <= 0) {
    throw new PmsDomainError('CONF_BOX_DIMENSION_INVALID', '箱规长、宽、高必须大于 0')
  }
  let volume = calculatePmsBoxVolume(input.length, input.width, input.height)
  if (input.volume !== undefined) {
    if (!Number.isFinite(input.volume) || input.volume <= 0) throw new PmsDomainError('CONF_BOX_VOLUME_INVALID', '体积必须大于 0')
    volume = roundPmsQty(input.volume, 4)
  }
  const length = roundPmsQty(input.length, 2)
  const width = roundPmsQty(input.width, 2)
  const height = roundPmsQty(input.height, 2)
  confirmation.boxSpecs.push({ boxNo, length, width, height, volume, remark: (input.remark ?? '').trim() })
  markConfirmationPackageEdited(confirmation)
  confirmation.editor = actor.name
  confirmation.updatedAt = new Date().toISOString()
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '新增箱规', beforeValue: '', afterValue: `${boxNo} · ${length}×${width}×${height}cm · ${volume}cm³`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role }, operationId, false, JSON.stringify({confirmationNo,input}))
  return confirmation
}

export async function removePmsConfirmationBoxSpec(
  confirmationNo: string,
  boxNo: string,
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  const index = confirmation.boxSpecs.findIndex((spec) => spec.boxNo === boxNo)
  if (index < 0) throw new PmsDomainError('CONF_BOX_SPEC_NOT_FOUND', `箱规 ${boxNo} 不存在`)
  const referenced = confirmation.rolls.filter((roll) => roll.boxNo === boxNo).length
  if (referenced > 0) throw new PmsDomainError('CONF_BOX_SPEC_IN_USE', `箱号 ${boxNo} 已被 ${referenced} 条包装明细引用，请先调整包装明细的箱号再删除`)
  const removed = confirmation.boxSpecs.splice(index, 1)[0]
  markConfirmationPackageEdited(confirmation)
  confirmation.editor = actor.name
  confirmation.updatedAt = new Date().toISOString()
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '删除箱规', beforeValue: `${removed.boxNo} · ${removed.length}×${removed.width}×${removed.height}cm · ${removed.volume}cm³`, afterValue: '', reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role }, operationId, false, JSON.stringify({confirmationNo,boxNo}))
  return confirmation
}

export async function addPmsConfirmationPackageDetail(
  confirmationNo: string,
  input: { packageMethod: string; qty: number; unit: string; remark?: string },
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  const packageMethod = input.packageMethod.trim()
  if (!packageMethod) throw new PmsDomainError('CONF_PACKAGE_METHOD_REQUIRED', '包装方式不能为空')
  if (!Number.isFinite(input.qty) || input.qty <= 0) throw new PmsDomainError('CONF_PACKAGE_QTY_INVALID', '包装明细数量必须大于 0')
  const unit = input.unit.trim()
  if (!unit) throw new PmsDomainError('CONF_PACKAGE_UNIT_REQUIRED', '包装明细单位不能为空')
  const qty = roundPmsQty(input.qty, 2)
  confirmation.packageDetails.push({ packageDetailNo: nextPmsSequence('PKGD', 4), packageMethod, qty, unit, remark: (input.remark ?? '').trim() })
  markConfirmationPackageEdited(confirmation)
  confirmation.editor = actor.name
  confirmation.updatedAt = new Date().toISOString()
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '新增包装明细', beforeValue: '', afterValue: `${packageMethod} · ${qty} ${unit}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role }, operationId, false, JSON.stringify({confirmationNo,input}))
  return confirmation
}

export async function removePmsConfirmationPackageDetail(
  confirmationNo: string,
  packageDetailNo: string,
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  const index = confirmation.packageDetails.findIndex((detail) => detail.packageDetailNo === packageDetailNo)
  if (index < 0) throw new PmsDomainError('CONF_PACKAGE_DETAIL_NOT_FOUND', `包装明细 ${packageDetailNo} 不存在`)
  const removed = confirmation.packageDetails.splice(index, 1)[0]
  markConfirmationPackageEdited(confirmation)
  confirmation.editor = actor.name
  confirmation.updatedAt = new Date().toISOString()
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '删除包装明细', beforeValue: `${removed.packageMethod} · ${removed.qty} ${removed.unit}`, afterValue: '', reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role }, operationId, false, JSON.stringify({confirmationNo,packageDetailNo}))
  return confirmation
}

export async function recordPmsConfirmationLabelDownload(
  confirmationNo: string,
  rollNos: string[],
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  const targets = confirmation.rolls.filter((roll) => rollNos.includes(roll.rollNo))
  if (targets.length === 0) throw new PmsDomainError('CONF_ROLL_NOT_FOUND', '请选择要下载标签的包装')
  targets.forEach((roll) => {
    if (!roll.labelNo) throw new PmsDomainError('CONF_LABEL_REQUIRED', `${roll.packageNo} 还没有生成标签`)
  })
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '下载标签 PNG', beforeValue: '', afterValue: `${targets.length} 个包装标签`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role }, operationId, false, JSON.stringify({confirmationNo,rollNos}))
  return confirmation
}

export async function generatePmsConfirmationLabels(
  confirmationNo: string,
  rollNos: string[],
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  if (confirmation.status === '已确认') throw new PmsDomainError('CONF_LOCKED', '已确认的确认单不能生成标签')
  if (confirmation.rolls.length === 0) throw new PmsDomainError('CONF_ROLLS_REQUIRED', '请先生成包装明细')
  const targets = confirmation.rolls.filter((roll) => rollNos.includes(roll.rollNo))
  if (targets.length === 0) throw new PmsDomainError('CONF_ROLL_NOT_FOUND', '请选择要生成标签的包装')
  targets.forEach((roll) => {
    if (!roll.labelNo) {
      roll.labelNo = `LAB-${confirmationNo.replace(/^CONF-/,'')}-${String(confirmation.rolls.findIndex(item=>item.rollNo===roll.rollNo)+1).padStart(3,'0')}`
      roll.labelStatus = '已生成'
      roll.printCount = 0
    }
    roll.qrContent = qrText(confirmation, roll)
  })
  confirmation.editor = actor.name
  confirmation.updatedAt = new Date().toISOString()
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '生成标签', beforeValue: '', afterValue: `${targets.length} 个包装标签`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role }, operationId, false, JSON.stringify({confirmationNo,rollNos}))
  return confirmation
}

export async function printPmsConfirmationLabels(
  confirmationNo: string,
  rollNos: string[],
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  const targets = confirmation.rolls.filter((roll) => rollNos.includes(roll.rollNo))
  if (targets.length === 0) throw new PmsDomainError('CONF_ROLL_NOT_FOUND', '请选择要打印的标签')
  targets.forEach((roll) => {
    if (!roll.labelNo) throw new PmsDomainError('CONF_LABEL_REQUIRED', `${roll.packageNo} 还没有生成标签`)
  })
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '打开标签打印预览', beforeValue: '', afterValue: `${targets.length} 个包装`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role }, operationId, false, JSON.stringify({confirmationNo,rollNos}))
  return confirmation
}

export async function updatePmsConfirmationRoll(
  confirmationNo: string,
  rollNo: string,
  patch: { qty?: number; weight?: number; boxNo?: string; remark?: string },
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  const roll = confirmation.rolls.find((item) => item.rollNo === rollNo)
  if (!roll) throw new PmsDomainError('CONF_ROLL_NOT_FOUND', `包装 ${rollNo} 不存在`)
  if (patch.qty !== undefined) {
    if (!Number.isFinite(patch.qty) || patch.qty <= 0) throw new PmsDomainError('CONF_ROLL_QTY_INVALID', '包装数量必须大于 0')
    roll.qty = roundPmsQty(patch.qty, 2)
  }
  if (patch.weight !== undefined) {
    if (!Number.isFinite(patch.weight) || patch.weight < 0) throw new PmsDomainError('CONF_ROLL_WEIGHT_INVALID', '重量不能为负数')
    roll.weight = roundPmsQty(patch.weight, 2)
  }
  if (patch.boxNo !== undefined) roll.boxNo = patch.boxNo.trim()
  if (patch.remark !== undefined) roll.remark = patch.remark.trim()
  if (roll.labelNo) roll.qrContent = qrText(confirmation, roll)
  if (confirmation.status === '已确认') {
    confirmation.status = '已编辑'
    confirmation.confirmedBy = ''
    confirmation.confirmedAt = ''
  }
  confirmation.editor = actor.name
  confirmation.updatedAt = new Date().toISOString()
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '编辑包装明细', beforeValue: '', afterValue: roll.packageNo, reason: confirmation.status === '已编辑' ? '已确认单被修改，需要重新确认' : '', actorId: actor.id, actorName: actor.name, actorRole: actor.role }, operationId, false, JSON.stringify({confirmationNo,rollNo,patch}))
  return confirmation
}

export function checkPmsConfirmation(confirmationNo: string): { ok: boolean; reason: string } {
  const confirmation = getPmsSupplierConfirmation(confirmationNo)
  if (!confirmation) return { ok: false, reason: '确认单不存在' }
  if (confirmation.status === '已确认') return { ok: false, reason: '该确认单已经确认' }
  if (confirmation.rolls.length === 0) return { ok: false, reason: '请先生成包装明细' }
  if (confirmation.rolls.some((roll) => !roll.labelNo)) return { ok: false, reason: '存在未生成标签的包装，不能确认' }
  return { ok: true, reason: '' }
}

export async function confirmPmsSupplierConfirmation(
  confirmationNo: string,
  actor: { id: string; name: string; role: PmsActorRole },
  operationId?: string,
): Promise<PmsSupplierConfirmation> {
  await hydratePmsSupplierConfirmationsFromIdb()
  const check = checkPmsConfirmation(confirmationNo)
  if (!check.ok) throw new PmsDomainError('CONF_BLOCKED', check.reason)
  const source = getPmsSupplierConfirmation(confirmationNo)
  const confirmation = source ? structuredClone(source) : undefined
  if (!confirmation) throw new PmsDomainError('CONF_NOT_FOUND', `供应商确认单 ${confirmationNo} 不存在`)
  confirmation.status = '已确认'
  confirmation.confirmedBy = actor.name
  confirmation.confirmedAt = new Date().toISOString()
  confirmation.updatedAt = new Date().toISOString()
  await commitConfirmation(confirmation, { objectType: 'supplier-confirmation', objectId: confirmationNo, action: '确认', beforeValue: '待确认', afterValue: '已确认', reason: '确认后回写采购单', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true }, operationId, true, JSON.stringify({confirmationNo}))
  return confirmation
}

export function resetPmsConfirmationRuntimeForTest(): void {
  runtime = null
  rollSequence = 0
}

export interface PmsConfirmationShipmentPatch { actualShipmentQty:number;packageCount:number;totalBoxCount:number;totalWeight:number;totalVolume:number;shipmentDate:string;shipmentRemark:string;purchaseRemark:string;internalRemark:string;rolls:Array<{rollNo:string;qty:number;weight:number;boxNo:string;remark:string}> }
export async function savePmsConfirmationShipment(confirmationNo:string, patch:PmsConfirmationShipmentPatch, actor:{id:string;name:string;role:PmsActorRole}, confirm = false, operationId?:string):Promise<PmsSupplierConfirmation> {
  await Promise.all([hydratePmsSupplierConfirmationsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb()])
  const source = getPmsSupplierConfirmation(confirmationNo)
  if (!source) throw new PmsDomainError('CONF_NOT_FOUND','供应商确认单不存在')
  if (![patch.actualShipmentQty,patch.packageCount].every(value => Number.isFinite(value) && value > 0) || !Number.isInteger(patch.packageCount)) throw new PmsDomainError('CONF_SHIPMENT_QTY_INVALID','实际发货数量必须大于 0，包装数量必须为正整数')
  for (const value of [patch.totalBoxCount,patch.totalWeight,patch.totalVolume]) if (!Number.isFinite(value) || value < 0) throw new PmsDomainError('CONF_SHIPMENT_VALUE_INVALID','箱数、重量、体积不能为负数')
  if (!Number.isInteger(patch.totalBoxCount)) throw new PmsDomainError('CONF_BOX_INVALID','箱数必须为整数')
  if (patch.shipmentDate && (!/^\d{4}-\d{2}-\d{2}$/.test(patch.shipmentDate) || !Number.isFinite(Date.parse(patch.shipmentDate)) || new Date(patch.shipmentDate).toISOString().slice(0,10) !== patch.shipmentDate)) throw new PmsDomainError('CONF_SHIPMENT_DATE_INVALID','发货日期格式不正确')
  const candidate = structuredClone(source)
  if (patch.rolls.length !== candidate.rolls.length || new Set(patch.rolls.map(roll=>roll.rollNo)).size !== patch.rolls.length) throw new PmsDomainError('CONF_ROLL_SET_INVALID','包装明细已变更，重新打开确认单后填写')
  for (const roll of patch.rolls) {
    const target = candidate.rolls.find(item => item.rollNo === roll.rollNo)
    if (!target || !Number.isFinite(roll.qty) || roll.qty <= 0 || !Number.isFinite(roll.weight) || roll.weight < 0) throw new PmsDomainError('CONF_ROLL_QTY_INVALID','包装数量必须大于 0，重量不能为负数')
    Object.assign(target,roll)
    if (target.labelNo) target.qrContent = qrText(candidate,target)
  }
  if (candidate.rolls.length && Math.abs(candidate.rolls.reduce((sum,roll) => sum + roll.qty,0) - patch.actualShipmentQty) > 0.01) throw new PmsDomainError('CONF_SHIPMENT_TOTAL_MISMATCH','包装明细基础数量合计与实际发货数量不一致')
  const {rolls:_rolls,...header} = patch
  Object.assign(candidate,header,{status:confirm ? '已确认' : '已编辑',editor:actor.name,updatedAt:new Date().toISOString()})
  if (!confirm) { candidate.confirmedBy='';candidate.confirmedAt='' }
  if (confirm) { if (!candidate.rolls.length || candidate.rolls.some(roll => !roll.labelNo)) throw new PmsDomainError('CONF_LABEL_REQUIRED','先生成包装明细与全部标签后再确认'); candidate.confirmedBy=actor.name;candidate.confirmedAt=new Date().toISOString() }
  await commitConfirmation(candidate,{objectType:'supplier-confirmation',objectId:confirmationNo,action:confirm ? '保存并确认' : '保存草稿',beforeValue:source.status,afterValue:candidate.status,reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role,secondConfirmation:confirm},operationId,confirm,JSON.stringify({confirmationNo,patch,confirm}))
  return candidate
}
export async function synchronizePmsSupplierConfirmations(actor:{id:string;name:string;role:PmsActorRole},operationId?:string):Promise<number> {
  await Promise.all([hydratePmsSupplierConfirmationsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb()])
  const candidates = listPmsMaterialPurchaseOrders().filter(order => {
    if(getRuntime().confirmations.some(row => row.purchaseOrderNo === order.purchaseOrderNo))return false
    try { preparePmsSupplierPurchaseConfirmation(order.purchaseOrderNo);return true } catch(error) { if(error instanceof PmsDomainError && error.code==='MPO_CONFIRM_BLOCKED')return false;throw error }
  }).map(order => ({confirmationNo:`CONF-${order.purchaseOrderNo}`,purchaseOrderNo:order.purchaseOrderNo,inboundNo:'',relationNo:'',materialCode:order.materialCode,materialName:order.materialName,materialImageUrl:order.materialImageUrl,styleCode:order.styleCode,styleName:order.styleName,styleImageUrl:order.styleImageUrl,unit:order.unit,packageUnit:'卷',packageQty:1,supplierName:order.supplierName,status:'待确认' as const,editor:actor.name,updatedAt:new Date().toISOString(),confirmedBy:'',confirmedAt:'',rolls:[],boxSpecs:[],packageDetails:[]}))
  if (!candidates.length) return 0
  const result = await pmsCommitRecords(candidates.map(value => ({store:PMS_STORES.pmsSupplierConfirmations,value,expectedVersion:0})),{operationId,operationSignature:JSON.stringify(candidates.map(row=>row.purchaseOrderNo)),log:{objectType:'supplier-confirmation',objectId:'SYNC',action:'同步采购单',beforeValue:'',afterValue:`${candidates.length} 条`,reason:'',actorId:actor.id,actorName:actor.name,actorRole:actor.role}})
  getRuntime().confirmations.unshift(...result.values as PmsSupplierConfirmation[])
  return candidates.length
}
