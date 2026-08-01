import type { FactoryWarehouseArea } from '../factory-internal-warehouse.ts'

type CuttingWarehouseKind = 'WAIT_PROCESS' | 'WAIT_HANDOVER'

interface CuttingWarehouseShelfSpec {
  shelfSequence: number
  positionCounts: number[]
}

interface CuttingWarehouseAreaSpec {
  code: string
  shelves: CuttingWarehouseShelfSpec[]
}

const CUTTING_WAREHOUSE_SPECS: Record<CuttingWarehouseKind, CuttingWarehouseAreaSpec[]> = {
  WAIT_PROCESS: [
    {
      code: 'A',
      shelves: [
        { shelfSequence: 1, positionCounts: [3, 3, 3, 3] },
        { shelfSequence: 2, positionCounts: [2, 2, 3] },
      ],
    },
    { code: 'B', shelves: [{ shelfSequence: 1, positionCounts: [1, 1, 1, 1] }] },
  ],
  WAIT_HANDOVER: [
    {
      code: 'A',
      shelves: [
        { shelfSequence: 1, positionCounts: [4, 4, 4, 4] },
        { shelfSequence: 2, positionCounts: [2, 2, 3, 2] },
      ],
    },
    { code: 'B', shelves: [{ shelfSequence: 1, positionCounts: [3, 3, 3] }] },
  ],
}

function assertSequence(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error(`${label}必须是 1 到 99 的整数。`)
  }
}

export function buildCuttingWarehouseLocationNo(
  areaCode: string,
  shelfSequence: number,
  levelNo: number,
  positionNo: number,
): string {
  if (!/^[A-Z]$/.test(areaCode)) throw new Error('库区代码必须是 A 到 Z 的单个大写字母。')
  assertSequence(shelfSequence, '货架序号')
  assertSequence(levelNo, '层号')
  assertSequence(positionNo, '层内位置号')
  const padded = (value: number) => String(value).padStart(2, '0')
  return `${areaCode}-R${padded(shelfSequence)}-L${padded(levelNo)}-P${padded(positionNo)}`
}

export function buildCuttingWarehouseAreaList(kind: CuttingWarehouseKind): FactoryWarehouseArea[] {
  const idPrefix = kind === 'WAIT_PROCESS' ? 'CUT-WP' : 'CUT-WH'
  return CUTTING_WAREHOUSE_SPECS[kind].map((areaSpec) => ({
    areaId: `${idPrefix}-AREA-${areaSpec.code}`,
    areaName: `${areaSpec.code}区`,
    code: areaSpec.code,
    shelfList: areaSpec.shelves.map((shelfSpec) => ({
      shelfId: `${idPrefix}-SHELF-${areaSpec.code}-R${String(shelfSpec.shelfSequence).padStart(2, '0')}`,
      shelfNo: `R${String(shelfSpec.shelfSequence).padStart(2, '0')}`,
      shelfName: `${areaSpec.code}区 R${String(shelfSpec.shelfSequence).padStart(2, '0')}`,
      shelfSequence: shelfSpec.shelfSequence,
      locationList: shelfSpec.positionCounts.flatMap((positionCount, levelIndex) =>
        Array.from({ length: positionCount }, (_, positionIndex) => {
          const levelNo = levelIndex + 1
          const positionNo = positionIndex + 1
          const locationNo = buildCuttingWarehouseLocationNo(
            areaSpec.code,
            shelfSpec.shelfSequence,
            levelNo,
            positionNo,
          )
          return {
            locationId: `${idPrefix}-LOC-${locationNo}`,
            locationNo,
            locationName: locationNo,
            levelNo,
            positionNo,
            status: 'AVAILABLE' as const,
            remark: '',
          }
        }),
      ),
      status: 'AVAILABLE',
      remark: '',
    })),
    status: 'AVAILABLE',
    remark: '',
  }))
}
