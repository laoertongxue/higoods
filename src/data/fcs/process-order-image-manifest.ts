/**
 * 原型命名场景使用的稳定本地实拍图/效果图映射。
 * 每个路径都必须能在 public/ 下直接访问；页面不得退回 placeholder.svg。
 */
export interface PrintingOrderImageManifestEntry {
  product: string
  input: string
  output: string
  frontPattern: string
  insidePattern?: string
}

export interface ProcessOrderImageManifestEntry {
  product: string
  material: string
}

export const PRINTING_ORDER_IMAGE_MANIFEST: Readonly<Record<string, PrintingOrderImageManifestEntry>> = {
  'PWO-PRINT-001': { product: '/pants-sample.jpg', input: '/materials/fei-ticket/navy-main-fabric.png', output: '/materials/fei-ticket/navy-splice-fabric.png', frontPattern: '/materials/fei-ticket/navy-splice-fabric.png', insidePattern: '/materials/fei-ticket/blue-white-print-cotton.png' },
  'PWO-PRINT-002': { product: '/tshirt-sample.jpg', input: '/materials/fei-ticket/white-poplin.png', output: '/materials/fei-ticket/black-splice-fabric.png', frontPattern: '/tshirt-sample.jpg' },
  'PWO-PRINT-003': { product: '/shirt-sample.jpg', input: '/materials/fei-ticket/white-poplin.png', output: '/materials/fei-ticket/blue-white-print-cotton.png', frontPattern: '/shirt-sample.jpg' },
  'PWO-PRINT-004': { product: '/jacket-sample.jpg', input: '/materials/fei-ticket/fog-grey-sweatshirt-fleece.png', output: '/materials/fei-ticket/grey-main-fabric.png', frontPattern: '/jacket-sample.jpg' },
  'PWO-PRINT-005': { product: '/dress-sample-1.jpg', input: '/materials/fabric-main.jpg', output: '/materials/fei-ticket/red-dress-crepe.png', frontPattern: '/dress-sample-1.jpg' },
  'PWO-PRINT-006': { product: '/cardigan-sample.jpg', input: '/materials/yarn-stitching.jpg', output: '/materials/yarn-stitching.jpg', frontPattern: '/cardigan-sample.jpg' },
  'PWO-PRINT-007': { product: '/materials/fei-ticket/khaki-canvas.png', input: '/materials/fei-ticket/khaki-canvas.png', output: '/materials/fei-ticket/khaki-splice-fabric.png', frontPattern: '/materials/fei-ticket/khaki-splice-fabric.png' },
  'PWO-PRINT-008': { product: '/materials/fei-ticket/blue-white-print-cotton.png', input: '/materials/fei-ticket/white-poplin.png', output: '/materials/fei-ticket/blue-white-print-cotton.png', frontPattern: '/materials/fei-ticket/blue-white-print-cotton.png' },
  'PWO-PRINT-009': { product: '/materials/fei-ticket/black-stretch-twill.png', input: '/materials/fei-ticket/black-stretch-twill.png', output: '/materials/fei-ticket/black-splice-fabric.png', frontPattern: '/materials/fei-ticket/black-splice-fabric.png' },
  'PWO-PRINT-010': { product: '/materials/fei-ticket/charcoal-stretch-twill.png', input: '/materials/fei-ticket/charcoal-stretch-twill.png', output: '/materials/fei-ticket/charcoal-splice-fabric.png', frontPattern: '/materials/fei-ticket/charcoal-splice-fabric.png' },
  'PWO-PRINT-011': { product: '/materials/fei-ticket/navy-main-fabric.png', input: '/materials/fei-ticket/navy-main-fabric.png', output: '/materials/fei-ticket/navy-splice-fabric.png', frontPattern: '/materials/fei-ticket/navy-splice-fabric.png' },
  'PWO-PRINT-012': { product: '/materials/fei-ticket/grey-main-fabric.png', input: '/materials/fei-ticket/grey-main-fabric.png', output: '/materials/fei-ticket/fog-grey-sweatshirt-fleece.png', frontPattern: '/materials/fei-ticket/fog-grey-sweatshirt-fleece.png' },
}

export function getPrintingOrderImageManifest(orderId: string): PrintingOrderImageManifestEntry | undefined {
  const entry = PRINTING_ORDER_IMAGE_MANIFEST[orderId]
  return entry ? { ...entry } : undefined
}

export const DYE_ORDER_IMAGE_MANIFEST: Readonly<Record<string, ProcessOrderImageManifestEntry>> = {
  'DYE-DISPATCH-DEMO-1': {product:'/materials/process-orders/white-cotton-jersey.jpg',material:'/materials/process-orders/white-cotton-jersey.jpg'},
  'DYE-DISPATCH-DEMO-2': {product:'/materials/process-orders/rose-cotton-jersey.png',material:'/materials/process-orders/white-black-cotton-jersey.jpg'},
  'DYE-DISPATCH-DEMO-3': {product:'/materials/process-orders/pale-grey-50d-stretch-lining.jpg',material:'/materials/process-orders/pale-grey-50d-stretch-lining.jpg'},
  'DYE-DISPATCH-DEMO-4': {product:'/materials/fei-ticket/fog-grey-sweatshirt-fleece.png',material:'/materials/fei-ticket/fog-grey-sweatshirt-fleece.png'},
  'DYE-DISPATCH-DEMO-5': {product:'/materials/fei-ticket/blue-white-print-cotton.png',material:'/materials/fei-ticket/blue-white-print-cotton.png'},
  'DYE-YARN-DEMO-1': { product:'/materials/process-orders/cotton-yarn-cone.jpg', material:'/materials/process-orders/cotton-yarn-cone.jpg' },
  'DYE-YARN-DEMO-2': { product:'/materials/process-orders/cotton-yarn-cone.jpg', material:'/materials/process-orders/cotton-yarn-cone.jpg' },
  'DYE-YARN-DEMO-3': { product:'/materials/process-orders/cotton-yarn-cone.jpg', material:'/materials/process-orders/cotton-yarn-cone.jpg' },

  'DWO-001': { product: '/shirt-sample.jpg', material: '/materials/fei-ticket/blue-white-print-cotton.png' },
  'DWO-002': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/white-black-cotton-jersey.jpg' },
  'DWO-003': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/pale-grey-50d-stretch-lining.jpg' },
  'DWO-004': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/white-cotton-jersey.jpg' },
  'DWO-005': { product: '/jacket-sample.jpg', material: '/materials/fei-ticket/fog-grey-sweatshirt-fleece.png' },
  'DWO-006': { product: '/shirt-sample.jpg', material: '/materials/fei-ticket/white-poplin.png' },
  'DWO-007': { product: '/shirt-sample.jpg', material: '/materials/fei-ticket/blue-white-print-cotton.png' },
  'DWO-008': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/white-black-cotton-jersey.jpg' },
  'DWO-009': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/pale-grey-50d-stretch-lining.jpg' },
  'DWO-010': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/white-cotton-jersey.jpg' },
  'DWO-011': { product: '/jacket-sample.jpg', material: '/materials/fei-ticket/fog-grey-sweatshirt-fleece.png' },
  'DWO-012': { product: '/shirt-sample.jpg', material: '/materials/fei-ticket/white-poplin.png' },
  'DWO-013': { product: '/materials/process-orders/greige-cotton-polyester-woven.jpg', material: '/materials/process-orders/greige-cotton-polyester-woven.jpg' },
  'DYE-WATER-PO-202603-081': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/white-water-soluble-lace-12-15mm.jpg' },
}

export const WATER_SOLUBLE_ORDER_IMAGE_MANIFEST: Readonly<Record<string, ProcessOrderImageManifestEntry>> = {
  'WATER-PO-202603-081__tdv_demand_SPU_TSHIRT_081-bom-water-soluble-only': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/white-water-soluble-lace-12-15mm.jpg' },
  'WATER-PO-202603-087__tdv_demand_SPU_TSHIRT_081-bom-water-soluble-only': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/white-water-soluble-lace-12-15mm.jpg' },
  'WATER-PO-202603-088__tdv_demand_SPU_TSHIRT_081-bom-water-soluble-only': { product: '/tshirt-sample.jpg', material: '/materials/process-orders/white-water-soluble-lace-12-15mm.jpg' },
}

export function getDyeOrderImageManifest(orderId: string): ProcessOrderImageManifestEntry | undefined {
  const entry = DYE_ORDER_IMAGE_MANIFEST[orderId]
  return entry ? { ...entry } : undefined
}

export function getWaterSolubleOrderImageManifest(orderId: string): ProcessOrderImageManifestEntry | undefined {
  const entry = WATER_SOLUBLE_ORDER_IMAGE_MANIFEST[orderId]
  return entry ? { ...entry } : undefined
}
