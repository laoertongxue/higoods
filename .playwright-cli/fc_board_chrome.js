async (page) => {
  await page.goto('http://127.0.0.1:4178/fcs/dispatch/board', { waitUntil: 'networkidle' });
  return {
    hasTitle: (await page.locator('text=任务分配').count()) > 0,
    hasKanban: (await page.locator('button:has-text("看板视图")').count()) > 0,
    hasList: (await page.locator('button:has-text("列表视图")').count()) > 0,
    hasStatCard: (await page.locator('text=未分配任务').count()) > 0,
  };
}
