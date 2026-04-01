async (page) => {
  await page.goto('http://127.0.0.1:4178/fcs/dispatch/board', { waitUntil: 'networkidle' });
  await page.click('[data-dispatch-action="open-direct-dispatch"][data-task-id="TASKGEN-202603-0008-001__ORDER"]');
  await page.waitForTimeout(500);
  await page.click('[data-dispatch-action="switch-dispatch-mode"][data-dispatch-mode="TASK"]');
  await page.waitForTimeout(300);
  await page.selectOption('select[data-dispatch-field="dispatch.factoryId"]', 'ID-F017');
  const text = await page.locator('[data-dialog-panel="true"]').innerText();
  return {
    hasStandardTimeLabel: text.includes('单位标准工时') && text.includes('任务总标准工时'),
    leaksInternalFieldName: text.includes('publishedSam') || text.includes('stdTimeMinutes'),
  };
}
