import { getTmfDemandVersionChange, getTmfPurchaseState, reloadTmfPurchaseRuntime, type TmfPurchaseState } from '../pms/tmf-material-purchases.ts'

export function readTmfPdaReceiptState(): TmfPurchaseState {
  if (typeof window !== 'undefined') reloadTmfPurchaseRuntime()
  return getTmfPurchaseState()
}

/** 扫码只识别交出实物，不接受 SKU 替代包号，也不执行码内导航。 */
export function readTmfOutputReceiptScan(scan: string, warehouseId: string, data = readTmfPdaReceiptState()) {
  if (!warehouseId.trim()) throw new Error('请先选择本次收货仓。')
  let packageId = scan.trim()
  if (!packageId) throw new Error('请扫描产出包标签或交出单。')
  if (packageId.startsWith('{')) {
    let code: { sourceType?: string; sourceId?: string; packageId?: string }
    try { code = JSON.parse(packageId) } catch { throw new Error('条码内容不完整，请重新扫描。') }
    if (!code || typeof code.sourceId !== 'string') throw new Error('条码缺少有效单据编号。')
    if (code.sourceType === 'TMF_OUTPUT_PACKAGE') packageId = code.sourceId
    else if (code.sourceType === 'TMF_OUTPUT_HANDOVER') {
      const handover = data.outputHandovers.find(item => item.id === code.sourceId)
      if (!handover) throw new Error('交出单不存在，请核对实物标签。')
      packageId = handover.packageId
    } else throw new Error('此码不是织带产出包或交出单，请扫描正确标签。')
    if (code.packageId !== undefined && code.packageId !== packageId) throw new Error('条码中的包号与单据不符。')
  }
  const pkg = data.packages.find(item => item.id === packageId)
  if (!pkg || pkg.splitAt) throw new Error('包不存在或已拆分，请扫描有效子包标签。')
  const handovers = data.outputHandovers.filter(item => item.packageId === pkg.id)
  if (handovers.length !== 1) throw new Error('未找到唯一交出记录，请联系交出方核对。')
  const handover = handovers[0]
  if (handover.warehouseId !== warehouseId) throw new Error('此包不属于当前收货仓，请核对交出单。')
  const demand = data.demands.find(item => item.id === pkg.demandId)
  if (!demand || pkg.materialSkuId !== demand.materialSkuId) throw new Error('此包生产需求或物料不符，请联系主管。')
  const remaining = handover.dispatchedPieces - handover.receivedPieces
  if (remaining <= 0) throw new Error('此包已收齐，不能重复收货。')
  const control = data.productionControls.find(item => item.productionOrderId === demand.productionOrderId)
  return structuredClone({ pkg, handover, demand, remaining, restricted: (!!control && control.status !== 'ACTIVE') || !!getTmfDemandVersionChange(demand) })
}
