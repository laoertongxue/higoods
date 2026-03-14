import { escapeHtml } from '../utils'

const RULES = [
  '生产单依据技术包自动生成印花需求单。',
  '一张需求单只对应一条物料需求。',
  '需求单通过回货批次关联满足后完成。',
  '需求必须全量满足后，才能进入下一工序。',
]

const MODULES = [
  '需求单列表与基础信息',
  '需求来源快照（生产单 / 技术包）',
  '物料需求对应关系（只读）',
  '回货批次关联与满足度视图',
  '下一工序门禁提示',
]

export function renderProcessPrintRequirementsPage(): string {
  return `
    <div class="space-y-6 p-6">
      <section class="rounded-xl border bg-card p-5">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">任务编排与执行准备</p>
        <h1 class="mt-1 text-2xl font-bold">印花需求单</h1>
        <p class="mt-2 text-sm text-muted-foreground">生产单依据技术包自动生成的印花需求入口，用于承接需求满足与后续工序门禁判断。</p>
      </section>

      <section class="rounded-xl border bg-card p-5">
        <h2 class="text-base font-semibold">规则说明</h2>
        <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
          ${RULES.map((item) => `<li class="flex items-start gap-2"><span class="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500"></span><span>${escapeHtml(item)}</span></li>`).join('')}
        </ul>
      </section>

      <section class="rounded-xl border bg-card p-5">
        <h2 class="text-base font-semibold">当前阶段承接范围</h2>
        <p class="mt-2 text-sm text-muted-foreground">对象来源：生产单 + 技术包工艺信息，系统自动生成印花需求。</p>
        <p class="mt-1 text-sm text-muted-foreground">当前仅完成信息架构占位与说明承接，不含真实列表筛选、状态流转与批次闭环动作。</p>
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
