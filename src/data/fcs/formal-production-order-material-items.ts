import type {
  FormalProductionOrderMaterialItem,
  FormalProductionOrderProcessSnapshot,
} from './process-work-order-domain.ts'

type MaterialSnapshotFields = Pick<
  FormalProductionOrderProcessSnapshot,
  'materialId' | 'materialName' | 'materialItems'
>

export function cloneFormalProductionOrderMaterialItems(
  items: FormalProductionOrderMaterialItem[],
): FormalProductionOrderMaterialItem[] {
  return items.map((item) => ({ ...item }))
}

export function normalizeFormalProductionOrderMaterialItems(
  snapshot: MaterialSnapshotFields,
): FormalProductionOrderMaterialItem[] {
  if (snapshot.materialItems?.length) return cloneFormalProductionOrderMaterialItems(snapshot.materialItems)
  return [{
    sourceBomItemId: snapshot.materialId,
    materialId: snapshot.materialId,
    materialName: snapshot.materialName,
  }]
}

export function deriveFormalProductionOrderMaterialFields(
  materialItems: FormalProductionOrderMaterialItem[],
): { materialId: string; materialName: string } {
  return {
    materialId: materialItems.map((item) => item.materialId).join('+'),
    materialName: materialItems.map((item) => item.materialName).join('、'),
  }
}
