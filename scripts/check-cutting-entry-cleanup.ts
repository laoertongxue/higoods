#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const MENU_FILE = 'src/data/app-shell-config.ts'
const ROUTES_FILE = 'src/router/routes.ts'
const STORE_FILE = 'src/state/store.ts'
const PLATFORM_ROUTE_FILES = [
  'src/domain/cutting-platform/overview.adapter.ts',
  'src/domain/cutting-platform/detail.adapter.ts',
  'src/pages/progress-cutting-overview.ts',
  'src/pages/progress-cutting-detail.ts',
  'src/pages/progress-cutting-exception-center.ts',
  'src/pages/settlement-cutting-input.ts',
]

const FORBIDDEN_MENU_KEYS = [
  'craft-cutting-closure',
  'craft-cutting-settlement-scoring',
  'craft-cutting-summary',
]

const FORBIDDEN_ROUTE_TARGETS = [
  '/fcs/craft/cutting/order-progress',
  '/fcs/craft/cutting/cut-piece-orders',
  '/fcs/craft/cutting/warehouse-management',
]

const FORBIDDEN_ACTIONS = [
  'go-order-progress',
  'go-cut-piece-orders',
  'go-warehouse-management',
]

const FORBIDDEN_BUTTON_COPY = [
  '去订单进度',
  '去裁片单',
  '去仓库管理',
]

const REQUIRED_ALIAS_REDIRECTS: Array<{ alias: string; target: string }> = [
  { alias: '/fcs/craft/cutting', target: '/fcs/craft/cutting/production-progress' },
  { alias: '/fcs/craft/cutting/order-progress', target: '/fcs/craft/cutting/production-progress' },
  { alias: '/fcs/craft/cutting/tasks', target: '/fcs/craft/cutting/production-progress' },
  { alias: '/fcs/craft/cutting/orders', target: '/fcs/craft/cutting/original-orders' },
  { alias: '/fcs/craft/cutting/cut-piece-orders', target: '/fcs/craft/cutting/original-orders' },
  { alias: '/fcs/craft/cutting/warehouse', target: '/fcs/craft/cutting/fabric-warehouse' },
  { alias: '/fcs/craft/cutting/warehouse-management', target: '/fcs/craft/cutting/fabric-warehouse' },
  { alias: '/fcs/craft/cutting/fei-ticket', target: '/fcs/craft/cutting/fei-tickets' },
  { alias: '/fcs/craft/cutting/fei-list', target: '/fcs/craft/cutting/fei-tickets' },
  { alias: '/fcs/craft/cutting/stats', target: '/fcs/craft/cutting/summary' },
  { alias: '/fcs/craft/cutting/bed-stats', target: '/fcs/craft/cutting/summary' },
  { alias: '/fcs/craft/cutting/cutting-summary', target: '/fcs/craft/cutting/summary' },
]

function readFile(file: string): string {
  return fs.readFileSync(path.resolve(file), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertNoIncludes(source: string, file: string, values: string[], label: string): void {
  for (const value of values) {
    assert(!source.includes(value), `${file} 仍残留${label}：${value}`)
  }
}

function assertAliasRoutesRedirect(): void {
  const source = readFile(ROUTES_FILE)
  for (const { alias, target } of REQUIRED_ALIAS_REDIRECTS) {
    const matcher = new RegExp(
      `'${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*\\(\\)\\s*=>\\s*renderRouteRedirect\\('${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`,
      'm',
    )
    assert(matcher.test(source), `routes.ts 中旧 alias 路由未正确 redirect：${alias} -> ${target}`)
  }
}

function assertWarehouseCompatRemoved(): void {
  const deletedFiles = [
    'src/pages/process-factory/cutting/warehouse-management.ts',
    'src/pages/process-factory/cutting/warehouse-management.helpers.ts',
  ]
  for (const file of deletedFiles) {
    assert(!fs.existsSync(path.resolve(file)), `旧入口文件仍存在：${file}`)
  }

  const routeSource = readFile(ROUTES_FILE)
  const cuttingIndexSource = readFile('src/pages/process-factory/cutting/index.ts')
  const processFactoryIndexSource = readFile('src/pages/process-factory/index.ts')
  const fcsHandlersSource = readFile('src/main-handlers/fcs-handlers.ts')
  assert(!routeSource.includes('renderCraftCuttingWarehouseManagementPage'), 'routes.ts 仍残留旧仓库总页 render')
  assert(!cuttingIndexSource.includes('warehouse-management'), 'cutting/index.ts 仍残留旧仓库总页导出')
  assert(!processFactoryIndexSource.includes('renderCraftCuttingWarehouseManagementPage'), 'process-factory/index.ts 仍残留旧仓库总页导出')
  assert(!fcsHandlersSource.includes('handleCraftCuttingWarehouseManagementEvent'), 'fcs-handlers.ts 仍残留旧仓库总页事件处理')
  assert(!fcsHandlersSource.includes('isCraftCuttingWarehouseManagementDialogOpen'), 'fcs-handlers.ts 仍残留旧仓库总页对话框关闭逻辑')
}

function main(): void {
  const menuSource = readFile(MENU_FILE)
  assertNoIncludes(menuSource, MENU_FILE, FORBIDDEN_MENU_KEYS, '旧菜单 key')

  for (const file of PLATFORM_ROUTE_FILES) {
    const source = readFile(file)
    assertNoIncludes(source, file, FORBIDDEN_ROUTE_TARGETS, '旧内部跳转路由')
    assertNoIncludes(source, file, FORBIDDEN_ACTIONS, '旧 action 名')
    assertNoIncludes(source, file, FORBIDDEN_BUTTON_COPY, '旧按钮文案')
  }

  const storeSource = readFile(STORE_FILE)
  assert(!storeSource.includes("'裁片结算与评分输入': '裁片结算评分'"), 'state/store.ts 仍通过旧标题保活结算页 tab')
  assert(!storeSource.includes("'裁片异常收口': '裁片后续管理'"), 'state/store.ts 仍通过旧标题保活裁片后续管理 tab')
  assert(!storeSource.includes("'裁剪总结': '裁剪总表'"), 'state/store.ts 仍通过旧标题保活裁剪总表 tab')

  assertAliasRoutesRedirect()
  assertWarehouseCompatRemoved()

  console.log(
    JSON.stringify(
      {
        菜单收口: '通过',
        路由收口: '通过',
        按钮与action收口: '通过',
        tab迁移收口: '通过',
        旧仓库总页清理: '通过',
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
