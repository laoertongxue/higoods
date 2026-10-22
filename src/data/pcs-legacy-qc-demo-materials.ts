import type { TechnicalDataVersionContent } from './pcs-technical-data-version-types.ts'
import type { TechPackBomItemSnapshot } from './fcs/production-tech-pack-snapshot-types.ts'

/** Static prototype revision only; never a factory usage, dyeing or publication event. */
export const LEGACY_QC_MATERIAL_DEMO_REVISION = 'legacy-qc-material-demo-20261022-v1'

export interface LegacyQcMaterialDemoBinding {
  technicalVersionId: string
  productionOrderId: string
  styleCode: string
  materialId: string
  materialCode: string
  materialSkuId: string
  materialSkuCode: string
  materialName: string
  colorLabel: string
  unit: string
  imageUrl: string
  imageLabel: string
  imageSha256: string
}

export const LEGACY_QC_MATERIAL_BINDINGS: readonly Readonly<LegacyQcMaterialDemoBinding>[] = Object.freeze([
  Object.freeze({ technicalVersionId: 'tdv_demand_SPU_QC_001', productionOrderId: 'PF-ACCEPT-PO-1', styleCode: 'SPU-QC-001',
    materialId: 'material-r1-MAT-FB-00000002', materialCode: 'MAT-FB-00000002',
    materialSkuId: 'material-r1-MAT-FB-00000002-B01', materialSkuCode: 'MAT-FB-00000002-B01', materialName: '白底蓝花棉布坯布',
    colorLabel: '本白', unit: 'Yard', imageUrl: '/materials/fei-ticket/white-poplin.png', imageLabel: '原料图（本白）',
    imageSha256: '458870c433109166715b3386fc95775f334ce482d8c122397965765f214cddf3' }),
  Object.freeze({ technicalVersionId: 'tdv_demand_SPU_QC_002', productionOrderId: 'PF-ACCEPT-PO-2', styleCode: 'SPU-QC-002',
    materialId: 'material_fabric_002', materialCode: 'FAB-COTTON-180',
    materialSkuId: 'material_fabric_002_sku_001', materialSkuCode: 'FAB-COTTON-180-WHT', materialName: '纯棉毛织布 180g',
    colorLabel: '白色', unit: '米', imageUrl: '/materials/pcs-reviewed/cotton-white.jpg', imageLabel: '原料图（白色）',
    imageSha256: 'e333b4f2b2b27e424333ed8b8ed0d947bba5f09537fc284aa27f54b077716cfc' }),
  Object.freeze({ technicalVersionId: 'tdv_demand_SPU_QC_003', productionOrderId: 'PF-ACCEPT-PO-3', styleCode: 'SPU-QC-003',
    materialId: 'material-r1-MAT-FB-00000001', materialCode: 'MAT-FB-00000001',
    materialSkuId: 'material-r1-MAT-FB-00000001-B01', materialSkuCode: 'MAT-FB-00000001-B01', materialName: '棉涤梭织坯布',
    colorLabel: '本色（本白坯布）', unit: 'Yard', imageUrl: '/materials/process-orders/greige-cotton-polyester-woven.jpg', imageLabel: '原料图（本色）',
    imageSha256: 'c697c6cb3c2f56dba292d372ee6a7c9ec9936a4f6333caf4ab5c0373d5db8ee8' }),
])

export function getLegacyQcDemoMaterialBinding(technicalVersionId: string): Readonly<LegacyQcMaterialDemoBinding> | undefined {
  return LEGACY_QC_MATERIAL_BINDINGS.find(row => row.technicalVersionId === technicalVersionId)
}

/**
 * Only the three shipped static source templates use this pure completion.
 * Persisted technical content / production / inspection snapshots never call it.
 * A missing or unexpected BOM is an error, never an invitation to guess a fabric.
 */
export function completeLegacyQcMaterialDemoContent(source: TechnicalDataVersionContent): TechnicalDataVersionContent | null {
  const binding = getLegacyQcDemoMaterialBinding(source.technicalVersionId)
  if (!binding) return null
  const bomId = binding.technicalVersionId + '-bom-main'
  if (source.bomItems.length !== 1 || source.bomItems[0].id !== bomId || source.bomItems[0].type !== '面料') {
    throw new Error('原三款静态演示主面料身份不完整，请核对原模板，未自动替换其他物料。')
  }
  const content = structuredClone(source)
  const remark = LEGACY_QC_MATERIAL_DEMO_REVISION + '：本期 MockBOM 原料归属补全；原料图仅用于组织/材质参考，成衣目标颜色按款色图；未生成染色或真实工厂用料事实。'
  const bom: TechPackBomItemSnapshot = { ...content.bomItems[0],
    name: binding.materialName, materialCode: binding.materialCode, materialSkuId: binding.materialSkuId, materialSkuCode: binding.materialSkuCode,
    spec: binding.colorLabel + '原料 · ' + binding.imageLabel + ' · 本期演示用料关系',
    colorLabel: binding.colorLabel, unit: binding.unit, supplier: '原型演示资料', remark,
    materialAlias: binding.imageLabel, materialImageUrl: binding.imageUrl,
  }
  content.bomItems = [bom]
  content.colorMaterialMappings = content.colorMaterialMappings.map(mapping => {
    const note = '成衣目标色：' + mapping.colorName + '；引用' + binding.colorLabel + '原料，仅为本期演示用料关系，不表示该料已染成' + mapping.colorName + '。'
    return { ...mapping, remark: note, lines: mapping.lines.map(line => ({ ...line,
      materialCode: binding.materialCode, materialName: binding.materialName, unit: binding.unit, note,
    })) }
  })
  content.patternFiles = content.patternFiles.map(file => ({ ...file,
    linkedMaterialId: binding.materialId, linkedMaterialSku: binding.materialSkuCode,
    linkedMaterialName: binding.materialName, linkedMaterialAlias: binding.imageLabel,
  }))
  return content
}
