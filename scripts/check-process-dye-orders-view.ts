import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const handlersSource = readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')

assert(
  handlersSource.includes("if (pathname.startsWith('/fcs/process/dye-orders'))"),
  'FCS 必须为染色加工单页面注册显式事件分发入口，确保查看与关闭详情事件不会落入通用处理链。',
)

const pageSource = readFileSync('src/pages/process-dye-orders.ts', 'utf8')
assert(pageSource.includes('data-dye-order-action="open-detail"'), '染色加工单列表必须提供查看详情动作。')
assert(pageSource.includes('data-dye-order-action="close-detail"'), '染色加工单详情必须提供关闭详情动作。')

console.log('process dye orders view check passed')
