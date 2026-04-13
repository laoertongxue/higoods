import { escapeHtml } from '../utils'

type MaterialArchiveRow = {
  code: string
  name: string
  category: string
  supplier: string
  spec: string
  updatedAt: string
  status: string
}

function renderPageHeader(breadcrumb: string, title: string, description: string, actionLabel?: string): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs text-gray-500">${escapeHtml(breadcrumb)}</p>
        <h1 class="mt-2 text-2xl font-semibold">${escapeHtml(title)}</h1>
        <p class="mt-1 text-sm text-gray-500">${escapeHtml(description)}</p>
      </div>
      ${actionLabel ? `<button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50">${escapeHtml(actionLabel)}</button>` : ''}
    </header>
  `
}

function renderMaterialArchivePage(
  breadcrumb: string,
  title: string,
  description: string,
  rows: MaterialArchiveRow[],
): string {
  return `
    <div class="space-y-4">
      ${renderPageHeader(breadcrumb, title, description, `新建${title.replace('档案', '')}`)}
      <section class="grid gap-3 md:grid-cols-3">
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">档案总数</p><p class="mt-1 text-2xl font-semibold">${rows.length}</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">启用中</p><p class="mt-1 text-2xl font-semibold text-green-700">${rows.filter((row) => row.status === '启用').length}</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">近 30 天更新</p><p class="mt-1 text-2xl font-semibold text-blue-700">${rows.length}</p></article>
      </section>
      <section class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-center gap-3">
          <input class="h-9 min-w-[260px] flex-1 rounded-md border px-3 text-sm" value="" placeholder="搜索编码 / 名称 / 供应商" />
          <select class="h-9 rounded-md border px-3 text-sm"><option>全部状态</option><option>启用</option><option>停用</option></select>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-gray-50">重置筛选</button>
        </div>
      </section>
      <section class="overflow-hidden rounded-lg border bg-white">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-left text-gray-500">
              <th class="px-3 py-3 font-medium">档案编码</th>
              <th class="px-3 py-3 font-medium">名称</th>
              <th class="px-3 py-3 font-medium">分类</th>
              <th class="px-3 py-3 font-medium">规格</th>
              <th class="px-3 py-3 font-medium">供应商</th>
              <th class="px-3 py-3 font-medium">状态</th>
              <th class="px-3 py-3 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-3 py-3 font-medium">${escapeHtml(row.code)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.name)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.category)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.spec)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.supplier)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.status)}</td>
                    <td class="px-3 py-3 text-gray-500">${escapeHtml(row.updatedAt)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </section>
    </div>
  `
}

export function renderPcsFabricArchivePage(): string {
  return renderMaterialArchivePage(
    '物料档案 / 面料档案',
    '面料档案',
    '面向跨款复用的基础面料档案，承接款式技术包与成本核价引用。',
    [
      { code: 'FAB-2026-001', name: '数码印花雪纺', category: '印花梭织', supplier: '印尼印花厂', spec: '145cm / 90g', updatedAt: '2026-04-06 14:20', status: '启用' },
      { code: 'FAB-2026-009', name: '复古格纹毛呢', category: '毛呢', supplier: '苏州毛纺', spec: '150cm / 380g', updatedAt: '2026-04-05 18:10', status: '启用' },
      { code: 'FAB-2026-013', name: '纯色针织罗纹', category: '针织', supplier: '广州针织厂', spec: '100cm / 240g', updatedAt: '2026-04-01 09:30', status: '停用' },
    ],
  )
}

export function renderPcsAccessoryArchivePage(): string {
  return renderMaterialArchivePage(
    '物料档案 / 辅料档案',
    '辅料档案',
    '统一维护拉链、纽扣、唛标、吊牌等跨款复用辅料档案。',
    [
      { code: 'ACC-2026-013', name: '隐形拉链', category: '拉链', supplier: '东莞辅料厂', spec: '7 寸 / 米白', updatedAt: '2026-04-07 10:15', status: '启用' },
      { code: 'ACC-2026-021', name: '树脂纽扣', category: '纽扣', supplier: '义乌钮扣厂', spec: '18L / 琥珀色', updatedAt: '2026-04-03 11:42', status: '启用' },
      { code: 'ACC-2026-033', name: '织唛主标', category: '商标', supplier: '中山唛头厂', spec: '45mm × 20mm', updatedAt: '2026-04-02 15:08', status: '启用' },
    ],
  )
}

export function renderPcsConsumableArchivePage(): string {
  return renderMaterialArchivePage(
    '物料档案 / 耗材档案',
    '耗材档案',
    '承接包装袋、贴纸、挂钩、防尘袋等跨款通用耗材档案。',
    [
      { code: 'CON-2026-006', name: '防尘袋', category: '包装耗材', supplier: '深圳包材厂', spec: '透明 / 中号', updatedAt: '2026-04-08 09:10', status: '启用' },
      { code: 'CON-2026-011', name: '条码贴', category: '标识耗材', supplier: '东莞印刷厂', spec: '40mm × 25mm', updatedAt: '2026-04-04 16:20', status: '启用' },
      { code: 'CON-2026-018', name: '衣架挂钩', category: '陈列耗材', supplier: '义乌陈列厂', spec: '黑色 / 通用', updatedAt: '2026-03-29 13:40', status: '停用' },
    ],
  )
}

export function renderPcsCodingRulesPage(): string {
  return `
    <div class="space-y-4">
      ${renderPageHeader('商品档案 / 编码规则', '编码规则', '统一维护款式、规格、渠道商品等档案编码的生成口径。')}
      <section class="grid gap-3 md:grid-cols-3">
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">启用规则</p><p class="mt-1 text-2xl font-semibold">4</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">待调整规则</p><p class="mt-1 text-2xl font-semibold text-amber-700">1</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">最近修改</p><p class="mt-1 text-sm font-semibold">2026-04-08 18:20</p></article>
      </section>
      <section class="overflow-hidden rounded-lg border bg-white">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-left text-gray-500">
              <th class="px-3 py-3 font-medium">对象</th>
              <th class="px-3 py-3 font-medium">编码规则</th>
              <th class="px-3 py-3 font-medium">示例</th>
              <th class="px-3 py-3 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            ${[
              ['款式档案', 'STYLE-年月日-流水号', 'STYLE-20260409-001', '款式档案以主对象建档，编码全局唯一'],
              ['规格档案', 'SPEC-款式编码-颜色-尺码', 'SPEC-STYLE-20260409-001-RED-M', '规格档案围绕款式展开'],
              ['渠道商品', 'CHANNEL-渠道-平台商品号', 'CHANNEL-TK-1038841', '便于回溯渠道平台对象'],
              ['部位模板', 'PART-模板包-部位序号', 'PART-TPL-20260401-03', '保持按裁片部位拆分后的唯一性'],
            ]
              .map(
                ([objectName, rule, example, note]) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-3 py-3 font-medium">${escapeHtml(objectName)}</td>
                    <td class="px-3 py-3">${escapeHtml(rule)}</td>
                    <td class="px-3 py-3 font-mono text-xs">${escapeHtml(example)}</td>
                    <td class="px-3 py-3 text-gray-500">${escapeHtml(note)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </section>
    </div>
  `
}

export function renderPcsCostParametersPage(): string {
  return `
    <div class="space-y-4">
      ${renderPageHeader('系统设置 / 成本参数', '成本参数', '成本参数从款式档案外统一维护，作为成本核价计算的全局参考。')}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">生效参数组</p><p class="mt-1 text-2xl font-semibold">6</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">印尼站点系数</p><p class="mt-1 text-2xl font-semibold text-blue-700">1.08</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">样衣损耗系数</p><p class="mt-1 text-2xl font-semibold text-amber-700">3.5%</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-gray-500">最近更新时间</p><p class="mt-1 text-sm font-semibold">2026-04-08 19:10</p></article>
      </section>
      <section class="overflow-hidden rounded-lg border bg-white">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-left text-gray-500">
              <th class="px-3 py-3 font-medium">参数组</th>
              <th class="px-3 py-3 font-medium">参数项</th>
              <th class="px-3 py-3 font-medium">当前值</th>
              <th class="px-3 py-3 font-medium">适用范围</th>
            </tr>
          </thead>
          <tbody>
            ${[
              ['站点系数', '印尼站点加工系数', '1.08', '海外站点'],
              ['站点系数', '深圳站点加工系数', '1.00', '国内站点'],
              ['损耗参数', '首版样衣打样损耗', '3.5%', '样衣阶段'],
              ['损耗参数', '产前版样衣损耗', '2.2%', '产前确认'],
              ['经营参数', '默认目标毛利', '55%', '服饰常规款'],
            ]
              .map(
                ([group, item, value, scope]) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-3 py-3 font-medium">${escapeHtml(group)}</td>
                    <td class="px-3 py-3">${escapeHtml(item)}</td>
                    <td class="px-3 py-3">${escapeHtml(value)}</td>
                    <td class="px-3 py-3 text-gray-500">${escapeHtml(scope)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </section>
    </div>
  `
}
