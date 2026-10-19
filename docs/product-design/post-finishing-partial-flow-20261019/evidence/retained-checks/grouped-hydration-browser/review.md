# 第18节恢复与严格校验浏览器回放

2026-10-20，主代理；当前工作树，强制新开发服务127.0.0.1:43914，不复用其他工作树服务。原C3消费者测试未改，输入为此前实际UI D1/合法订正持久结果的副本。

实际命令：POST_FINISHING_EVIDENCE_ROOT=/tmp/post-finishing-partial-flow-20261019/grouped-hydration-browser PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43914 CUTTING_E2E_TEST_TIMEOUT=180000 npm run test:e2e -- tests/post-finishing-consumers.spec.ts --grep 'A22:' --workers=1 --reporter=json。exit0，expected1/unexpected0，25.947秒是测试总时间，不是产品性能。

4种基础错误、6种责任／录入人错误和15种数量／来源／订正关联错误共25种全部拒绝。15个关系结果逐项unchanged与inputRetained为true，总unchanged=true。合法订正恢复控制也通过，原严格validator没有减少校验。源码副本绑定F/V/R和未改变的测试；Node11状态对照不代替本次浏览器。其余原子保存、迁移和全组合仍在最终receipt执行，不称本单例覆盖全部。
