// @page-pattern: list
import { createPutawayLikePage } from './mahameru-putaway.ts'
import { mahameruWorkSeed } from './seed.ts'

// 作业单与上架单同构（作业单=上架单视角），复用同一构建器与列结构。
const page = createPutawayLikePage({
  eventPrefix: 'wls-online-mahameru-work',
  preferenceKey: '/wls/online/mahameru-work:list-columns',
  title: '作业单管理',
  listTitle: '作业单列表',
  rows: mahameruWorkSeed,
  description: '仅展示虚拟库位 WH-XNKC-001 的上架单',
})

export function renderTransitOnlineMahameruWorkPage(): string {
  return page.render()
}

export function handleTransitOnlineMahameruWorkEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
