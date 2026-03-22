import { escapeHtml } from '../../utils'

interface ProcessFactorySection {
  title: string
  description: string
}

interface ProcessFactoryPageOptions {
  category: string
  title: string
  description: string
  sections: ProcessFactorySection[]
}

export function renderProcessFactoryScaffoldPage(options: ProcessFactoryPageOptions): string {
  return `
    <div class="space-y-6 p-6">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">工艺工厂运营系统 / ${escapeHtml(options.category)}</p>
        <h1 class="text-2xl font-bold">${escapeHtml(options.title)}</h1>
        <p class="mt-2 max-w-3xl text-sm text-muted-foreground">${escapeHtml(options.description)}</p>
      </div>

      <section class="grid gap-4 lg:grid-cols-3">
        ${options.sections
          .map(
            (section) => `
              <article class="rounded-lg border bg-card">
                <header class="border-b px-5 py-4">
                  <h2 class="text-base font-semibold">${escapeHtml(section.title)}</h2>
                  <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(section.description)}</p>
                </header>
                <div class="p-5">
                  <div class="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-muted bg-muted/20 text-sm text-muted-foreground">
                    预留业务内容区
                  </div>
                </div>
              </article>
            `,
          )
          .join('')}
      </section>
    </div>
  `
}
