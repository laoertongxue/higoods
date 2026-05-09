export interface CuttingTableResource {
  cuttingTableId: string
  cuttingTableNo: string
  cuttingTableName: string
  status: '空闲' | '已排程' | '铺布中' | '保养中' | '停用'
  widthLimitCm: number
  currentSchemeId?: string
  currentSchemeNo?: string
  currentBedId?: string
  currentBedNo?: string
  currentSpreadingSessionId?: string
  nextAvailableAt?: string
  remark?: string
}

export const DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES = 45

export const cuttingTableResources: CuttingTableResource[] = Array.from({ length: 7 }, (_, index) => {
  const serial = index + 1
  return {
    cuttingTableId: `cutting-table-${serial}`,
    cuttingTableNo: `裁床${serial}`,
    cuttingTableName: `裁床${serial}`,
    status: '空闲',
    widthLimitCm: 180,
    nextAvailableAt: '现在',
    remark: '',
  }
})

export function findCuttingTableById(cuttingTableId: string): CuttingTableResource | null {
  return cuttingTableResources.find((table) => table.cuttingTableId === cuttingTableId) || null
}

export function getDefaultCuttingTable(): CuttingTableResource {
  return cuttingTableResources[0]
}
