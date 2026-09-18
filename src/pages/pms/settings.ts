import type { StandardListColumn } from '../../components/ui/list-table.ts'
import {
  listPmsSettingDictionaries,
  listPmsSettingRoles,
  listPmsSettingUsers,
  type PmsSettingDictionary,
  type PmsSettingRole,
  type PmsSettingUser,
} from '../../data/pms/settings.ts'
import { escapeHtml } from '../../utils.ts'
import { formatPmsTime, renderPmsStatusBadge } from './shared.ts'
import { createPmsResultListPage } from './result-list.ts'

const userColumns: StandardListColumn<PmsSettingUser>[] = [
  {
    key: 'user',
    title: '用户',
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.name,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.name)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.account)} · ${escapeHtml(row.userId)}</div>`,
  },
  {
    key: 'role',
    title: '角色 / 部门',
    width: 200,
    sortable: true,
    sortValue: (row) => row.roleName,
    render: (row) => `<div class="text-sm">${escapeHtml(row.roleName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.department)}</div>`,
  },
  {
    key: 'contact',
    title: '联系方式',
    width: 170,
    render: (row) => `<div class="text-sm">${escapeHtml(row.phone)}</div><div class="mt-1 text-xs text-slate-500">最近登录 ${escapeHtml(row.lastLoginAt)}</div>`,
  },
  {
    key: 'source',
    title: '来源',
    width: 150,
    render: (row) => `<div class="text-sm">${escapeHtml(row.source)}</div>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, row.status === '启用' ? 'green' : 'slate'),
  },
]

const roleColumns: StandardListColumn<PmsSettingRole>[] = [
  {
    key: 'role',
    title: '角色',
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.roleName,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.roleName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.roleCode)}</div>`,
  },
  {
    key: 'scope',
    title: '权限范围',
    width: 420,
    render: (row) => `<div class="text-xs leading-5 text-slate-600">${escapeHtml(row.scope)}</div>`,
  },
  {
    key: 'members',
    title: '成员数',
    width: 110,
    sortable: true,
    sortValue: (row) => row.memberCount,
    render: (row) => `<div class="text-sm tabular-nums">${row.memberCount} 人</div>`,
  },
  {
    key: 'source',
    title: '来源 / 更新',
    width: 200,
    render: (row) => `<div class="text-sm">${escapeHtml(row.source)}</div><div class="mt-1 text-xs text-slate-500">${formatPmsTime(row.updatedAt)}</div>`,
  },
]

const dictionaryColumns: StandardListColumn<PmsSettingDictionary>[] = [
  {
    key: 'dictionary',
    title: '字典项',
    width: 320,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.name,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.name)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.code)}</div>`,
  },
  {
    key: 'category',
    title: '分类',
    width: 160,
    sortable: true,
    sortValue: (row) => row.category,
    render: (row) => `<div class="text-sm">${escapeHtml(row.category)}</div>`,
  },
  {
    key: 'source',
    title: '来源',
    width: 160,
    sortable: true,
    sortValue: (row) => row.source,
    render: (row) => `<div class="text-sm">${escapeHtml(row.source)}</div>`,
  },
  {
    key: 'references',
    title: '引用数',
    width: 120,
    sortable: true,
    sortValue: (row) => row.referenceCount,
    render: (row) => `<div class="text-sm tabular-nums">${row.referenceCount}</div>`,
  },
  {
    key: 'status',
    title: '状态 / 更新',
    width: 200,
    render: (row) => `${renderPmsStatusBadge(row.status, row.status === '启用' ? 'green' : 'slate')}<div class="mt-1 text-xs text-slate-500">${formatPmsTime(row.updatedAt)}</div>`,
  },
]

const usersList = createPmsResultListPage<PmsSettingUser>({
  title: '用户管理',
  emptyText: '当前条件下暂无用户',
  exportName: '用户管理.csv',
  exportHeaders: ['用户ID', '姓名', '账号', '角色', '部门', '电话', '状态', '最近登录', '来源'],
  exportRow: (row) => [row.userId, row.name, row.account, row.roleName, row.department, row.phone, row.status, row.lastLoginAt, row.source],
  keywordPlaceholder: '姓名 / 账号 / 角色 / 部门',
  note: '结果展示页：用户与角色由平台统一维护',
  columns: userColumns,
  getRows: listPmsSettingUsers,
  searchValues: (row) => [row.name, row.account, row.roleName, row.department, row.userId],
  stats: (rows) => [
    { label: '用户总数', value: rows.length },
    { label: '启用', value: rows.filter((row) => row.status === '启用').length },
    { label: '采购角色', value: rows.filter((row) => row.roleName.includes('采购')).length },
    { label: '外部同步', value: rows.filter((row) => row.source !== '平台内置').length },
  ],
  preferenceKey: 'higood:list:/pms/users',
  eventPrefix: 'pms-usr',
  rootSelector: '[data-pms-usr-root]',
})

const rolesList = createPmsResultListPage<PmsSettingRole>({
  title: '角色权限',
  emptyText: '当前条件下暂无角色',
  exportName: '角色权限.csv',
  exportHeaders: ['角色编码', '角色名称', '权限范围', '成员数', '说明', '来源', '更新时间'],
  exportRow: (row) => [row.roleCode, row.roleName, row.scope, row.memberCount, row.description, row.source, row.updatedAt],
  keywordPlaceholder: '角色编码 / 名称 / 权限范围',
  note: '结果展示页：展示角色、范围与引用关系',
  columns: roleColumns,
  getRows: listPmsSettingRoles,
  searchValues: (row) => [row.roleCode, row.roleName, row.scope, row.description],
  stats: (rows) => [
    { label: '角色总数', value: rows.length },
    { label: '成员合计', value: rows.reduce((sum, row) => sum + row.memberCount, 0) },
    { label: '含结算权限', value: rows.filter((row) => row.scope.includes('对账') || row.scope.includes('付款')).length },
    { label: '来源类型', value: new Set(rows.map((row) => row.source)).size },
  ],
  preferenceKey: 'higood:list:/pms/roles',
  eventPrefix: 'pms-role',
  rootSelector: '[data-pms-role-root]',
})

const dictionariesList = createPmsResultListPage<PmsSettingDictionary>({
  title: '字典配置',
  emptyText: '当前条件下暂无字典',
  exportName: '字典配置.csv',
  exportHeaders: ['字典编码', '字典名称', '分类', '来源', '引用数', '状态', '更新时间'],
  exportRow: (row) => [row.code, row.name, row.category, row.source, row.referenceCount, row.status, row.updatedAt],
  keywordPlaceholder: '字典编码 / 名称 / 分类 / 来源',
  note: '结果展示页：展示字典项、来源与引用关系，不开放重维护',
  columns: dictionaryColumns,
  getRows: listPmsSettingDictionaries,
  searchValues: (row) => [row.code, row.name, row.category, row.source],
  stats: (rows) => [
    { label: '字典项', value: rows.length },
    { label: '启用', value: rows.filter((row) => row.status === '启用').length },
    { label: '平台内置', value: rows.filter((row) => row.source === '平台内置').length },
    { label: '引用合计', value: rows.reduce((sum, row) => sum + row.referenceCount, 0) },
  ],
  preferenceKey: 'higood:list:/pms/dictionaries',
  eventPrefix: 'pms-dict',
  rootSelector: '[data-pms-dict-root]',
})

export function renderPmsUsersPage(): string {
  return usersList.render()
}

export function handlePmsUsersEvent(target: HTMLElement): boolean {
  return usersList.handle(target)
}

export function closePmsUserOverlays(): boolean {
  return usersList.close()
}

export function renderPmsRolesPage(): string {
  return rolesList.render()
}

export function handlePmsRolesEvent(target: HTMLElement): boolean {
  return rolesList.handle(target)
}

export function closePmsRoleOverlays(): boolean {
  return rolesList.close()
}

export function renderPmsDictionariesPage(): string {
  return dictionariesList.render()
}

export function handlePmsDictionariesEvent(target: HTMLElement): boolean {
  return dictionariesList.handle(target)
}

export function closePmsDictionaryOverlays(): boolean {
  return dictionariesList.close()
}

export function handlePmsSettingsEvent(target: HTMLElement): boolean {
  return usersList.handle(target) || rolesList.handle(target) || dictionariesList.handle(target)
}

export function closePmsSettingsOverlays(): boolean {
  return usersList.close() || rolesList.close() || dictionariesList.close()
}
