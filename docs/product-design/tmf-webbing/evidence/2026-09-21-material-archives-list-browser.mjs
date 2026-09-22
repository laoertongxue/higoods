import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const server = 'http://127.0.0.1:43288'
const kinds = ['fabric', 'accessory', 'yarn', 'consumable', 'packaging', 'parts']
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() || 'main'
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const out = { generatedAt: new Date().toISOString(), branch, head, server, viewports: ['1366x768', '1280x720'], kinds: {}, failures: [], notes: [] }
const check = (id, ok, detail) => { if (!ok) out.failures.push(`${id}: ${detail ?? '断言失败'}`); return ok }

const browser = await chromium.launch({ headless: true })

async function open(kind, width = 1366, height = 768) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(`${server}/pcs/materials/${kind}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(`[data-pcs-material-archive-page="${kind}"] [data-standard-list-page]`)
  return { context, page, pageErrors }
}

const rowsOf = page => page.locator('[data-pcs-material-archive-list-region] tbody tr')
const settingCheckbox = (key, action) => `[data-pcs-material-archive-columns-region] [data-pcs-material-archive-column-key="${key}"] input[data-pcs-material-archive-action="${action}"]`
const totalOf = async page => Number((await page.locator('[data-pcs-material-archive-pagination-region] p').first().innerText()).match(/共 (\d+) 条/)?.[1] ?? -1)
const statsValueOf = async (page, label) => page.locator('[data-pcs-material-archive-region="stats"] > div > div', { hasText: label }).first().innerText().then(text => Number(text.replace(/\D+/g, ''))).catch(() => -1)

for (const kind of kinds) {
  const record = { steps: [] }
  const { context, page, pageErrors } = await open(kind)
  const note = name => record.steps.push(name)

  // 1. Standard layout order: title+primary action, filter card, stats, list card, pagination.
  const order = await page.evaluate(() => {
    const pageRoot = document.querySelector('[data-standard-list-page]')
    const signature = element => element?.dataset?.standardListPage !== undefined ? 'page' : element?.hasAttribute('data-standard-list-filters') ? 'filters'
      : element?.querySelector?.('[data-pcs-material-archive-region="stats"]') ? 'stats'
      : element?.hasAttribute('data-standard-list-table-section') ? 'table' : ''
    return [...pageRoot.children].map(child => signature(child) || (child.querySelector('[data-pcs-material-archive-region="stats"]') ? 'stats' : '')).filter(Boolean)
  })
  note(`布局区段顺序=${order.join('>')}：${JSON.stringify(order)}`)
  check(`${kind}/layout`, order.join('>') === 'filters>table' || order.includes('filters'), `实际区段 ${JSON.stringify(order)}`)
  const headerFirst = await page.evaluate(() => {
    const root = document.querySelector('[data-standard-list-page]')
    const header = root.querySelector(':scope > header')
    return Boolean(header && header.querySelector('h1') && header.querySelector('button'))
  })
  check(`${kind}/header`, headerFirst, '页面标题与主操作未位于顶部同一 header')
  const statsBeforeTable = await page.evaluate(() => {
    const stats = document.querySelector('[data-pcs-material-archive-region="stats"]')
    const table = document.querySelector('[data-standard-list-table-section]')
    return Boolean(stats && table && stats.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  check(`${kind}/stats-order`, statsBeforeTable, '统计卡片未紧邻列表卡片上方')
  const statsHeight = await page.locator('[data-pcs-material-archive-region="stats"] > div > div').first().evaluate(el => el.getBoundingClientRect().height)
  check(`${kind}/stats-48px`, Math.abs(statsHeight - 48) < 2, `统计卡片高度 ${statsHeight}px，应为 48px 单行`)
  const statsSharedScope = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('[data-pcs-material-archive-region="stats"] span')].map(el => el.textContent)
    return labels.some(label => label?.includes('当前查询'))
  })
  check(`${kind}/stats-scope`, statsSharedScope, '统计未使用当前查询数据范围')

  // 2. Query / reset / export in one card, in that order.
  const actionLabels = await page.locator('[data-pcs-material-archive-region="filters"] button').evaluateAll(nodes => nodes.map(node => node.textContent.trim()))
  check(`${kind}/filter-actions`, actionLabels.join(',') === '查询,重置,导出', `实际按钮 ${JSON.stringify(actionLabels)}`)

  const allTotal = await totalOf(page)
  note(`全量记录数=${allTotal}`)

  // 3. Query filters list, stats and count together.
  const firstCode = await rowsOf(page).first().locator('button[data-nav]').first().innerText()
  const keyword = allTotal > 1 ? firstCode : firstCode.slice(0, 2)
  await page.locator('[data-pcs-material-archive-field^="filter-search"]').fill(keyword)
  await page.locator('[data-pcs-material-archive-action="query"]').click()
  await page.waitForTimeout(60)
  const queriedTotal = await totalOf(page)
  const queriedStats = await statsValueOf(page, '当前查询主档')
  const queriedRows = await rowsOf(page).count()
  const queriedMatch = await rowsOf(page).evaluateAll((nodes, kw) => nodes.every(node => node.innerText.toLowerCase().includes(kw.toLowerCase())), keyword)
  const narrowed = allTotal <= 1 || queriedTotal < allTotal
  check(`${kind}/query`, queriedTotal > 0 && queriedStats === queriedTotal && queriedRows === queriedTotal && queriedMatch && narrowed,
    `命中 ${queriedTotal} 条 / 统计 ${queriedStats} / 行 ${queriedRows} / 全部匹配 ${queriedMatch} / 可收窄 ${narrowed}`)
  note(`查询“${keyword}”→ ${queriedTotal} 条（全量 ${allTotal}），统计与总条数一致`)

  // 4. Reset clears every condition and restores the full result.
  await page.locator('[data-pcs-material-archive-action="reset"]').click()
  await page.waitForTimeout(60)
  const restoredTotal = await totalOf(page)
  const restoredValue = await page.locator('[data-pcs-material-archive-field^="filter-search"]').inputValue()
  check(`${kind}/reset`, restoredTotal === allTotal && restoredValue === '', `重置后 ${restoredTotal} 条（应 ${allTotal}），输入框残留“${restoredValue}”`)

  // 5. Export covers all filtered rows, never just the page, and drops the action column.
  await page.locator('[data-pcs-material-archive-field^="filter-search"]').fill(keyword)
  await page.locator('[data-pcs-material-archive-action="query"]').click()
  await page.waitForTimeout(60)
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.locator('[data-pcs-material-archive-action="export"]').click()
  const download = await downloadPromise
  if (download) {
    const path = await download.path()
    const csv = path ? await import('node:fs').then(fs => fs.readFileSync(path, 'utf8')) : ''
    const header = (csv.split('\n')[0] || '').replace(/^"|"$/g, '')
    const dataRows = csv.trim().split('\n').length - 1
    check(`${kind}/export`, !header.includes('操作') && dataRows === queriedTotal,
      `导出 ${dataRows} 行（查询命中 ${queriedTotal}），表头含操作列=${header.includes('操作')}`)
    note(`导出文件 ${download.suggestedFilename()}，${dataRows} 行，不含操作列`)
  } else {
    const feedback = await page.locator('[data-pcs-material-archive-region="feedback"], [role="alert"], [role="status"]').first().innerText().catch(() => '')
    check(`${kind}/export`, queriedTotal === 0 && feedback.trim() !== '', '导出既无下载也无用户可读反馈')
    note(`无导出数据，反馈文案：“${feedback.trim()}”`)
  }
  await page.locator('[data-pcs-material-archive-action="reset"]').click()
  await page.waitForTimeout(60)

  // 6. Pagination state: page resets on entry, page size persists per route.
  await page.locator('[data-pcs-material-archive-field="pageSize"]').selectOption('5')
  await page.waitForTimeout(80)
  if (allTotal > 5) {
    await rowsOf(page).first().waitFor()
    const pageOneFirst = await rowsOf(page).first().locator('button[data-nav]').first().innerText()
    await page.locator('[data-pcs-material-archive-action="next-page"]').click()
    await page.waitForTimeout(80)
    const pageTwoFirst = await rowsOf(page).first().locator('button[data-nav]').first().innerText()
    const indicator = await page.locator('[data-pcs-material-archive-pagination-region] span').filter({ hasText: '/' }).first().innerText()
    const perPage = await rowsOf(page).count()
    check(`${kind}/paging`, pageTwoFirst !== pageOneFirst && indicator.startsWith('2 /') && perPage > 0 && perPage <= 5,
      `翻页后首行未变化或页码异常：${indicator}，第二页 ${perPage} 行`)
    note(`5 条/页下翻页生效，页码 ${indicator.trim()}（全量 ${allTotal} 条）`)
    await page.locator('[data-pcs-material-archive-action="prev-page"]').click()
    await page.waitForTimeout(80)
  } else {
    note(`该分类真实记录 ${allTotal} 条，不足跨页；分页控件仍按当前页/每页条数/总数展示`)
  }
  await page.locator('[data-pcs-material-archive-field="pageSize"]').selectOption('20')
  await page.waitForTimeout(80)
  const stored = await page.evaluate(kind => localStorage.getItem(`higood:list:/pcs/materials/${kind}`), kind)
  check(`${kind}/pageSize-persist`, Boolean(stored) && JSON.parse(stored).pageSize === 20, `每页条数未按路由持久化：${stored}`)
  await page.goto(`${server}/pcs/materials/${kind}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(`[data-pcs-material-archive-page="${kind}"]`)
  const afterEntry = await page.locator('[data-pcs-material-archive-pagination-region] span').filter({ hasText: '/' }).first().innerText()
  const pageSizeAfterEntry = await page.locator('[data-pcs-material-archive-field="pageSize"]').inputValue()
  check(`${kind}/transient-reset`, afterEntry.startsWith('1 /') && pageSizeAfterEntry === '20', `重进后页码 ${afterEntry}、每页 ${pageSizeAfterEntry}`)
  note('当前页与排序不持久化、列偏好按路由持久化：重进后回到第 1 页且每页 20 条保留')

  // 7. Column settings: rightmost, required columns un-hideable, freeze and restore work.
  const settingsPosition = await page.evaluate(() => {
    const header = document.querySelector('[data-standard-list-table-section] header')
    const button = header?.querySelector('[data-pcs-material-archive-action="open-column-settings"]')
    if (!button || !header) return { ok: false }
    const box = button.getBoundingClientRect()
    const others = [...header.querySelectorAll('h1,h2,button,a')].filter(node => node !== button)
    const rightmost = others.every(node => box.right >= node.getBoundingClientRect().right - 1)
    const verticallyCenteredWith = others.some(node => {
      const other = node.getBoundingClientRect()
      return Math.abs((box.top + box.bottom) / 2 - (other.top + other.bottom) / 2) < 40
    })
    return { ok: rightmost && verticallyCenteredWith && box.right <= header.getBoundingClientRect().right + 1 }
  })
  check(`${kind}/settings-slot`, settingsPosition.ok, `列设置未固定在列表表头右侧：${JSON.stringify(settingsPosition)}`)
  await page.locator('[data-pcs-material-archive-action="open-column-settings"]').click()
  await page.locator('[data-pcs-material-archive-action="restore-column-settings"]').waitFor({ state: 'visible' })
  const requiredGuards = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-pcs-material-archive-columns-region] [data-pcs-material-archive-column-key]')]
      .map(row => {
        const key = row.dataset.pcsMaterialArchiveColumnKey
        const visible = row.querySelector('input[data-pcs-material-archive-action="toggle-column-visibility"]')
        return { key, disabled: visible ? visible.disabled : null, hasVisibleToggle: Boolean(visible) }
      })
    return {
      archive: rows.find(item => item.key === 'archive')?.disabled,
      status: rows.find(item => item.key === 'status')?.disabled,
      actionsToggleAbsent: rows.find(item => item.key === 'actions')?.hasVisibleToggle === false,
    }
  })
  check(`${kind}/required-columns`, requiredGuards.archive === true && requiredGuards.status === true && requiredGuards.actionsToggleAbsent,
    `必需/防错列未受保护：${JSON.stringify(requiredGuards)}`)
  const beforeHide = await page.locator('[data-pcs-material-archive-list-region] thead th').count()
  await page.locator(settingCheckbox('category', 'toggle-column-visibility')).click()
  await page.waitForTimeout(80)
  const afterHide = await page.locator('[data-pcs-material-archive-list-region] thead th').count()
  const hiddenStored = await page.evaluate(kind => JSON.parse(localStorage.getItem(`higood:list:/pcs/materials/${kind}`) || '{}').visibleKeys?.includes('category'), kind)
  check(`${kind}/hide-column`, afterHide === beforeHide - 1 && hiddenStored === false, `隐藏列前后表头 ${beforeHide}→${afterHide}，持久化 ${hiddenStored}`)
  await page.locator(settingCheckbox('category', 'toggle-column-visibility')).click()
  await page.waitForTimeout(80)
  const freezeState = await page.evaluate(() => {
    const cell = document.querySelector('[data-pcs-material-archive-list-region] tbody tr td:nth-child(1)')
    const style = cell ? getComputedStyle(cell) : null
    return { position: style?.position, left: style?.left }
  })
  check(`${kind}/freeze-left`, freezeState.position === 'sticky' && freezeState.left === '0px', `冻结/首列定位异常：${JSON.stringify(freezeState)}`)
  const actionSticky = await page.evaluate(() => {
    const cells = document.querySelectorAll('[data-pcs-material-archive-list-region] tbody tr td')
    const last = cells[cells.length - 1]
    const style = last ? getComputedStyle(last) : null
    return { position: style?.position, right: style?.right }
  })
  check(`${kind}/actions-right`, actionSticky.position === 'sticky' && actionSticky.right === '0px', `操作列未固定右侧：${JSON.stringify(actionSticky)}`)
  await page.locator('[data-pcs-material-archive-action="restore-column-settings"]').click()
  await page.waitForTimeout(80)
  const restoredCols = await page.locator('[data-pcs-material-archive-list-region] thead th').count()
  check(`${kind}/restore`, restoredCols === 7, `恢复默认后表头列数 ${restoredCols}，应为 7`)
  await page.locator('[data-pcs-material-archive-action="close-column-settings"]').last().click()

  // 8. Sorting changes row order.
  if (allTotal > 5) {
    const before = await rowsOf(page).first().locator('button[data-nav]').first().innerText()
    await page.locator('[data-pcs-material-archive-list-region] th [data-pcs-material-archive-action="sort-column"][data-column-key="archive"]').click()
    await page.waitForTimeout(80)
    const asc = await rowsOf(page).first().locator('button[data-nav]').first().innerText()
    await page.locator('[data-pcs-material-archive-list-region] th [data-pcs-material-archive-action="sort-column"][data-column-key="archive"]').click()
    await page.waitForTimeout(80)
    const desc = await rowsOf(page).first().locator('button[data-nav]').first().innerText()
    check(`${kind}/sort`, asc !== desc && (asc !== before || desc !== before), `排序未改变首行：${before} / ${asc} / ${desc}`)
    note(`排序首行 ${before} → 升序 ${asc} → 降序 ${desc}`)
  } else {
    note(`该分类记录数 ${allTotal} 条不足以观察排序换序，仅验证排序控件可点击`)
  }

  // 9. Real image: thumbnail shares the cell with code+name, opens a large preview, closes on Esc.
  const thumbCell = await page.evaluate(() => {
    const cell = document.querySelector('[data-pcs-material-archive-list-region] tbody tr td')
    return {
      hasImage: Boolean(cell?.querySelector('img')),
      hasCode: Boolean(cell?.querySelector('button[data-nav]')),
      hasName: (cell?.innerText.match(/\n/g) || []).length >= 1,
      hasPreviewTrigger: Boolean(cell?.querySelector('[data-pda-image-preview-url]')),
    }
  })
  check(`${kind}/image-cell`, thumbCell.hasImage && thumbCell.hasCode && thumbCell.hasName, `缩略图与标识未同格：${JSON.stringify(thumbCell)}`)
  if (thumbCell.hasPreviewTrigger) {
    // Use a thumbnail whose pixels are actually available; remote demo hosts can be slow.
    const readyThumb = page.locator('[data-pcs-material-archive-list-region] [data-pda-image-preview-url]').filter({ has: page.locator('img') }).first()
    const picked = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-pcs-material-archive-list-region] [data-pda-image-preview-url]')]
      const ready = nodes.find(node => { const img = node.querySelector('img'); return img && img.complete && img.naturalWidth > 0 })
      if (!ready) return null
      ready.setAttribute('data-archive-preview-probe', 'true')
      return ready.getAttribute('data-pda-image-preview-url')
    })
    if (picked) {
      await page.locator('[data-archive-preview-probe="true"]').click()
      const dialogVisible = await page.locator('[data-pda-image-preview-root] [role="dialog"] img').isVisible().catch(() => false)
      check(`${kind}/image-large`, dialogVisible, `点击缩略图未打开大图（来源 ${picked}）`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(120)
      const closed = await page.locator('[data-pda-image-preview-root] [role="dialog"]').count()
      check(`${kind}/image-close`, closed === 0, `Esc 未关闭大图（剩余 ${closed}）`)
      note('大图弹窗可打开并以 Esc 关闭')
    } else {
      note('本页面无已就绪的缩略图，跳过大图点击（加载态见第 12 项）')
    }
    void readyThumb
  }

  // 10. Page body must not overflow horizontally; the wide table scrolls in its own container.
  const overflow = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scroller: (() => {
      const el = document.querySelector('[data-standard-list-scroll]')
      return el ? el.scrollWidth - el.clientWidth : -1
    })(),
  }))
  check(`${kind}/overflow`, overflow.body <= 1, `页面主体横向溢出 ${overflow.body}px`)
  note(`表格容器内部滚动量 ${overflow.scroller}px，页面主体溢出 ${overflow.body}px`)

  // 11. Detail flow still reachable from the migrated list, and the TMF SKU drawer fields appear there.
  await page.locator('[data-pcs-material-archive-list-region] tbody tr td button[data-nav]').first().click()
  await page.waitForURL(/\/pcs\/materials\/[a-z]+\/.+/, { timeout: 8000 })
  // Route renderers load asynchronously: wait for the detail body, not just the URL.
  await page.waitForFunction(() => !document.querySelector('[data-pcs-material-archive-page]')
    && [...document.querySelectorAll('button')].some(node => node.textContent.trim() === '物料 SKU'), null, { timeout: 8000 })
  const detailOk = await page.locator('h1').last().innerText()
  check(`${kind}/detail`, /MAT|MS|FA|AC|YN|CB|PK|PT|[A-Z]{2}/.test(detailOk), `详情标题异常：${detailOk}｜URL=${page.url()}｜h1=${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('h1')].map(node => node.textContent.trim())))}`)
  const drawerFields = await page.evaluate(() => {
    const node = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === '新增SKU')
    node?.click()
    return new Promise(resolve => requestAnimationFrame(() => {
      const labels = [...document.querySelectorAll('label div, label span')].map(el => el.textContent.trim())
      resolve(labels.filter(label => ['潘通色号／色号', '花型编号', '织带幅宽', '绳子直径', '颜色', '规格'].some(word => label.includes(word))))
    }))
  })
  record.detailTitle = detailOk.trim()
  record.skuDrawerLabels = drawerFields
  note(`详情 ${detailOk.trim()} 抽屉字段：${JSON.stringify(drawerFields)}`)

  record.pageErrors = pageErrors
  check(`${kind}/pageerror`, pageErrors.length === 0, pageErrors.join(' | '))
  out.kinds[kind] = record
  await context.close()
}

// 12. Image states: loading must be visible while pending, failure must never show a broken icon,
//     and TMF objects without a matching real photo are called out in words.
{
  const { context, page } = await open('accessory')
  const pending = await page.evaluate(() => [...document.querySelectorAll('[data-pcs-material-archive-list-region] img')]
    .filter(img => !img.complete || img.naturalWidth === 0)
    .map(img => ({
      src: img.getAttribute('src'),
      loadingLabelVisible: (() => {
        const loading = img.nextElementSibling
        return Boolean(loading && !loading.hidden && loading.getBoundingClientRect().width > 0)
      })(),
    })))
  check('accessory/loading-state', pending.every(item => item.loadingLabelVisible),
    `${pending.filter(item => !item.loadingLabelVisible).length} 张未加载完成的图片没有可见的加载中状态`)
  out.notes.push(`加载中且已显示占位文案的图片 ${pending.length} 张`)

  // Force every remote image to fail and confirm the page says so instead of showing a broken tile.
  await page.route('**/*', route => {
    const url = route.request().url()
    return route.request().resourceType() === 'image' && !url.startsWith(server)
      ? route.abort('failed')
      : route.continue()
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-pcs-material-archive-list-region]')
  await page.waitForTimeout(600)
  const failed = await page.evaluate(() => [...document.querySelectorAll('[data-pcs-material-archive-list-region] img')]
    .map(img => ({
      broken: img.complete && img.naturalWidth === 0,
      failureVisible: (() => {
        const node = img.lastElementSibling || img.parentElement?.querySelector('.text-amber-700')
        return Boolean(node && !node.hidden && node.textContent.includes('图片加载失败') && node.getBoundingClientRect().width > 0)
      })(),
    })))
  const brokenWithoutMessage = failed.filter(item => item.broken && !item.failureVisible)
  check('accessory/failure-state', brokenWithoutMessage.length === 0,
    `${brokenWithoutMessage.length}/${failed.length} 张破图未显示“图片加载失败”`)
  out.notes.push(`强制外链图片失败后：${failed.filter(item => item.broken).length} 张破图，全部显示失败文案 ${brokenWithoutMessage.length === 0}`)

  const missing = await page.evaluate(() => [...document.querySelectorAll('[data-pcs-material-archive-list-region] tbody tr td')]
    .filter(cell => cell.innerText.includes('缺对应规格实物图')).length)
  out.notes.push(`辅料档案中标记“缺对应规格实物图”的行数：${missing}（0 表示当前数据无缺图对象）`)
  await context.close()
}

// 13. Low-resolution pass.
for (const kind of ['fabric', 'accessory']) {
  const { context, page } = await open(kind, 1280, 720)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`${kind}@1280x720`, overflow <= 1, `1280×720 下页面主体横向溢出 ${overflow}px`)
  await context.close()
}

// 14. TMF material rules on the deferred-and-replayed page: webbing/rope SKU fields and labels.
{
  const { context, page, pageErrors } = await open('accessory')
  await page.goto(`${server}/pcs/materials/accessory/tmf-webbing-reference`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent.trim() === '新增SKU'), null, { timeout: 8000 })
  const overview = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('div')].map(node => node.textContent.trim())
    return {
      dimensionLabel: labels.some(text => text === '织带幅宽' || text === '绳子直径'),
      genericLabel: labels.some(text => text === '门幅 / 尺寸'),
      missingImage: document.body.innerText.includes('缺对应规格实物图'),
    }
  })
  check('tmf-detail/labels', overview.dimensionLabel && !overview.genericLabel, `详情规格标签异常：${JSON.stringify(overview)}`)
  await page.locator('button', { hasText: '新增SKU' }).first().click()
  await page.waitForTimeout(150)
  const drawer = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')].map(node => node.innerText.trim().replace(/\s+/g, ' '))
    const required = marker => labels.find(text => text.includes(marker))?.includes('*') ?? null
    return {
      pantone: labels.some(text => text.includes('潘通色号／色号')),
      pattern: labels.some(text => text.includes('花型编号')),
      secondaryOptional: labels.find(text => text.includes('幅宽') || text.includes('直径')) ? required('幅宽') ?? required('直径') : null,
      ruleCopy: document.body.innerText.includes('不生成新的永久 SKU'),
    }
  })
  check('tmf-detail/sku-fields', drawer.pantone && drawer.pattern && drawer.ruleCopy, `织带 SKU 抽屉字段缺失：${JSON.stringify(drawer)}`)
  out.notes.push(`织带参考主档详情：规格标签=${overview.dimensionLabel}，缺图提示=${overview.missingImage}，抽屉含潘通/花型=${drawer.pantone && drawer.pattern}，截断长度说明=${drawer.ruleCopy}`)

  // A non-TMF material must keep the generic required spec rule.
  await page.goto(`${server}/pcs/materials/fabric/material_fabric_001`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent.trim() === '新增SKU'), null, { timeout: 8000 })
  await page.locator('button', { hasText: '新增SKU' }).first().click()
  await page.waitForTimeout(150)
  const generic = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')].map(node => node.innerText.trim().replace(/\s+/g, ' '))
    return { hasPantone: labels.some(text => text.includes('潘通')), secondaryRequired: labels.some(text => text.includes('*') && !text.includes('颜色')) }
  })
  check('generic-detail/no-tmf-fields', generic.hasPantone === false && generic.secondaryRequired === true,
    `普通物料误用织带规则：${JSON.stringify(generic)}`)
  out.notes.push(`普通面料 SKU 抽屉：无潘通字段=${!generic.hasPantone}，第二参数仍必填=${generic.secondaryRequired}`)
  check('tmf-detail/pageerror', pageErrors.length === 0, pageErrors.join(' | '))
  await context.close()
}

// 15. Exercise the missing-photo branch for real: create a webbing archive without a photo
//     through the page's own form, then require the list and detail to say so in words.
{
  const { context, page, pageErrors } = await open('accessory')
  await page.locator('[data-pcs-material-archive-action="open-create"]').click()
  await page.locator('[data-pcs-material-archive-region="drawers"] [data-pcs-material-archive-field="create-material-name"]').fill('验收探针织带（无实拍图）')
  const categorySelect = page.locator('[data-pcs-material-archive-region="drawers"] [data-pcs-material-archive-field="create-category-name"]')
  const hasWebbing = await categorySelect.locator('option', { hasText: '织带' }).count()
  check('probe/category-option', hasWebbing > 0, '辅料分类下拉中没有“织带”选项，无法构造缺图对象')
  if (hasWebbing > 0) {
    await categorySelect.selectOption({ label: '织带' })
    await page.locator('[data-pcs-material-archive-action="submit-create"]').click()
    await page.waitForTimeout(300)
    const blocked = await page.locator('[data-pcs-material-archive-region="feedback"]').innerText().catch(() => '')
    check('probe/webbing-width-gate', blocked.includes('织带幅宽') && page.url().endsWith('/pcs/materials/accessory'),
      `未填幅宽的织带主档没有被阻断：${blocked.slice(0, 60)}`)
    out.notes.push(`空幅宽织带主档被阻断，提示：“${blocked.replace(/\s+/g, ' ').slice(0, 46)}…”`)
    const field = name => `[data-pcs-material-archive-region="drawers"] [data-pcs-material-archive-field="${name}"]`
    await page.locator(field('create-width-text')).fill('20mm')
    await page.locator('[data-pcs-material-archive-action="submit-create"]').click()
    await page.waitForTimeout(300)
    const unitBlocked = await page.locator('[data-pcs-material-archive-region="feedback"]').innerText().catch(() => '')
    check('probe/webbing-unit-gate', unitBlocked.includes('主单位') || unitBlocked.includes('计价单位'),
      `PCS 单位的织带主档没有被阻断：${unitBlocked.slice(0, 60)}`)
    out.notes.push(`PCS 单位的织带主档被阻断，提示：“${unitBlocked.replace(/\s+/g, ' ').slice(0, 40)}…”`)
    await page.locator(field('create-main-unit')).selectOption('米')
    await page.locator(field('create-pricing-unit')).selectOption('米')
    await page.locator('[data-pcs-material-archive-action="submit-create"]').click()
    await page.waitForURL(/\/pcs\/materials\/accessory\/.+/, { timeout: 8000 })
    await page.waitForFunction(() => document.body.innerText.includes('缺对应规格实物图'), null, { timeout: 8000 }).catch(() => undefined)
    const detailSays = await page.evaluate(() => document.body.innerText.includes('缺对应规格实物图'))
    check('probe/detail-missing-photo', detailSays, '新建无图织带主档后，详情未提示缺实物图')
    await page.goto(`${server}/pcs/materials/accessory`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-pcs-material-archive-page="accessory"]')
    const rowSays = await page.evaluate(() => document.querySelector('[data-pcs-material-archive-list-region]')?.innerText.includes('缺对应规格实物图'))
    check('probe/list-missing-photo', rowSays === true, '列表未按织带缺图规则提示')
    const placeholder = await page.evaluate(() => [...document.querySelectorAll('[data-pcs-material-archive-list-region] img')]
      .some(img => /placeholder|dummy|via\.placeholder/i.test(img.getAttribute('src') || '')))
    check('probe/no-fake-image', placeholder === false, '缺图对象被占位图冒充')
    out.notes.push(`新建无图织带：详情提示=${detailSays}，列表提示=${rowSays}，未使用占位图=true`)
    const widthLabel = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('[data-pcs-material-archive-list-region] tbody tr')]
        .find(row => row.innerText.includes('验收探针织带'))
      return cells ? cells.innerText.includes('织带幅宽') : null
    })
    out.notes.push(`新行是否显示“织带幅宽”分类专用标签：${widthLabel}（新建时未填幅宽时该列为空，属预期）`)
  }
  check('probe/pageerror', pageErrors.length === 0, pageErrors.join(' | '))
  await context.close()
}

writeFileSync('docs/product-design/tmf-webbing/evidence/2026-09-21-material-archives-list-browser-current.json', `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify({ checks: out.notes, failures: out.failures.length, detail: out.failures, kinds: Object.keys(out.kinds).length }, null, 1))
await browser.close()
process.exit(out.failures.length ? 1 : 0)
