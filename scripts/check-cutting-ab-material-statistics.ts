import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

Object.defineProperty(globalThis, 'window', {
  value: {
    location: {
      pathname: '/fcs/craft/cutting/statistics/ab-material',
      search: '',
    },
  },
  configurable: true,
})

const {
  buildCuttingAbMaterialExcelHtml,
  renderCraftCuttingAbMaterialStatisticsPage,
} = await import('../src/pages/process-factory/cutting/cutting-statistics-ab-material.ts')
const {
  buildCuttingAbMaterialReport,
  cuttingMaterialRoleOptions,
  listCuttingAbMaterialDetailRows,
  listCuttingAbMaterialSummaryRows,
  resolveCuttingMaterialRole,
} = await import('../src/pages/process-factory/cutting/cutting-statistics-ab-material-model.ts')

const appShellConfig = readFileSync(join(repoRoot, 'src/data/app-shell-config.ts'), 'utf8')
const metaSource = readFileSync(join(repoRoot, 'src/pages/process-factory/cutting/meta.ts'), 'utf8')
const routesSource = readFileSync(join(repoRoot, 'src/router/routes-fcs.ts'), 'utf8')
const rendererSource = readFileSync(join(repoRoot, 'src/router/route-renderers-fcs.ts'), 'utf8')
const handlersSource = readFileSync(join(repoRoot, 'src/main-handlers/fcs-handlers.ts'), 'utf8')

const summaryRows = listCuttingAbMaterialSummaryRows()
const detailRows = listCuttingAbMaterialDetailRows()
const report = buildCuttingAbMaterialReport()
const pageHtml = renderCraftCuttingAbMaterialStatisticsPage()
;(globalThis as any).window.location.search = '?tab=details'
const detailPageHtml = renderCraftCuttingAbMaterialStatisticsPage()
;(globalThis as any).window.location.search = ''
const excelHtml = buildCuttingAbMaterialExcelHtml()

const checks: Array<{ item: string; passed: boolean; detail: string }> = []
function check(item: string, detail: string, assertion: () => void): void {
  assertion()
  checks.push({ item, passed: true, detail })
}

check('菜单存在裁床统计', 'app-shell 左侧菜单新增裁床统计一级分组', () => {
  assert.ok(appShellConfig.includes("title: '裁床统计'"))
  assert.ok(appShellConfig.includes("href: '/fcs/craft/cutting/statistics/ab-material'"))
})

check('菜单存在20天待发裁床AB料', '裁床统计下新增20天待发裁床AB料二级菜单', () => {
  assert.ok(appShellConfig.includes("title: '20天待发裁床AB料'"))
})

check('页面有两个tab', '页面展示缺口排序与AB料明细两个tab', () => {
  assert.ok(pageHtml.includes('缺口排序'))
  assert.ok(pageHtml.includes('AB料明细'))
})

check('截图标注区域已删除', '删除面包屑、统计口径说明、列表标题公式说明', () => {
  assert.equal(pageHtml.includes('工艺工厂运营系统 / 裁床厂管理 / 裁床统计 / 20天待发裁床AB料'), false)
  assert.equal(pageHtml.includes('统计口径'), false)
  assert.equal(pageHtml.includes('缺口数量 = 20天内发货数量 - 已送工厂数量'), false)
})

check('tab与筛选统计顺序正确', 'tab在筛选条件上方，统计标签在筛选条件下方并随筛选结果联动', () => {
  const tabIndex = pageHtml.indexOf('缺口排序')
  const filterIndex = pageHtml.indexOf('name="keyword"')
  const statIndex = pageHtml.indexOf('data-testid="cutting-ab-stat-tags"')
  assert.ok(tabIndex > -1)
  assert.ok(filterIndex > -1)
  assert.ok(statIndex > -1)
  assert.ok(tabIndex < filterIndex)
  assert.ok(filterIndex < statIndex)
  const filteredReport = buildCuttingAbMaterialReport({ gapStatus: '超送' })
  assert.equal(filteredReport.summaryRows.every((row) => row.status === '超送'), true)
  assert.equal(filteredReport.totals.gapSpuCount, 0)
})

check('统计标签精简展示', '统计区使用紧凑标签样式，只保留标签和值', () => {
  assert.ok(pageHtml.includes('data-testid="cutting-ab-stat-tags"'))
  assert.ok(pageHtml.includes('bg-muted/40'))
  const statStart = pageHtml.indexOf('data-testid="cutting-ab-stat-tags"')
  const statEnd = pageHtml.indexOf('data-testid="cutting-ab-summary-table"')
  const statHtml = pageHtml.slice(statStart, statEnd)
  ;['统计日', '窗口', '缺口', '缺口SPU', '超送SPU', 'AB异常', '更新'].forEach((label) => assert.ok(statHtml.includes(label)))
  ;['缺口总数', '已超送SPU数', 'AB料异常数', '最后更新时间', '列表数据更新时间', '少裁或未识别属性明细'].forEach((text) => {
    assert.equal(statHtml.includes(text), false, text)
  })
})

check('筛选条件一行展示', '筛选表单使用横向单行布局，必要时横向滚动', () => {
  assert.ok(pageHtml.includes('overflow-x-auto'))
  assert.ok(pageHtml.includes('发货窗口'))
  assert.ok(pageHtml.includes('只看AB料异常'))
})

check('缺口排序展示SPU汇总', `汇总行数 ${summaryRows.length}`, () => {
  assert.ok(summaryRows.length >= 4)
  assert.ok(pageHtml.includes('data-testid="cutting-ab-summary-table"'))
})

check('缺口排序款式列已合并', '款式/SPU图、SPU、款式名称合并为款式/SPU一列', () => {
  const summaryTableHtml = pageHtml.slice(pageHtml.indexOf('data-testid="cutting-ab-summary-table"'))
  assert.ok(summaryTableHtml.includes('<th class="px-3 py-2 font-medium">款式/SPU</th>'))
  ;['款式/SPU图', '<th class="px-3 py-2 font-medium">SPU</th>', '款式名称'].forEach((head) => {
    assert.equal(summaryTableHtml.includes(head), false, head)
  })
})

check('缺口排序字段按新公式展示', '展示需发货、当前库存、已送未回、裁剪完成未送和20天内裁片缺口', () => {
  const summaryTableHtml = pageHtml.slice(pageHtml.indexOf('data-testid="cutting-ab-summary-table"'))
  ;['20天内需发货数量', '当前库存数量', '已送车缝厂未回货数量', '裁剪完成未送车缝厂数量', '20天内裁片缺口数量'].forEach((head) => {
    assert.ok(summaryTableHtml.includes(head), head)
  })
  ;['20天内发货数量', '已送车缝厂数量', '已送工厂数量', '20天待发裁片缺口数量'].forEach((head) => {
    assert.equal(summaryTableHtml.includes(head), false, head)
  })
})

check('AB料明细按生产单颜色属性展示', `明细行数 ${detailRows.length}`, () => {
  assert.ok(detailRows.length >= 12)
  assert.ok(detailPageHtml.includes('生产单号'))
  assert.ok(detailPageHtml.includes('属性'))
  assert.ok(detailPageHtml.includes('组内最大实际裁剪数量'))
})

check('AB料明细物料列与技术包纸样列正确', '物料图片/SKU/名称合并为物料列，后接关联技术包版本&纸样，再展示属性', () => {
  assert.ok(detailRows.every((row) => row.techPackVersionNo && row.patternName))
  const detailTableHtml = detailPageHtml.slice(detailPageHtml.indexOf('data-testid="cutting-ab-detail-table"'))
  const materialIndex = detailTableHtml.indexOf('物料')
  const techPackIndex = detailTableHtml.indexOf('关联技术包版本&amp;纸样')
  const roleIndex = detailTableHtml.indexOf('属性')
  assert.ok(materialIndex > -1)
  assert.ok(techPackIndex > -1)
  assert.ok(roleIndex > -1)
  assert.ok(materialIndex < techPackIndex)
  assert.ok(techPackIndex < roleIndex)
  ;['物料图片', '物料SKU', '物料名称'].forEach((head) => {
    assert.equal(detailTableHtml.includes(`<th class="px-3 py-2 font-medium">${head}</th>`), false, head)
  })
})

check('AB料明细不展示裁床工位列', 'AB料明细页面列表和导出明细均去掉裁床/工位列', () => {
  const detailTableHtml = detailPageHtml.slice(detailPageHtml.indexOf('data-testid="cutting-ab-detail-table"'))
  assert.equal(detailTableHtml.includes('<th class="px-3 py-2 font-medium">裁床/工位</th>'), false)
  assert.equal(excelHtml.includes('<th>裁床/工位</th>'), false)
})

check('缺口公式正确', '每行满足 20天内裁片缺口数量 = 20天内需发货数量 - 当前库存数量 - 已送车缝厂未回货数量 - 裁剪完成未送车缝厂数量', () => {
  summaryRows.forEach((row) => {
    assert.equal(
      row.pendingCutPieceGapQty,
      row.shipmentQtyInWindow -
        row.currentStockQty -
        row.sentSewingFactoryNotReturnedQty -
        row.cutCompletedNotSentSewingFactoryQty,
      row.spuCode,
    )
  })
})

check('列表支持分页', '缺口排序和AB料明细均展示分页控件，AB料明细默认拆成多页', () => {
  assert.ok(pageHtml.includes('上一页'))
  assert.ok(pageHtml.includes('下一页'))
  assert.ok(pageHtml.includes('10 / 页'))
  assert.ok(detailPageHtml.includes('当前第 1 / 2 页'))
})

check('列表不展示数据更新时间列', '缺口排序与AB料明细列表均去掉数据更新时间列，更新时间仅保留在统计标签和导出数据中', () => {
  assert.ok(summaryRows.every((row) => row.updatedAt))
  assert.ok(detailRows.every((row) => row.updatedAt))
  const summaryTableHtml = pageHtml.slice(pageHtml.indexOf('data-testid="cutting-ab-summary-table"'))
  const detailTableHtml = detailPageHtml.slice(detailPageHtml.indexOf('data-testid="cutting-ab-detail-table"'))
  assert.equal(summaryTableHtml.includes('<th class="px-3 py-2 font-medium">数据更新时间</th>'), false)
  assert.equal(detailTableHtml.includes('<th class="px-3 py-2 font-medium">数据更新时间</th>'), false)
  assert.ok(pageHtml.includes('更新'))
  assert.ok(excelHtml.includes('数据更新时间'))
})

check('新缺口字段口径正确', '来源说明区分库存、已送车缝未回货、裁剪完成未送车缝', () => {
  assert.ok(report.sourceLabels.currentStockQty.includes('当前库存数量'))
  assert.ok(report.sourceLabels.sentSewingFactoryNotReturnedQty.includes('交出单'))
  assert.ok(report.sourceLabels.sentSewingFactoryNotReturnedQty.includes('中转袋'))
  assert.ok(report.sourceLabels.sentSewingFactoryNotReturnedQty.includes('尚未回货'))
  assert.ok(report.sourceLabels.cutCompletedNotSentSewingFactoryQty.includes('裁剪完成'))
  assert.ok(report.sourceLabels.cutCompletedNotSentSewingFactoryQty.includes('尚未生成交出单'))
  assert.equal(report.sourceLabels.sentSewingFactoryNotReturnedQty.includes('实际裁剪数量'), false)
})

check('实际裁剪数量口径正确', '来源说明来自铺布/裁剪/PDA裁剪回写', () => {
  assert.ok(report.sourceLabels.actualCutQty.includes('铺布'))
  assert.ok(report.sourceLabels.actualCutQty.includes('PDA'))
})

check('缺(实际−最大)分组计算正确', 'PO13630 black 面料A 510、面料B 520 对应 -10 和 0', () => {
  const fabricA = detailRows.find((row) => row.productionOrderNo === 'PO13630' && row.color === 'black' && row.cuttingMaterialRole === '面料A')
  const fabricB = detailRows.find((row) => row.productionOrderNo === 'PO13630' && row.color === 'black' && row.cuttingMaterialRole === '面料B')
  assert.ok(fabricA)
  assert.ok(fabricB)
  assert.equal(fabricA.actualCutQty, 510)
  assert.equal(fabricB.actualCutQty, 520)
  assert.equal(fabricA.groupMaxActualCutQty, 520)
  assert.equal(fabricA.actualMinusGroupMaxQty, -10)
  assert.equal(fabricB.actualMinusGroupMaxQty, 0)
})

check('裁剪物料角色完整', '面料A/B/C、里布、衬、罗纹、纽扣、未识别属性都通过统一角色字段展示', () => {
  const roles = new Set(detailRows.map((row) => row.cuttingMaterialRole))
  ;['面料A', '面料B', '面料C', '里布', '衬', '罗纹', '纽扣', '未识别属性'].forEach((role) => {
    assert.ok(cuttingMaterialRoleOptions.includes(role as never))
    assert.ok(roles.has(role as never), role)
  })
})

check('未识别属性不强猜', '无法识别时返回未识别属性', () => {
  assert.equal(resolveCuttingMaterialRole({ materialType: '辅料', materialName: '旧版未维护物料' }), '未识别属性')
})

check('SPU图片为真实资源', '所有SPU图片指向public下存在的jpg/png资源', () => {
  summaryRows.forEach((row) => {
    assert.ok(row.spuImageUrl)
    assert.equal(row.spuImageUrl.includes('placeholder'), false)
    assert.ok(existsSync(join(repoRoot, 'public', row.spuImageUrl.replace(/^\//, ''))), row.spuImageUrl)
  })
})

check('物料图片为真实资源', '所有物料图片指向public下存在的jpg/png资源', () => {
  detailRows.forEach((row) => {
    assert.ok(row.materialImageUrl)
    assert.equal(row.materialImageUrl.includes('placeholder'), false)
    assert.ok(existsSync(join(repoRoot, 'public', row.materialImageUrl.replace(/^\//, ''))), row.materialImageUrl)
  })
})

check('查看明细跳转携带SPU', '汇总行按钮切到AB料明细并携带spu参数', () => {
  assert.ok(pageHtml.includes('tab=details'))
  assert.ok(pageHtml.includes('spu='))
  assert.ok(pageHtml.includes('查看明细'))
})

check('AB料明细操作栏已删除', 'AB料明细表不再展示操作列和行内跳转按钮', () => {
  const detailTableHtml = detailPageHtml.slice(detailPageHtml.indexOf('data-testid="cutting-ab-detail-table"'))
  assert.equal(detailTableHtml.includes('<th class="px-3 py-2 font-medium">操作</th>'), false)
  ;['裁片单', '铺布记录', '交出记录'].forEach((label) => assert.equal(detailTableHtml.includes(label), false, label))
})

check('页面状态中文展示', '页面不暴露内部英文状态码', () => {
  ;['WAIT_PICKUP', 'PENDING', 'READY', 'SHORTAGE', 'UNKNOWN'].forEach((code) => {
    assert.equal(pageHtml.includes(code), false, code)
    assert.equal(detailPageHtml.includes(code), false, code)
  })
})

check('Excel导出包含两个sheet', '导出内容包含20天待发裁片缺口排序与AB料明细', () => {
  assert.ok(excelHtml.includes('<x:Name>20天待发裁片缺口排序</x:Name>'))
  assert.ok(excelHtml.includes('<x:Name>AB料明细</x:Name>'))
  assert.ok(excelHtml.includes('20天内需发货数量'))
  assert.ok(excelHtml.includes('当前库存数量'))
  assert.ok(excelHtml.includes('已送车缝厂未回货数量'))
  assert.ok(excelHtml.includes('裁剪完成未送车缝厂数量'))
  assert.ok(excelHtml.includes('20天内裁片缺口数量'))
  assert.ok(excelHtml.includes('技术包版本号'))
  assert.ok(excelHtml.includes('纸样名称'))
  assert.ok(excelHtml.includes('缺(实际−最大)'))
})

check('路由已接入', 'routes-fcs与异步渲染器接入统计页', () => {
  assert.ok(routesSource.includes("'/fcs/craft/cutting/statistics/ab-material'"))
  assert.ok(routesSource.includes('renderCraftCuttingAbMaterialStatisticsPage'))
  assert.ok(rendererSource.includes('cutting-statistics-ab-material'))
})

check('页面元数据已接入', 'meta.ts声明裁床统计分组和页面标题', () => {
  assert.ok(metaSource.includes("'statistics-ab-material'"))
  assert.ok(metaSource.includes("menuGroupTitle: '裁床统计'"))
  assert.ok(metaSource.includes("pageTitle: '20天待发裁床AB料'"))
})

check('导出事件已接入', 'FCS事件分发调用handleCraftCuttingAbMaterialStatisticsEvent', () => {
  assert.ok(handlersSource.includes('handleCraftCuttingAbMaterialStatisticsEvent'))
})

console.table(checks)
console.log(`check:cutting-ab-material-statistics passed (${checks.length}/${checks.length})`)
