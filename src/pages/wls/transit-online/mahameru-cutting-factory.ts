// @page-pattern: list
import { createCuttingFactoryPage } from './hilon-cutting-factory.ts'
import { mahameruCuttingFactorySeed, mahameruCuttingFactoryOptions } from './seed.ts'

// 新中转仓裁片任务分配（与老中转仓同构，数据限定新中转仓）。
const page = createCuttingFactoryPage({
  eventPrefix: 'wls-online-mahameru-cutting-factory',
  preferenceKey: '/wls/online/mahameru-cutting-factory:list-columns',
  title: '裁片任务分配（新中转仓）',
  listTitle: '裁片任务分配',
  rows: mahameruCuttingFactorySeed,
  factoryOptions: mahameruCuttingFactoryOptions,
  description: '仅展示裁片任务尚未分配、且已配料未领料的生产单。承接工厂仅限 sea cutting 与 sea2-PPIC。',
})

export function renderTransitOnlineMahameruCuttingFactoryPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruCuttingFactoryEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
