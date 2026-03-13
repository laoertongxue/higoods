import { escapeHtml } from '../utils'

function renderTracePlaceholderPage(title: string, description: string): string {
  return `
    <div class="p-6">
      <div class="mb-6">
        <p class="mb-1 text-sm text-muted-foreground">成衣溯源管理</p>
        <h1 class="text-2xl font-bold">${escapeHtml(title)}</h1>
      </div>

      <article class="rounded-lg border bg-card text-card-foreground shadow-sm">
        <header class="flex flex-col space-y-1.5 p-6">
          <h2 class="text-2xl font-semibold leading-none tracking-tight">${escapeHtml(title)}</h2>
          <p class="text-sm text-muted-foreground">${escapeHtml(description)}</p>
        </header>
        <div class="p-6 pt-0">
          <div class="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted bg-muted/30">
            <p class="text-muted-foreground">页面内容开发中...</p>
          </div>
        </div>
      </article>
    </div>
  `
}

export function renderTraceParentCodesPage(): string {
  return renderTracePlaceholderPage(
    '扎包/周转包父码管理',
    '管理生产过程中的扎包和周转包父码，建立生产批次的追溯基础。',
  )
}

export function renderTraceUniqueCodesPage(): string {
  return renderTracePlaceholderPage(
    '唯一码管理',
    '管理成衣的唯一标识码，实现单品级别的全流程追溯。',
  )
}

export function renderTraceMappingPage(): string {
  return renderTracePlaceholderPage(
    '父子码映射',
    '管理父码与子码之间的映射关系，支持批量绑定和解绑操作。',
  )
}

export function renderTraceUnitPricePage(): string {
  return renderTracePlaceholderPage(
    '单价追溯查询',
    '根据唯一码追溯单品的生产成本和加工单价，支持成本分析。',
  )
}
