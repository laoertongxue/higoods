import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import { listSewingFactoriesWithoutActivePpic } from '../src/data/fcs/factory-master-store.ts'
import {
  buildSewingOutsourcingMigrationAuditReport,
  type SewingMigrationAuditCategory,
} from '../src/data/fcs/sewing-outsourcing-migration-audit.ts'
import { renderSewingOutsourcingMigrationAuditPage } from '../src/pages/sewing-outsourcing/migration-audit.ts'

const first = buildSewingOutsourcingMigrationAuditReport()
const second = buildSewingOutsourcingMigrationAuditReport()
assert.deepEqual(second, first, '重复执行历史审计必须幂等，不新增责任、回货或结算事实')
assert.equal(first.isReadOnly, true, '历史审计必须只读')
assert.equal(first.quantityBefore, first.quantityAfter, '历史核查前后有效分配数量必须守恒')
assert.equal(first.reportVersion, 'PPIC-MIGRATION-AUDIT-V1')
assert.deepEqual(listSewingFactoriesWithoutActivePpic(), [], '当前原型全部正式车缝工厂必须补齐唯一有效PPIC')
assert.equal(
  first.statusCounts.PASS + first.statusCounts.BLOCKED + first.statusCounts.MANUAL_REVIEW + first.statusCounts.READ_ONLY,
  first.items.length,
  '状态汇总必须与审计明细一致',
)
assert.ok(first.items.every((item) => item.recoveryAction.trim()), '每条历史审计结果都必须提供恢复动作或后续规则')
assert.ok(first.items.every((item) => item.sourceHref.startsWith('/')), '每条审计结果都必须能穿透到专业来源')

const expectedCategories: SewingMigrationAuditCategory[] = [
  'FACTORY_PPIC_IDENTITY',
  'TASK_RESPONSIBILITY',
  'RELEASE_ALLOCATION',
  'HISTORICAL_LINKAGE',
  'LEGACY_MULTI_FACTORY',
  'PCS_SAMPLE_NAMING',
]
for (const category of expectedCategories) assert.ok(first.items.some((item) => item.category === category), `缺少${category}历史治理结果`)
assert.ok(first.items.some((item) => item.category === 'HISTORICAL_LINKAGE' && item.status === 'MANUAL_REVIEW'), '无法唯一匹配的历史事实必须待人工确认')
assert.ok(first.items.some((item) => item.recoveryAction.includes('不得按工厂当前PPIC自动回填') || item.detail.includes('任务责任保持原版本')), '历史未完任务不得按工厂当前PPIC自动换人')
assert.ok(first.items.some((item) => item.category === 'PCS_SAMPLE_NAMING' && item.detail.includes('首单样衣') && item.detail.includes('批版建议')), 'PCS首单样衣与车缝批版建议命名边界必须保留')

const auditSource = readFileSync('src/data/fcs/sewing-outsourcing-migration-audit.ts', 'utf8')
for (const text of ['line.allocatedQty > line.releaseConfirmQty', '原分配和原放行均未被改写', '系统没有补造放行记录', '历史只读保留']) {
  assert.ok(auditSource.includes(text), `迁移审计缺少规则：${text}`)
}
const pcsFiles = [
  'src/pages/pcs-engineering-tasks.ts',
  'src/pages/pcs-engineering-tasks/first-sample-task.ts',
  'src/data/pcs-engineering-master-view-model.ts',
  'src/data/pcs-engineering-dependency-policy.ts',
].map((path) => readFileSync(path, 'utf8')).join('\n')
assert.ok(!pcsFiles.includes("title: '产前版样衣"), 'PCS用户可见任务标题不得继续误称产前版样衣')
assert.ok(pcsFiles.includes('首单样衣'), 'PCS用户可见名称必须是首单样衣')

const page = renderSewingOutsourcingMigrationAuditPage()
for (const text of ['车缝外发历史迁移审计', '历史只读', '原数量事实', '人工恢复／后续规则']) {
  assert.ok(page.includes(text), `迁移审计页面缺少：${text}`)
}
for (const removedBannerText of ['本报告只读', '数量守恒']) {
  assert.ok(!page.includes(removedBannerText), `迁移审计页不得恢复已删除的解释横幅：${removedBannerText}`)
}
const group = menusBySystem.fcs.find((item) => item.title === '车缝外发协同')!
assert.equal(group.items.length, 8, '迁移审计不得改变当前确认后的八个业务菜单入口')
assert.ok(!group.items.some((item) => item.href === '/fcs/sewing-outsourcing/migration-audit'), '迁移审计是负责人治理穿透页，不占业务菜单入口')
const taskPage = readFileSync('src/pages/sewing-outsourcing/tasks.ts', 'utf8')
assert.ok(taskPage.includes('/fcs/sewing-outsourcing/migration-audit'), '车缝任务页必须提供历史治理穿透入口')
const routes = readFileSync('src/router/routes-fcs.ts', 'utf8')
assert.ok(routes.includes("'/fcs/sewing-outsourcing/migration-audit'"), '迁移审计命名路由必须注册')

console.log('check-sewing-outsourcing-migration-audit: ok')
