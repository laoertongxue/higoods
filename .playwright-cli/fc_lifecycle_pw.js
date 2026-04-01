async (page) => {
  await page.goto('http://127.0.0.1:4178/fcs/dispatch/board', { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    const context = await import('/src/pages/dispatch-board/context.ts');
    const ledger = await import('/src/data/fcs/capacity-usage-ledger.ts');
    context.syncDispatchCapacityUsageLedger();
    const freezes = ledger.listCapacityFreezes();
    const commitments = ledger.listCapacityCommitments();
    const pickFreeze = (taskId, factoryId) => freezes.find((item) => item.taskId === taskId && item.factoryId === factoryId);
    return {
      accepted: {
        freeze: pickFreeze('TASKGEN-202603-0002-001__ORDER', 'ID-F002'),
        commitment: commitments.find((item) => item.taskId === 'TASKGEN-202603-0002-001__ORDER' && item.factoryId === 'ID-F002'),
      },
      tenderReleased: {
        freezeF006: pickFreeze('TASKGEN-202603-0004-001__ORDER', 'ID-F006'),
        freezeF007: pickFreeze('TASKGEN-202603-0004-001__ORDER', 'ID-F007'),
      },
      tenderAwarded: {
        freeze: pickFreeze('TASKGEN-202603-0004-001__ORDER', 'ID-F003'),
        commitment: commitments.find((item) => item.taskId === 'TASKGEN-202603-0004-001__ORDER' && item.factoryId === 'ID-F003'),
      },
    };
  });
  return result;
}
