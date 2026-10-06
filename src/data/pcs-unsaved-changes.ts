// PCS 表单在本次路由离开前统一保护，避免导航 Tab 和菜单采用不同提示。
interface PcsUnsavedChanges { isDirty: () => boolean; discard: () => void }
const forms = new Map<string, PcsUnsavedChanges>()
export function registerPcsUnsavedChanges(key: string, form: PcsUnsavedChanges): void { forms.set(key, form) }
export function hasPcsUnsavedChanges(): boolean { return [...forms.values()].some(form => form.isDirty()) }
export function confirmPcsRouteLeave(from: string, to: string): boolean {
  if (from === to || !(from.startsWith('/pcs/') || from.startsWith('/fcs/process/material-plans'))) return true
  const dirty = [...forms.values()].filter(form => form.isDirty())
  if (!dirty.length) return true
  if (typeof window !== 'undefined' && !window.confirm('修改尚未保存，确定离开并放弃本次输入？')) return false
  dirty.forEach(form => form.discard())
  return true
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('beforeunload', event => {
  if (hasPcsUnsavedChanges()) { event.preventDefault(); event.returnValue = '' }
})
