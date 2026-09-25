import type { CuttingRuntimeEvent, CuttingRuntimeEventType } from './cutting-runtime-event-ledger.ts'
/** 裁后处理及其铺布裁剪来源的动作范围；共享旧账中其他工序仍由原模块负责。 */
export const MANAGED_CUTTING_EVENT_TYPES = new Set<CuttingRuntimeEventType>([
  '裁片单开工', '开始铺布', '完成铺布', '开始裁剪', '完成裁剪',
  '菲票装袋', '中转袋入仓', '交出装袋确认', '新增交出记录', '简易裁片交出',
  '中转袋拆袋重装', '中转袋回收', '中转袋报废', '特殊工艺交出', '特殊工艺回仓',
])
export const CUTTING_EVENT_SCOPE_RECORD = 'cutting-event-scope:post-cutting-v2'
export function isManagedCuttingEvent(event: CuttingRuntimeEvent): boolean {
  return MANAGED_CUTTING_EVENT_TYPES.has(event.eventType) || event.inventoryEffect?.inventoryScope === '裁床待交出仓'
}
