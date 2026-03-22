import {
  currencyOptions,
  customCostUnitOptions,
  escapeHtml,
  materialUnitOptions,
  processUnitOptions,
  state,
} from './context'

export function renderCostTab(): string {
  const materialTotal = state.materialCostRows.reduce(
    (sum, row) => sum + row.usage * (Number.parseFloat(row.price) || 0),
    0,
  )
  const processTotal = state.processCostRows.reduce(
    (sum, row) => sum + (Number.parseFloat(row.price) || 0),
    0,
  )
  const customTotal = state.customCostRows.reduce(
    (sum, row) => sum + (Number.parseFloat(row.price) || 0),
    0,
  )
  const grandTotal = materialTotal + processTotal + customTotal

  return `
    <div class="space-y-6">
      <section class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">物料标准成本</h3>
        </header>
        <div class="p-4">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/30">
                <th class="px-3 py-2 text-left">物料名称</th>
                <th class="px-3 py-2 text-left">规格</th>
                <th class="px-3 py-2 text-right">单位用量</th>
                <th class="px-3 py-2 text-left">标准单价</th>
                <th class="px-3 py-2 text-left">币种</th>
                <th class="px-3 py-2 text-left">单位</th>
                <th class="px-3 py-2 text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              ${state.materialCostRows
                .map(
                  (row) => `
                    <tr class="border-b last:border-0">
                      <td class="px-3 py-2 font-medium">${escapeHtml(row.materialName)}</td>
                      <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(row.spec || '-')}</td>
                      <td class="px-3 py-2 text-right">${row.usage}</td>
                      <td class="px-3 py-2">
                        <input class="h-8 w-24 rounded border px-2 text-sm" type="number" value="${escapeHtml(row.price)}" placeholder="0.00" data-tech-field="material-price" data-row-id="${row.id}" />
                      </td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-24 rounded border px-2 text-sm" data-tech-field="material-currency" data-row-id="${row.id}">
                          ${currencyOptions
                            .map((option) => `<option value="${option}" ${row.currency === option ? 'selected' : ''}>${option}</option>`)
                            .join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-32 rounded border px-2 text-sm" data-tech-field="material-unit" data-row-id="${row.id}">
                          ${materialUnitOptions
                            .map((option) => `<option value="${option}" ${row.unit === option ? 'selected' : ''}>${option}</option>`)
                            .join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2 text-right font-medium">${(row.usage * (Number.parseFloat(row.price) || 0)).toFixed(2)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">工序标准成本</h3>
        </header>
        <div class="p-4">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/30">
                <th class="px-3 py-2 text-left">阶段</th>
                <th class="px-3 py-2 text-left">工序</th>
                <th class="px-3 py-2 text-left">工艺</th>
                <th class="px-3 py-2 text-left">标准单价</th>
                <th class="px-3 py-2 text-left">币种</th>
                <th class="px-3 py-2 text-left">单位</th>
                <th class="px-3 py-2 text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              ${state.processCostRows
                .map(
                  (row) => `
                    <tr class="border-b last:border-0">
                      <td class="px-3 py-2">${escapeHtml(row.stage)}</td>
                      <td class="px-3 py-2">${escapeHtml(row.process)}</td>
                      <td class="px-3 py-2 font-medium">${escapeHtml(row.technique)}</td>
                      <td class="px-3 py-2">
                        <input class="h-8 w-24 rounded border px-2 text-sm" type="number" value="${escapeHtml(row.price)}" placeholder="0.00" data-tech-field="process-price" data-row-id="${row.id}" />
                      </td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-24 rounded border px-2 text-sm" data-tech-field="process-currency" data-row-id="${row.id}">
                          ${currencyOptions
                            .map((option) => `<option value="${option}" ${row.currency === option ? 'selected' : ''}>${option}</option>`)
                            .join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-32 rounded border px-2 text-sm" data-tech-field="process-unit" data-row-id="${row.id}">
                          ${processUnitOptions
                            .map((option) => `<option value="${option}" ${row.unit === option ? 'selected' : ''}>${option}</option>`)
                            .join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2 text-right font-medium">${(Number.parseFloat(row.price) || 0).toFixed(2)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <h3 class="text-base font-semibold">自定义成本项</h3>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="add-custom-cost">
            <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
            添加成本项
          </button>
        </header>
        <div class="p-4">
          ${
            state.customCostRows.length === 0
              ? '<div class="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">暂无自定义成本项，可点击“添加成本项”补充开版费、包装补贴等</div>'
              : `
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/30">
                      <th class="px-3 py-2 text-left">成本项名称</th>
                      <th class="px-3 py-2 text-left">标准单价</th>
                      <th class="px-3 py-2 text-left">币种</th>
                      <th class="px-3 py-2 text-left">单位</th>
                      <th class="px-3 py-2 text-left">备注</th>
                      <th class="px-3 py-2 text-right">金额</th>
                      <th class="px-3 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.customCostRows
                      .map(
                        (row) => `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-2">
                              <input class="h-8 w-44 rounded border px-2 text-sm" value="${escapeHtml(row.name)}" placeholder="例如 开版费分摊" data-tech-field="custom-cost-name" data-row-id="${row.id}" />
                            </td>
                            <td class="px-3 py-2">
                              <input class="h-8 w-24 rounded border px-2 text-sm" type="number" value="${escapeHtml(row.price)}" placeholder="0.00" data-tech-field="custom-cost-price" data-row-id="${row.id}" />
                            </td>
                            <td class="px-3 py-2">
                              <select class="h-8 w-24 rounded border px-2 text-sm" data-tech-field="custom-cost-currency" data-row-id="${row.id}">
                                ${currencyOptions
                                  .map((option) => `<option value="${option}" ${row.currency === option ? 'selected' : ''}>${option}</option>`)
                                  .join('')}
                              </select>
                            </td>
                            <td class="px-3 py-2">
                              <select class="h-8 w-32 rounded border px-2 text-sm" data-tech-field="custom-cost-unit" data-row-id="${row.id}">
                                ${customCostUnitOptions
                                  .map((option) => `<option value="${option}" ${row.unit === option ? 'selected' : ''}>${option}</option>`)
                                  .join('')}
                              </select>
                            </td>
                            <td class="px-3 py-2">
                              <input class="h-8 w-48 rounded border px-2 text-sm" value="${escapeHtml(row.remark || '')}" placeholder="备注（可选）" data-tech-field="custom-cost-remark" data-row-id="${row.id}" />
                            </td>
                            <td class="px-3 py-2 text-right font-medium">${(Number.parseFloat(row.price) || 0).toFixed(2)}</td>
                            <td class="px-3 py-2">
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-custom-cost" data-row-id="${row.id}">
                                <i data-lucide="trash-2" class="h-4 w-4"></i>
                              </button>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `
          }
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-2 pt-4 text-sm text-muted-foreground">物料标准成本</header>
          <div class="px-4 pb-4">
            <p class="text-2xl font-semibold">${materialTotal.toFixed(2)}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-2 pt-4 text-sm text-muted-foreground">工序标准成本</header>
          <div class="px-4 pb-4">
            <p class="text-2xl font-semibold">${processTotal.toFixed(2)}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-2 pt-4 text-sm text-muted-foreground">自定义成本</header>
          <div class="px-4 pb-4">
            <p class="text-2xl font-semibold">${customTotal.toFixed(2)}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-2 pt-4 text-sm text-muted-foreground">总成本</header>
          <div class="px-4 pb-4">
            <p class="text-2xl font-semibold text-blue-700">${grandTotal.toFixed(2)}</p>
          </div>
        </article>
      </section>
    </div>
  `
}

