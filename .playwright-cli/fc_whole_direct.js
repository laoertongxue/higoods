async (page) => {
  await page.goto('http://127.0.0.1:4178/fcs/dispatch/board', { waitUntil: 'networkidle' });
  await page.click('[data-dispatch-action="open-direct-dispatch"][data-task-id="TASKGEN-202603-0008-001__ORDER"]');
  await page.waitForTimeout(500);
  await page.click('[data-dispatch-action="switch-dispatch-mode"][data-dispatch-mode="TASK"]');
  await page.waitForTimeout(300);
  await page.selectOption('select[data-dispatch-field="dispatch.factoryId"]', 'ID-F017');
  await page.waitForTimeout(300);
  const text = await page.locator('[data-dispatch-task-sam-judgement="selected-factory"]').innerText();
  return {
    text,
    hasCapable: text.includes('当前窗口内可承载'),
    hasWindowDays: text.includes('未来') && text.includes('天'),
    hasSupply: text.includes('共计'),
    hasCommitted: text.includes('已占用'),
    hasFrozen: text.includes('已冻结'),
    hasRemaining: text.includes('剩余'),
    hasEstimatedDays: text.includes('预计消耗'),
  };
}
