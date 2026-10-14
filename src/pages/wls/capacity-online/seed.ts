// 产能统计（员工产能）演示数据。
// 6 个统计维度与测试环境结构同构，仅时间列名不同；每个维度给足 16 行演示数据。

export type CapacityRow = {
  id: string
  sku: string
  warehouse: string
  time: string
  account: string
  position: string
  output: string
  outputQty: number
}

/** 演示账号：印尼名与中文名混排，用于账号下拉与筛选演示。 */
export const CAPACITY_ACCOUNTS = ['Rina', 'Dian', 'Siti', '阿明']

/** 仓库下拉选项：全部 + 演示用的两个仓库。 */
export const CAPACITY_WAREHOUSE_OPTIONS = ['全部仓库', 'F&M WH', 'A&C WH']

// 16 个演示时间点（跨 4 天），保证起止时间筛选能看到差异。
const TIME_POOL = [
  '2026-06-01 08:30',
  '2026-06-01 09:15',
  '2026-06-01 10:40',
  '2026-06-01 13:20',
  '2026-06-01 14:05',
  '2026-06-01 15:30',
  '2026-06-02 08:25',
  '2026-06-02 10:10',
  '2026-06-02 11:45',
  '2026-06-02 13:50',
  '2026-06-02 16:15',
  '2026-06-03 09:05',
  '2026-06-03 11:20',
  '2026-06-03 14:35',
  '2026-06-04 08:40',
  '2026-06-04 15:10',
]

function makeRows(
  route: string,
  position: string,
  outputs: number[],
  unit: string,
  yardIndexes: number[] = [],
): CapacityRow[] {
  const suffix = route.split('/').pop() || 'capacity'
  return outputs.map((value, index) => ({
    id: `${suffix}-${String(index + 1).padStart(2, '0')}`,
    sku: `SKU-${suffix.slice(0, 6).toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
    warehouse: index % 2 === 0 ? 'F&M WH' : 'A&C WH',
    time: TIME_POOL[index] ?? TIME_POOL[TIME_POOL.length - 1],
    account: CAPACITY_ACCOUNTS[index % CAPACITY_ACCOUNTS.length],
    position,
    output: `${value} ${yardIndexes.includes(index) ? 'Yard' : unit}`,
    outputQty: value,
  }))
}

/** 每个统计维度 16 行演示数据，键为路由。 */
export const CAPACITY_SEED: Record<string, CapacityRow[]> = {
  '/wls/online/capacity-return': makeRows(
    '/wls/online/capacity-return', '收货员',
    [120, 98, 150, 110, 86, 132, 105, 140, 96, 118, 124, 88, 142, 101, 115, 130], '件',
  ),
  '/wls/online/capacity-return-in': makeRows(
    '/wls/online/capacity-return-in', '上架员',
    [350, 96, 280, 120, 410, 105, 320, 88, 260, 130, 300, 95, 375, 110, 265, 340], '件', [0, 2, 4, 6, 8, 10, 12, 14],
  ),
  '/wls/online/capacity-putaway': makeRows(
    '/wls/online/capacity-putaway', '上架员',
    [142, 388, 118, 305, 96, 420, 128, 276, 134, 312, 108, 402, 90, 268, 146, 330], '件', [1, 3, 5, 7, 9, 11, 13, 15],
  ),
  '/wls/online/capacity-count': makeRows(
    '/wls/online/capacity-count', '盘点员',
    [180, 240, 156, 210, 198, 224, 172, 260, 165, 232, 188, 205, 176, 248, 160, 218], '件',
  ),
  '/wls/online/capacity-pick': makeRows(
    '/wls/online/capacity-pick', '拣货员',
    [210, 186, 245, 168, 198, 232, 176, 260, 154, 224, 205, 172, 238, 190, 166, 250], '件',
  ),
  '/wls/online/capacity-ship': makeRows(
    '/wls/online/capacity-ship', '发货员',
    [96, 132, 78, 145, 110, 88, 126, 74, 140, 102, 84, 128, 70, 136, 108, 92], '单',
  ),
}
