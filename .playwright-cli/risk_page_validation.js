async (page) => {
  async function tableByHeader(marker) {
    const tables = page.locator("table")
    const count = await tables.count()
    for (let i = 0; i < count; i += 1) {
      const table = tables.nth(i)
      const text = (await table.innerText()).trim()
      if (text.includes(marker)) {
        return table
      }
    }
    throw new Error("table with marker not found: " + marker)
  }

  async function tableSnapshot(table) {
    const headers = await table.locator("thead th").allInnerTexts()
    const rows = await table.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent?.replace(/\s+/g, " ").trim() ?? "")))
    return { headers, rows }
  }

  await page.goto("http://127.0.0.1:4180/fcs/capacity/risk", { waitUntil: "networkidle" })
  await page.setViewportSize({ width: 1600, height: 1200 })
  await page.waitForSelector("h1")
  await page.waitForTimeout(800)

  const title = (await page.locator("h1").first().innerText()).trim()
  const bodyText = await page.locator("body").innerText()
  const path = page.url().replace(/^https?:\/\/[^/]+/, "")

  const taskTable = await tableByHeader("任务编号")
  const taskSnap = await tableSnapshot(taskTable)
  const taskRows = taskSnap.rows
  const findConclusionRow = (keyword) => taskRows.find((row) => row.includes(keyword)) || null

  const taskResults = {
    title,
    path,
    taskHeaders: taskSnap.headers,
    taskRowCount: taskRows.length,
    hasCapable: Boolean(findConclusionRow("可承载")),
    hasTight: Boolean(findConclusionRow("紧张")),
    hasExceeds: Boolean(findConclusionRow("超出窗口")),
    hasUnallocated: Boolean(findConclusionRow("未落厂")),
    hasUnscheduled: Boolean(findConclusionRow("未排期")),
    capableRow: findConclusionRow("可承载"),
    tightRow: findConclusionRow("紧张"),
    exceedsRow: findConclusionRow("超出窗口"),
    unallocatedRow: findConclusionRow("未落厂"),
    unscheduledRow: findConclusionRow("未排期"),
    hasLegacyDyeing: bodyText.includes("染印风险"),
    hasLegacyQc: bodyText.includes("质检风险"),
    hasLegacyExceptionFocus: bodyText.includes("异常集合") || bodyText.includes("异常状态") || bodyText.includes("异常任务"),
    hasOldDeliveryRisk: bodyText.includes("生产单交付风险"),
    hasTabs: bodyText.includes("任务风险") && bodyText.includes("生产单风险")
  }

  await page.getByRole("button", { name: "生产单风险" }).click()
  await page.waitForTimeout(500)
  const orderTable = await tableByHeader("生产单号")
  const orderSnap = await tableSnapshot(orderTable)
  const orderRows = orderSnap.rows

  return {
    ...taskResults,
    orderHeaders: orderSnap.headers,
    orderRowCount: orderRows.length,
    orderSampleA: orderRows[0] ?? null,
    orderSampleB: orderRows[1] ?? null
  }
}
