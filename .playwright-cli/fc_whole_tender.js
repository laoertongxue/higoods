async (page) => {
  await page.goto('http://127.0.0.1:4178/fcs/dispatch/board', { waitUntil: 'networkidle' });
  await page.click('[data-dispatch-action="open-create-tender"][data-task-id="TASKGEN-202603-0002-004__ORDER"]');
  await page.waitForTimeout(500);
  const text = await page.locator('[data-tender-factory-sam="ID-F002"]').innerText();
  return {
    text,
    hasDateIncomplete: text.includes('日期不足'),
    hasCommitted: text.includes('已占用'),
    hasFrozen: text.includes('已冻结'),
    hasRemaining: text.includes('剩余'),
  };
}
