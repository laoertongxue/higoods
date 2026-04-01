async (page) => {
  await page.goto('http://127.0.0.1:4178/fcs/dispatch/board', { waitUntil: 'networkidle' });
  await page.click('[data-dispatch-action="open-direct-dispatch"][data-task-id="TASKGEN-202603-0002-002__ORDER"]');
  await page.waitForTimeout(500);
  const groupSelects = page.locator('select[data-dispatch-field="dispatch.groupFactoryId"]');
  const groupCount = await groupSelects.count();
  const groups = [];
  for (let i = 0; i < Math.min(groupCount, 2); i += 1) {
    const select = groupSelects.nth(i);
    const groupKey = await select.getAttribute('data-group-key');
    await select.selectOption('ID-F017');
    await page.waitForTimeout(200);
    const judgement = await page.locator('[data-dispatch-group-sam-judgement="' + groupKey + '"]').innerText();
    const demand = await page.locator('[data-dispatch-group-sam="' + groupKey + '"]').innerText();
    groups.push({ groupKey, judgement, demand });
  }
  return {
    groupCount,
    groups,
    hasIndependentJudgement: groups.length === 2 && groups[0].groupKey !== groups[1].groupKey,
    demandDiffers: groups.length === 2 && groups[0].demand !== groups[1].demand,
    hasExceeded: groups.some((item) => item.judgement.includes('超过当前窗口可承载能力') || item.judgement.includes('超过任务截止时间')),
  };
}
