async (page) => {
  const base = 'http://127.0.0.1:4178';
  const result = {
    pageChrome: null,
    wholeDirect: null,
    detailDirect: null,
    wholeTender: null,
    detailTender: null,
  };

  async function openBoard() {
    await page.goto(base + '/fcs/dispatch/board', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
  }

  async function closeAnyPanel() {
    const closeBtn = page.locator('button[aria-label="关闭"], button:has-text("关闭")').last();
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  }

  await openBoard();
  result.pageChrome = {
    hasTitle: (await page.locator('text=任务分配').count()) > 0,
    hasKanban: (await page.locator('button:has-text("看板视图")').count()) > 0,
    hasList: (await page.locator('button:has-text("列表视图")').count()) > 0,
    hasStatCard: (await page.locator('text=未分配任务').count()) > 0,
  };

  await page.click('[data-dispatch-action="open-direct-dispatch"][data-task-id="TASKGEN-202603-0008-001__ORDER"]');
  await page.waitForTimeout(500);
  await page.selectOption('select[data-dispatch-field="dispatch.factoryId"]', 'ID-F017');
  await page.waitForTimeout(300);
  const wholeDirectText = await page.locator('[data-dispatch-task-sam-judgement="selected-factory"]').innerText();
  result.wholeDirect = {
    taskId: 'TASKGEN-202603-0008-001__ORDER',
    selectedFactory: 'ID-F017',
    text: wholeDirectText,
    hasWindowDays: wholeDirectText.includes('未来') && wholeDirectText.includes('天'),
    hasSupply: wholeDirectText.includes('窗口供给') || wholeDirectText.includes('共计'),
    hasCommitted: wholeDirectText.includes('已占用'),
    hasFrozen: wholeDirectText.includes('已冻结'),
    hasRemaining: wholeDirectText.includes('剩余'),
    hasTaskDemand: wholeDirectText.includes('当前任务') || wholeDirectText.includes('当前明细'),
    hasEstimatedDays: wholeDirectText.includes('预计消耗'),
    hasCapable: wholeDirectText.includes('当前窗口内可承载'),
  };
  await closeAnyPanel();

  await openBoard();
  await page.click('[data-dispatch-action="open-direct-dispatch"][data-task-id="TASKGEN-202603-0002-002__ORDER"]');
  await page.waitForTimeout(500);
  const groupSelects = page.locator('select[data-dispatch-field="dispatch.groupFactoryId"]');
  const groupCount = await groupSelects.count();
  const groupResults = [];
  for (let i = 0; i < Math.min(groupCount, 2); i += 1) {
    const select = groupSelects.nth(i);
    const groupKey = await select.getAttribute('data-group-key');
    await select.selectOption('ID-F017');
    await page.waitForTimeout(200);
    const text = await page.locator('[data-dispatch-group-sam-judgement="' + groupKey + '"]').innerText();
    const demandText = await page.locator('[data-dispatch-group-sam="' + groupKey + '"]').innerText();
    groupResults.push({ groupKey, text, demandText });
  }
  result.detailDirect = {
    taskId: 'TASKGEN-202603-0002-002__ORDER',
    groupCount: groupCount,
    firstTwoGroups: groupResults,
    hasIndependentJudgement: groupResults.length === 2 && groupResults[0].groupKey !== groupResults[1].groupKey,
    demandDiffers: groupResults.length === 2 && groupResults[0].demandText !== groupResults[1].demandText,
    hasExceeded: groupResults.some((item) => item.text.includes('超过当前窗口可承载能力') || item.text.includes('超过任务截止时间')),
  };
  await closeAnyPanel();

  await openBoard();
  await page.click('[data-dispatch-action="open-create-tender"][data-task-id="TASKGEN-202603-0002-004__ORDER"]');
  await page.waitForTimeout(500);
  const wholeTenderText = await page.locator('[data-tender-factory-sam="ID-F002"]').innerText();
  result.wholeTender = {
    taskId: 'TASKGEN-202603-0002-004__ORDER',
    factoryId: 'ID-F002',
    text: wholeTenderText,
    hasDateIncomplete: wholeTenderText.includes('日期不足'),
    hasCommitted: wholeTenderText.includes('已占用'),
    hasFrozen: wholeTenderText.includes('已冻结'),
    hasRemaining: wholeTenderText.includes('剩余'),
  };
  await closeAnyPanel();

  await openBoard();
  await page.click('[data-dispatch-action="open-create-tender"][data-task-id="TASKGEN-202603-0002-002__ORDER"]');
  await page.waitForTimeout(500);
  const detailTenderGroupBlocks = page.locator('[data-tender-factory-group-sam^="ID-F017:"]');
  const detailTenderCount = await detailTenderGroupBlocks.count();
  const tenderGroupTexts = [];
  for (let i = 0; i < Math.min(detailTenderCount, 2); i += 1) {
    tenderGroupTexts.push(await detailTenderGroupBlocks.nth(i).innerText());
  }
  result.detailTender = {
    taskId: 'TASKGEN-202603-0002-002__ORDER',
    factoryId: 'ID-F017',
    groupBlockCount: detailTenderCount,
    firstTwoGroupTexts: tenderGroupTexts,
    hasPerGroup: detailTenderCount > 1,
    hasWindowInfo: tenderGroupTexts.every((text) => text.includes('未来') || text.includes('日期不足')),
  };
  await closeAnyPanel();

  return result;
}
