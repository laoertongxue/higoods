import type {
  ProductionOrderTechPackSnapshot,
  TechPackBomItemSnapshot,
} from './production-tech-pack-snapshot-types.ts'

interface KolGotoTechPackFixture {
  styleImageUrl: string
  fabricImageUrl: string
  fabricFallback: Pick<TechPackBomItemSnapshot, 'name' | 'spec' | 'materialCode' | 'unit' | 'unitConsumption' | 'lossRate' | 'supplier'>
  accessoryFallback?: Pick<TechPackBomItemSnapshot, 'name' | 'spec' | 'materialCode' | 'unit' | 'unitConsumption' | 'lossRate' | 'supplier'> & {
    imageUrl: string
  }
}

const KOL_GOTO_TECH_PACK_FIXTURES: Record<string, KolGotoTechPackFixture> = {
  'SPU-2024-004': {
    styleImageUrl: '/tshirt-sample.jpg',
    fabricImageUrl: '/materials/fabric-main.jpg',
    fabricFallback: {
      name: '针织棉主面料',
      spec: 'White 纯棉针织布',
      materialCode: 'FABRIC-SPU-2024-004-MAIN',
      unit: '米',
      unitConsumption: 1.15,
      lossRate: 0.03,
      supplier: '冻结技术包 BOM',
    },
    accessoryFallback: {
      name: '领口罗纹辅料',
      spec: 'White 1×1 罗纹',
      materialCode: 'TRIM-SPU-2024-004-RIB',
      unit: '米',
      unitConsumption: 0.12,
      lossRate: 0.03,
      supplier: '冻结技术包 BOM',
      imageUrl: '/materials/fabric-contrast.jpg',
    },
  },
  'SPU-2024-011': {
    styleImageUrl: '/cardigan-sample.jpg',
    fabricImageUrl: '/materials/yarn-stitching.jpg',
    fabricFallback: {
      name: 'Cream 毛织主纱',
      spec: 'Cream 毛织用纱线',
      materialCode: 'YARN-SPU-2024-011-MAIN',
      unit: '千克',
      unitConsumption: 0.48,
      lossRate: 0.05,
      supplier: '冻结技术包 BOM',
    },
    accessoryFallback: {
      name: '洗护唛',
      spec: '毛织成衣洗护标签',
      materialCode: 'LABEL-SPU-2024-011-CARE',
      unit: '件',
      unitConsumption: 1,
      lossRate: 0.01,
      supplier: '冻结技术包 BOM',
      imageUrl: '/materials/accessory-label.jpg',
    },
  },
  'SPU-2024-015': {
    styleImageUrl: '/shirt-sample.jpg',
    fabricImageUrl: '/materials/fabric-contrast.jpg',
    fabricFallback: {
      name: 'White 亚麻主面料',
      spec: 'White 亚麻混纺面料',
      materialCode: 'FABRIC-SPU-2024-015-MAIN',
      unit: '米',
      unitConsumption: 1.2,
      lossRate: 0.03,
      supplier: '冻结技术包 BOM',
    },
    accessoryFallback: {
      name: '衬衫纽扣',
      spec: 'White 四眼树脂扣',
      materialCode: 'BUTTON-SPU-2024-015-WHITE',
      unit: '粒',
      unitConsumption: 8,
      lossRate: 0.02,
      supplier: '冻结技术包 BOM',
      imageUrl: '/materials/accessory-button.jpg',
    },
  },
  'SPU-TSHIRT-081': {
    styleImageUrl: '/tshirt-sample.jpg',
    fabricImageUrl: '/materials/fabric-main.jpg',
    fabricFallback: {
      name: '针织棉主面料',
      spec: 'White / Black 针织棉主面料',
      materialCode: 'FABRIC-SPU-TSHIRT-081-MAIN',
      unit: '米',
      unitConsumption: 1.2,
      lossRate: 0.03,
      supplier: '冻结技术包 BOM',
    },
  },
}

function cloneBomItem(item: TechPackBomItemSnapshot): TechPackBomItemSnapshot {
  return {
    ...item,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }
}

function resolveAccessoryImage(item: TechPackBomItemSnapshot): string {
  const identity = `${item.name} ${item.spec} ${item.materialCode || ''}`.toLowerCase()
  if (identity.includes('花边') || identity.includes('罗纹')) return '/materials/fabric-contrast.jpg'
  if (identity.includes('纽扣') || identity.includes('button')) return '/materials/accessory-button.jpg'
  if (identity.includes('唛') || identity.includes('标签') || identity.includes('label')) return '/materials/accessory-label.jpg'
  if (identity.includes('拉链') || identity.includes('zipper')) return '/materials/accessory-zipper.jpg'
  return item.materialImageUrl?.startsWith('/materials/') ? item.materialImageUrl : ''
}

/**
 * 仅修正当前原型中已知 KOL 演示生产单的冻结技术包素材。
 * 未命中的款式不生成兜底 BOM，仍由上游技术包完整性门禁负责。
 */
export function applyKolGotoTechPackFixture(
  spuCode: string,
  snapshot: ProductionOrderTechPackSnapshot | null,
): ProductionOrderTechPackSnapshot | null {
  if (!snapshot) return null
  const fixture = KOL_GOTO_TECH_PACK_FIXTURES[spuCode]
  if (!fixture) return snapshot

  let hasFabric = false
  const bomItems = snapshot.bomItems.map((sourceItem) => {
    const item = cloneBomItem(sourceItem)
    const runtimeType = String(item.type)
    const isLegacyFabric = runtimeType === '纱线' || runtimeType === '成衣'
    if (item.type === '面料' || isLegacyFabric) {
      hasFabric = true
      return {
        ...item,
        ...(isLegacyFabric ? fixture.fabricFallback : {}),
        type: '面料' as const,
        materialImageUrl: fixture.fabricImageUrl,
      }
    }
    if (item.type === '辅料') {
      return {
        ...item,
        materialImageUrl: resolveAccessoryImage(item),
      }
    }
    return item
  })

  if (!hasFabric) {
    bomItems.unshift({
      id: `${snapshot.sourceTechPackVersionId}-kol-fabric-main`,
      type: '面料',
      ...fixture.fabricFallback,
      applicableSkuCodes: [],
      linkedPatternIds: [],
      usageProcessCodes: [],
      materialImageUrl: fixture.fabricImageUrl,
    })
  }

  if (!bomItems.some((item) => item.type === '辅料') && fixture.accessoryFallback) {
    const { imageUrl, ...accessory } = fixture.accessoryFallback
    bomItems.push({
      id: `${snapshot.sourceTechPackVersionId}-kol-accessory-main`,
      type: '辅料',
      ...accessory,
      applicableSkuCodes: [],
      linkedPatternIds: [],
      usageProcessCodes: [],
      materialImageUrl: imageUrl,
    })
  }

  const materialImages = bomItems
    .filter((item) => item.type === '面料')
    .map((item) => item.materialImageUrl || '')
    .filter(Boolean)
  const accessoryImages = bomItems
    .filter((item) => item.type === '辅料')
    .map((item) => item.materialImageUrl || '')
    .filter(Boolean)

  return {
    ...snapshot,
    bomItems,
    imageSnapshot: {
      ...snapshot.imageSnapshot,
      styleImages: [fixture.styleImageUrl],
      materialImages,
      accessoryImages,
    },
  }
}
