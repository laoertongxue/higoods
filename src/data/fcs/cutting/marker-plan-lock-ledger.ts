export const CUTTING_MARKER_PLAN_LOCK_LEDGER_STORAGE_KEY = 'cuttingMarkerPlanLockLedger'

export type MarkerPlanMaterialLockStatus = '草稿锁定' | '有效锁定' | '已释放'

export interface MarkerPlanMaterialLockRecord {
  lockId: string
  markerPlanDraftId: string
  markerPlanNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  materialName: string
  materialColor: string
  materialAlias: string
  patternFileId: string
  lockedQty: number
  unit: string
  lockStatus: MarkerPlanMaterialLockStatus
  lockedAt: string
  operatorName: string
  releasedQty?: number
  releasedAt?: string
  releasedBy?: string
  releaseReason?: string
  confirmedAt?: string
  confirmedBy?: string
  markerNumbers?: string[]
}

function roundQty(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

export function deserializeMarkerPlanLockLedger(raw: string | null): MarkerPlanMaterialLockRecord[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => ({
        lockId: String(item?.lockId || ''),
        markerPlanDraftId: String(item?.markerPlanDraftId || ''),
        markerPlanNo: String(item?.markerPlanNo || ''),
        cutOrderId: String(item?.cutOrderId || ''),
        cutOrderNo: String(item?.cutOrderNo || ''),
        productionOrderId: String(item?.productionOrderId || ''),
        productionOrderNo: String(item?.productionOrderNo || ''),
        materialSku: String(item?.materialSku || ''),
        materialName: String(item?.materialName || ''),
        materialColor: String(item?.materialColor || ''),
        materialAlias: String(item?.materialAlias || ''),
        patternFileId: String(item?.patternFileId || ''),
        lockedQty: roundQty(Number(item?.lockedQty || 0)),
        unit: String(item?.unit || '米'),
        lockStatus: ['草稿锁定', '有效锁定', '已释放'].includes(String(item?.lockStatus || ''))
          ? String(item.lockStatus) as MarkerPlanMaterialLockStatus
          : '草稿锁定',
        lockedAt: String(item?.lockedAt || ''),
        operatorName: String(item?.operatorName || ''),
        releasedQty: Number.isFinite(Number(item?.releasedQty)) ? roundQty(Number(item.releasedQty)) : undefined,
        releasedAt: item?.releasedAt ? String(item.releasedAt) : undefined,
        releasedBy: item?.releasedBy ? String(item.releasedBy) : undefined,
        releaseReason: item?.releaseReason ? String(item.releaseReason) : undefined,
        confirmedAt: item?.confirmedAt ? String(item.confirmedAt) : undefined,
        confirmedBy: item?.confirmedBy ? String(item.confirmedBy) : undefined,
        markerNumbers: Array.isArray(item?.markerNumbers)
          ? item.markerNumbers.map((value: unknown) => String(value || '')).filter(Boolean)
          : undefined,
      }))
      .filter((item) => item.lockId && item.markerPlanDraftId && item.cutOrderId && item.lockedQty > 0)
  } catch {
    return []
  }
}

export function serializeMarkerPlanLockLedger(records: MarkerPlanMaterialLockRecord[]): string {
  return JSON.stringify(records)
}

export function listStoredMarkerPlanLockLedger(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): MarkerPlanMaterialLockRecord[] {
  if (!storage) return []
  return deserializeMarkerPlanLockLedger(storage.getItem(CUTTING_MARKER_PLAN_LOCK_LEDGER_STORAGE_KEY))
}

export function saveStoredMarkerPlanLockLedger(
  records: MarkerPlanMaterialLockRecord[],
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  if (!storage) return
  storage.setItem(CUTTING_MARKER_PLAN_LOCK_LEDGER_STORAGE_KEY, serializeMarkerPlanLockLedger(records))
}
