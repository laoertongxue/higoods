async (page) => {
  await page.goto('http://127.0.0.1:4178/fcs/dispatch/board', { waitUntil: 'networkidle' });
  await page.click('[data-dispatch-action="open-create-tender"][data-task-id="TASKGEN-202603-0002-002__ORDER"]');
  await page.waitForTimeout(500);
  const blocks = page.locator('[data-tender-factory-group-sam^="ID-F017:"]');
  const count = await blocks.count();
  const texts = [];
  for (let i = 0; i < Math.min(count, 2); i += 1) {
    texts.push(await blocks.nth(i).innerText());
  }
  return {
    count,
    texts,
    hasPerGroup: count > 1,
    hasExceeded: texts.some((text) => text.includes('超过当前窗口可承载能力') || text.includes('超过任务截止时间')),
    hasWindowInfo: texts.every((text) => text.includes('未来') || text.includes('日期不足')),
  };
}
