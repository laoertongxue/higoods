import { escapeHtml } from '../utils'

const RULES = [
  '印花加工单必须手工创建。',
  '创建方式统一为：按需求创建 / 按备货创建。',
  '一个加工单允许同时关联多张需求单。',
  '需求必须全量满足后，才能进入下一工序。',
]

const MODULES = [
  '加工单手工创建入口',
  '按需求创建（只读占位）',
  '按备货创建（只读占位）',
  '需求关联清单（多需求关联）',
  '回货批次绑定与满足状态',
  '加工单状态轨迹',
]

export function renderProcessPrintOrdersPage(): string {
  return `
    <div class="space-y-6 p-6">
      <section class="rounded-xl border bg-card p-5">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">任务编排与执行准备</p>
        <h1 class="mt-1 text-2xl font-bold">印花加工单</h1>
        <p class="mt-2 text-sm text-muted-foreground">手工创建的执行层单据，承接印花需求的执行组织与回货关联。</p>
      </section>

      <section class="rounded-xl border bg-card p-5">
        <h2 class="text-base font-semibold">规则说明</h2>
        <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
          ${RULES.map((item) => `<li class="flex items-start gap-2"><span class="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500"></span><span>${escapeHtml(item)}</span></li>`).join('')}
        </ul>
      </section>

      <section class="rounded-xl border bg-card p-5">
        <h2 class="text-base font-semibold">当前阶段承接范围</h2>
        <p class="mt-2 text-sm text-muted-foreground">对象来源：运营/跟单手工创建，支持按需求创建与按备货创建两种入口。</p>
        <p class="mt-1 text-sm text-muted-foreground">当前仅完成信息架构占位与说明承接，不含真实创建流程、表单提交与状态流转。</p>
      </section>

      <section class="rounded-xl border bg-card p-5">
        <h2 class="text-base font-semibold">后续补充模块（只读）</h2>
        <div class="mt-3 grid gap-2 md:grid-cols-2">
          ${MODULES.map((item) => `<div class="rounded-md border bg-muted/30 px-3 py-2 text-sm">${escapeHtml(item)}</div>`).join('')}
        </div>
      </section>

      <footer class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        占位页用于原型演示：先固定菜单与路由信息架构，后续再逐步补齐业务逻辑与数据交互。
      </footer>
    </div>
  `
}
