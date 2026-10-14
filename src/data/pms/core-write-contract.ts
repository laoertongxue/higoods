import { PmsDomainError } from './runtime.ts'
/** Business input only: generated dates and journal entries are outside a retry signature. */
export function pmsCoreOperationSignature(action: string, input: unknown): string {
  return JSON.stringify({ action, input })
}
export function assertPmsCoreDraftVersion(record: { _pmsBaseVersion?: number }, expected?: number): void {
  if (expected !== undefined && (record._pmsBaseVersion ?? 0) !== expected) throw new PmsDomainError('PMS_IDB_CONFLICT', '记录已在其他页面更新。请关闭表单、重新读取后再修改。当前输入尚未保存。')
}

export function pmsCoreStableCode(value: string): string {let hash=2166136261;for(let index=0;index<value.length;index+=1)hash=Math.imul(hash^value.charCodeAt(index),16777619);return(hash>>>0).toString(36).toUpperCase().padStart(7,'0')}
