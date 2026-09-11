/** Named prototype material records. These are demonstration specifications, not live factory records. */
export interface DyeDemoDetails {
  materialName: string; rawSku: string; outputSku: string; colorName: string; colorNo: string
  composition: string; widthCm: number; gsm: number; outputImage: string; sampleImage: string
  supplier: string; demandNo: string; batchNo: string; fabricReceiver: string; sampleNote: string
  shade: '浅色' | '深色'; temperature: 190 | 200 | 205; headVat: string
  additionalInputs?: Array<{name: string; sku: string; imageUrl: string; materialType: string; composition: string; width: string; weightGsm: number}>
  /** 未发料场景的演示调拨计划，数量仍为0，不生成接收或出库事实。 */
  plannedTransferNo: string
  preparedRollCount: number
  completedRollCount: number
  handedOverRollCount: number
  salesType?: string
}
const material = (materialName: string, rawSku: string, colorName: string, composition: string, widthCm: number, gsm: number, outputImage: string) => ({materialName, rawSku, colorName, composition, widthCm, gsm, outputImage})
const cotton = material('纯棉针织布 K118', 'FAB-K118-WHITE', '本白', '100% cotton / 100% 棉', 170, 210, '/materials/process-orders/white-cotton-jersey.jpg')
const rose = material('棉氨针织布 J180', 'FAB-J180-WHITE', '玫瑰红', '95% cotton 5% spandex / 95% 棉 5% 氨纶', 150, 180, '/materials/process-orders/rose-cotton-jersey.png')
const printed = material('蓝白花棉布 C086', 'FAB-C086-BLUE-WHITE', '蓝白色', '100% cotton / 100% 棉', 160, 220, '/materials/fei-ticket/blue-white-print-cotton.png')
const lining = material('50D 四面弹里布 S256', 'FAB-S256-GREIGE', '浅灰', '96% polyester 4% spandex / 96% 涤纶 4% 氨纶', 148, 145, '/materials/process-orders/pale-grey-50d-stretch-lining.jpg')
const fleece = material('雾灰卫衣布 F280', 'FAB-F280-GREIGE', '雾灰', '80% cotton 20% polyester / 80% 棉 20% 涤纶', 148, 280, '/materials/fei-ticket/fog-grey-sweatshirt-fleece.png')
const poplin = material('白色府绸 P200', 'FAB-P200-GREIGE', '本白', '100% cotton / 100% 棉', 160, 200, '/materials/fei-ticket/white-poplin.png')
const fog = material('棉涤梭织布 W185', 'FAB-W185-GREIGE', '雾蓝', '60% cotton 40% polyester / 60% 棉 40% 涤纶', 150, 185, '/materials/process-orders/fog-blue-woven.png')
const lace = material('15 mm 水溶花边', 'MAT-WATER-DYE-081', '本白', '100% polyester / 100% 涤纶', 1.5, 130, '/materials/process-orders/white-water-soluble-lace-12-15mm.jpg')
const definitions: Array<[string, typeof cotton]> = [
  ['DWO-001', printed], ['DWO-002', rose], ['DWO-003', lining], ['DWO-004', cotton],
  ['DWO-005', fleece], ['DWO-006', poplin], ['DWO-007', printed], ['DWO-008', rose],
  ['DWO-009', lining], ['DWO-010', cotton], ['DWO-011', fleece], ['DWO-012', poplin], ['DWO-013', fog],
  ['DYE-WATER-PO-202603-081', lace],
]
export const DYE_DEMO_DETAILS: Readonly<Record<string, DyeDemoDetails>> = Object.fromEntries(definitions.map(([id, spec], i) => [id, {
  ...spec, outputSku: `${spec.rawSku.replace(/-(WHITE|GREIGE)$/, '')}-C${String(i + 1).padStart(3, '0')}`,
  colorNo: `M260910${String(i + 1).padStart(4, '0')}P`, sampleImage: spec.outputImage,
  supplier: ['顺鑫纺织（演示）', '亿程纺织（演示）', '锦源纺织（演示）'][i % 3],
  demandNo: `DEMAND-DEMO-${String(i + 1).padStart(3, '0')}`, batchNo: `B260910-${String(i + 1).padStart(3, '0')}`,
  fabricReceiver: ['hilon', 'dewi', 'goto'][i % 3], sampleNote: `按${spec.colorName}留样复色；样片随单交接`,
  shade: ['玫瑰红', '藏青色', '蓝白色'].includes(spec.colorName) ? '深色' : '浅色', temperature: 190,
  headVat: i === 7 ? '复染' : '头缸',
  plannedTransferNo: `DB-DEMO-20260910-${String(i + 1).padStart(3, '0')}`,
  preparedRollCount: [0,0,0,70,35,84,42,26,48,70,35,0,16,0,0,0][i],
  completedRollCount: [0,0,0,0,0,0,41,26,48,70,35,0,0,0,0,0][i],
  handedOverRollCount: [0,0,0,0,0,0,0,26,48,70,35,0,0,0,0,0][i],
  additionalInputs: id === 'DWO-002' ? [{name: '棉氨针织布 J180（本白，加宽）', sku: 'FAB-J180-WHITE-160', imageUrl: '/materials/process-orders/white-black-cotton-jersey.jpg', materialType:'面料', composition:rose.composition, width:'160 cm', weightGsm:180}] : undefined,
}]))

for (let i=1;i<=3;i++) {
  const id=`DYE-YARN-DEMO-${i}`,img='/materials/process-orders/cotton-yarn-cone.jpg';
  (DYE_DEMO_DETAILS as Record<string,DyeDemoDetails>)[id]={materialName:'粉黑白段染棉纱（演示）',rawSku:'YARN-COTTON-MIXED',outputSku:'YARN-COTTON-MIXED',colorName:'粉/黑/白段染',colorNo:`Y26091100${i}`,composition:'100% 棉',widthCm:0,gsm:0,outputImage:img,sampleImage:img,supplier:'纱线中央仓供料（演示）',demandNo:`BEILIAO-YARN-260911-${i}`,batchNo:'Y260911-01',fabricReceiver:'hilon',sampleNote:'按段染棉纱实物留样核对；管型按实物登记',shade:'浅色',temperature:190,headVat:'头缸',plannedTransferNo:`DB-YARN-260911-${i}`,preparedRollCount:0,completedRollCount:0,handedOverRollCount:0,salesType:'备货'}
}

// Online factory tab names, bound to existing local factory identities.
export const DYE_FACTORY_TABS = [
  {id: '', label: '全部加工厂'}, {id: 'ID-F003', label: 'GTG'}, {id: 'ID-F002', label: 'MJS'},
  {id: 'DYE-GOTO-GLOBAL', label: 'goto_global'}, {id: 'F090', label: '测试专用工厂'}, {id: 'unassigned', label: '待分配'},
]
export function dyeFactoryTabLabel(id: string, fallback: string): string {
  return DYE_FACTORY_TABS.find(item => item.id === id)?.label || fallback
}
export function dyeLengthMeters(qty: number, unit: string): number | null {
  if (unit.toLowerCase() === 'yard') return qty * 0.9144
  if (['米', 'm', 'meter'].includes(unit.toLowerCase())) return qty
  return null
}
export function dyeTheoreticalWeight(qty: number, unit: string, width: number, gsm: number): number | null {
  const meters = dyeLengthMeters(qty, unit)
  return meters === null ? null : Math.round(meters * width / 100 * gsm / 1000 * 100) / 100
}

export type DyePartner =
  | {kind: 'WAREHOUSE'; id: string; name: string; warehouseAttribute: string}
  | {kind: 'FACTORY'; id: string; name: string; factoryType: string}

export function dyePartnerFields(partner: DyePartner): Array<[string, string]> {
  return partner.kind === 'WAREHOUSE'
    ? [['仓库名称', `${partner.name}（${partner.id}）`], ['仓库属性', partner.warehouseAttribute]]
    : [['工厂名称', partner.name], ['工厂编号', partner.id], ['工厂类型', partner.factoryType]]
}

// 名称、编码和分类来自用户2026-09-10截图；逐单上下游关系仅为本地演示分配。
export const DYE_PARTNERS = {
  yarn: {kind:'WAREHOUSE', id:'WH-MAOSHA-001', name:'纱线中央仓', warehouseAttribute:'纱线中央仓'},
  fabric: {kind:'WAREHOUSE', id:'WH-FABRIC-001', name:'面料中央仓(GKP)', warehouseAttribute:'面料中央仓'},
  accessory: {kind:'WAREHOUSE', id:'WH-FITTING-001', name:'辅料中央仓(GTP)', warehouseAttribute:'辅料中央仓'},
  sea: {kind:'WAREHOUSE', id:'WH-BDG-005', name:'中转仓（Sea Cutting）', warehouseAttribute:'中转仓'},
  newCutting: {kind:'WAREHOUSE', id:'WH-BDG-009', name:'中转仓（新裁床）', warehouseAttribute:'中转仓'},
  berys: {kind:'FACTORY', id:'ID-FAC-001260', name:'berys konveksi', factoryType:'印花厂'},
  cik: {kind:'FACTORY', id:'ID-FAC-001183', name:'PT CIK INTERNUSA', factoryType:'印花厂'},
  special: {kind:'FACTORY', id:'ID-FAC-001203', name:'SPF - 特种工艺', factoryType:'特种工艺厂'},
  trims: {kind:'FACTORY', id:'ID-FAC-001197', name:'TMF - 辅料厂', factoryType:'辅料厂（花边、织带等）'},
  sipatax: {kind:'FACTORY', id:'ID-FAC-001165', name:'sipatax', factoryType:'印花厂'},
} as const satisfies Record<string, DyePartner>

type DyeDemoPartnerScenario = {upstream: DyePartner; downstream: DyePartner; upstreamWorkOrder?: {no:string; status:string}}
export const DYE_DEMO_PARTNER_SCENARIOS: Readonly<Record<string, DyeDemoPartnerScenario>> = {
  'DWO-001': {upstream:DYE_PARTNERS.fabric, downstream:DYE_PARTNERS.sea},
  'DWO-002': {upstream:DYE_PARTNERS.berys, downstream:DYE_PARTNERS.cik, upstreamWorkOrder:{no:'YH-DEMO-260910-002', status:'加工中'}},
  'DWO-003': {upstream:DYE_PARTNERS.cik, downstream:DYE_PARTNERS.fabric, upstreamWorkOrder:{no:'YH-DEMO-260910-003', status:'待加工'}},
  'DWO-004': {upstream:DYE_PARTNERS.fabric, downstream:DYE_PARTNERS.berys},
  'DWO-005': {upstream:DYE_PARTNERS.sea, downstream:DYE_PARTNERS.newCutting},
  'DWO-006': {upstream:DYE_PARTNERS.fabric, downstream:DYE_PARTNERS.sea},
  'DWO-007': {upstream:DYE_PARTNERS.newCutting, downstream:DYE_PARTNERS.fabric},
  'DWO-008': {upstream:DYE_PARTNERS.fabric, downstream:DYE_PARTNERS.sipatax},
  'DWO-009': {upstream:DYE_PARTNERS.newCutting, downstream:DYE_PARTNERS.newCutting},
  'DWO-010': {upstream:DYE_PARTNERS.fabric, downstream:DYE_PARTNERS.fabric},
  'DWO-011': {upstream:DYE_PARTNERS.sea, downstream:DYE_PARTNERS.sea},
  'DWO-012': {upstream:DYE_PARTNERS.sea, downstream:DYE_PARTNERS.berys},
  'DWO-013': {upstream:DYE_PARTNERS.fabric, downstream:DYE_PARTNERS.fabric},
  'DYE-WATER-PO-202603-081': {upstream:DYE_PARTNERS.trims, downstream:DYE_PARTNERS.accessory, upstreamWorkOrder:{no:'FL-DEMO-260910-081', status:'加工完成，待交出'}},
}

// 独立交出页面的本地演示批次：规格、卷数及上下游均有明确值。
for (const [i, spec] of [cotton, rose, lining, fleece, printed].entries()) {
  const id = `DYE-DISPATCH-DEMO-${i + 1}`
  ;(DYE_DEMO_DETAILS as Record<string, DyeDemoDetails>)[id] = {
    ...spec, outputSku: `${spec.rawSku}-DY${i + 1}`, colorNo: `M260911${String(i + 21).padStart(4,'0')}P`,
    sampleImage: spec.outputImage, supplier: '亿程纺织（演示）', demandNo: `BEILIAO-260911-${i + 1}`,
    batchNo: `GTG-260911-${i + 1}`, fabricReceiver: i < 3 ? 'hilon' : 'dewi', sampleNote: '按签样颜色交接，逐卷核对卷码与长度',
    shade: i === 1 ? '深色' : '浅色', temperature: 190, headVat: '头缸',
    plannedTransferNo: `DB-DISPATCH-260911-${i + 1}`, preparedRollCount: 6, completedRollCount: 6, handedOverRollCount: 0, salesType: '备货',
  }
  ;(DYE_DEMO_PARTNER_SCENARIOS as Record<string, DyeDemoPartnerScenario>)[id] = {upstream: DYE_PARTNERS.fabric, downstream: i < 2 ? {kind:'FACTORY',id:'ID-F002',name:'MJS',factoryType:'染色厂'} : i === 3 ? DYE_PARTNERS.sea : DYE_PARTNERS.fabric}
}

for(let i=1;i<=3;i++)(DYE_DEMO_PARTNER_SCENARIOS as Record<string,DyeDemoPartnerScenario>)[`DYE-YARN-DEMO-${i}`]={upstream:{kind:'WAREHOUSE',id:'WH-MAOSHA-001',name:'纱线中央仓',warehouseAttribute:'纱线中央仓'},downstream:{kind:'FACTORY',id:'OWN_WOOL_FACTORY',name:'周哥毛织厂',factoryType:'毛织厂'}}
