import { pcsRecordStore } from './pcs-record-runtime.ts'
import { listMaterialTemplates } from './pcs-material-config.ts'
import type { ConfigLog } from './pcs-config-dimensions.ts'

export type SimpleMaterialKind = 'consumable' | 'parts'
export interface SimpleMaterialCategory {
  id: string; kind: SimpleMaterialKind; code: string; name: string; sortOrder: number
  enabled: boolean; remark: string; updatedAt: string; updatedBy: string; logs: ConfigLog[]
}
export interface SimpleMaterialCategoryInput {
  id?: string; kind: SimpleMaterialKind; code?: string; name: string; sortOrder: number
  enabled: boolean; remark?: string
}
export const PCS_SIMPLE_MATERIAL_CATEGORY_KEY = 'higood-pcs-simple-material-categories-v1'
export function isSimpleMaterialKind(kind: string): kind is SimpleMaterialKind { return kind === 'consumable' || kind === 'parts' }

/** Stable legacy category identities are a read projection, never a migration write. */
export function listSimpleMaterialCategoryBaseline(): SimpleMaterialCategory[] {
  const latest = new Map<string, ReturnType<typeof listMaterialTemplates>[number]>()
  for (const item of listMaterialTemplates()) if (isSimpleMaterialKind(item.kind) && item.status === 'APPROVED') {
    const prior = latest.get(item.categoryId!)
    if (!prior || item.version > prior.version) latest.set(item.categoryId!, item)
  }
  return [...latest.values()].map((item, index) => ({ id: item.categoryId!, kind: item.kind as SimpleMaterialKind,
    code: item.categoryCode!, name: item.category, sortOrder: index + 1, enabled: item.enabled !== false,
    remark: '', updatedAt: item.updatedAt, updatedBy: item.updatedBy, logs: [] }))
}
let categoryRead: {raw:string|null;config:string|null;rows:SimpleMaterialCategory[]} | undefined
export function listSimpleMaterialCategories(kind?: SimpleMaterialKind): SimpleMaterialCategory[] {
  const raw = pcsRecordStore.getItem(PCS_SIMPLE_MATERIAL_CATEGORY_KEY)
  const config=raw?null:pcsRecordStore.getItem('higood-pcs-material-config-v1')
  if(!categoryRead || categoryRead.raw!==raw || categoryRead.config!==config){
    const source = raw ? JSON.parse(raw) : { version: 1, categories: listSimpleMaterialCategoryBaseline() }
    if (source.version !== 1 || !Array.isArray(source.categories)) throw new Error('耗材与配件分类暂时无法读取，请重新读取。')
    categoryRead={raw,config,rows:source.categories}
  }
  return structuredClone(categoryRead.rows.filter(item => !kind || item.kind === kind))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
}
export function getSimpleMaterialCategory(id: string): SimpleMaterialCategory | undefined {
  return listSimpleMaterialCategories().find(item => item.id === id)
}
/** Called by the existing PCS record command; the command owns transaction completion and conflicts. */
export function saveSimpleMaterialCategory(input: SimpleMaterialCategoryInput, operator = '当前用户'): SimpleMaterialCategory {
  if (!isSimpleMaterialKind(input.kind)) throw new Error('简单分类仅用于耗材和配件。')
  const rows = listSimpleMaterialCategories(), current = input.id ? rows.find(item => item.id === input.id) : undefined
  if (input.id && !current) throw new Error('分类不存在，请重新读取。')
  const prefix = `MC-${input.kind.toUpperCase()}-`
  let sequence = Math.max(0, ...rows.filter(item => item.kind === input.kind).map(item => {
    const match = new RegExp(`^${prefix}(\\d+)$`, 'i').exec(item.code)
    return match ? Number(match[1]) : 0
  })) + 1
  let generatedCode = `${prefix}${sequence}`
  while (rows.some(item => item.code.toLowerCase() === generatedCode.toLowerCase())) generatedCode = `${prefix}${++sequence}`
  const code = current ? (input.code ?? current.code).trim() : generatedCode, name = input.name.trim(), remark = input.remark?.trim() || ''
  if (!name || name.length > 80) throw new Error('分类名称必填，最多 80 个字符。')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(code) || code.length > 80) throw new Error('分类编码使用字母、数字、点、下划线或短横线，最多 80 个字符。')
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) throw new Error('排序请输入非负整数。')
  if (typeof input.enabled !== 'boolean') throw new Error('请选择有效的启停状态。')
  if (remark.length > 500) throw new Error('分类说明最多 500 个字符。')
  if (current && (current.kind !== input.kind || current.code !== code)) throw new Error('已有分类的大类和编码不能修改。')
  if (rows.some(item => item.id !== input.id && item.code.toLowerCase() === code.toLowerCase())) throw new Error('分类编码已存在。')
  if (rows.some(item => item.id !== input.id && item.kind === input.kind && item.name.toLowerCase() === name.toLowerCase())) throw new Error('同一大类下的分类名称已存在。')
  const time = new Date().toLocaleString('sv-SE'), id = current?.id || `material-category-${input.kind}-${crypto.randomUUID()}`
  const saved: SimpleMaterialCategory = { id, kind: input.kind, code, name, sortOrder: input.sortOrder, enabled: input.enabled,
    remark, updatedAt: time, updatedBy: operator, logs: [...(current?.logs || []), { id: crypto.randomUUID(), time,
      action: current ? current.enabled !== input.enabled ? input.enabled ? '启用分类' : '停用分类' : '编辑分类' : '新增分类',
      detail: `${input.kind === 'parts' ? '配件' : '耗材'}分类「${name}」`, operator, operatorId: 'pcs-prototype-user',
      changes: current ? (['name', 'sortOrder', 'enabled', 'remark'] as const).filter(key => current[key] !== ({ name, sortOrder: input.sortOrder, enabled: input.enabled, remark })[key])
        .map(key => ({ field: ({ name: '名称', sortOrder: '排序', enabled: '启停状态', remark: '说明' })[key], before: current[key], after: ({ name, sortOrder: input.sortOrder, enabled: input.enabled, remark })[key] })) : [] }] }
  pcsRecordStore.setItem(PCS_SIMPLE_MATERIAL_CATEGORY_KEY, JSON.stringify({ version: 1, categories: [...rows.filter(item => item.id !== id), saved] }))
  return structuredClone(saved)
}
export function getSimpleMaterialCategoryUsage(id: string): Array<{ id: string; label: string; href: string }> {
  const category = getSimpleMaterialCategory(id)
  if (!category) return []
  const raw = pcsRecordStore.getItem('higood-pcs-material-archive-store-v2')
  const roots = raw ? JSON.parse(raw).records : []
  if (!Array.isArray(roots)) throw new Error('物料引用暂时无法读取，请重新读取。')
  const sameKind = roots.filter(item => item.kind === category.kind)
  const names = new Set([category.name])
  // Older archives may predate subcategoryId. Read their actual categoryName
  // and the adopted legacy category names without rewriting the archive.
  if (sameKind.some(item => !item.subcategoryId && !item.categoryId)) {
    for (const template of listMaterialTemplates()) if (template.categoryId === id) names.add(template.category)
    for (const log of category.logs) for (const change of log.changes || []) if (change.field === '名称') {
      if (typeof change.before === 'string') names.add(change.before)
      if (typeof change.after === 'string') names.add(change.after)
    }
  }
  return sameKind.filter(item => {
    const categoryId = item.subcategoryId || item.categoryId
    return categoryId ? categoryId === id : names.has(item.categoryName)
  })
    .map(item => ({ id: item.materialId, label: `${item.materialCode} · ${item.materialName}`, href: `/pcs/materials/${category.kind}/${encodeURIComponent(item.materialId)}` }))
}
