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
    <div class="space-y-4 p-6">
      <header>
        <h1 class="text-2xl font-bold">${escapeHtml(options.title)}</h1>
      </header>

      <section class="grid gap-4 lg:grid-cols-3">
        ${options.sections
          .map(
            (section) => `
              <article class="rounded-lg border bg-card">
                <header class="border-b px-5 py-4">
                  <h2 class="text-base font-semibold">${escapeHtml(section.title)}</h2>
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
