// @page-pattern: list
import { createCuttingAllPage } from './hilon-cutting-all.ts'
import { mahameruCuttingSeed, cuttingAllCuttingFactoryOptions } from './seed.ts'

// 新中转仓裁片配料（与老中转仓 All 页同构，范围限新裁床中转仓 WH-BDG-009）。
const page = createCuttingAllPage({
  eventPrefix: 'wls-online-mahameru-cutting',
  preferenceKey: '/wls/online/mahameru-cutting:list-columns',
  title: '裁片配料（新中转仓 Mahameru）',
  listTitle: '裁片配料单',
  rows: mahameruCuttingSeed,
  factoryOptions: ['全部', '新中转仓 Mahameru'],
  cuttingFactoryOptions: cuttingAllCuttingFactoryOptions,
  description: '只读展示裁片配料明细，可打印配料、查看配料流水。',
  showMaterialType: true,
})

export function renderTransitOnlineMahameruCuttingPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruCuttingEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
