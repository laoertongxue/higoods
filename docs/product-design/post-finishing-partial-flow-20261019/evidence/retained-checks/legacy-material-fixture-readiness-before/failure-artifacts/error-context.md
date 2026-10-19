# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-pda-role-boundary.spec.ts >> 已有 001 入库历史不被覆盖并自动补齐新增待入库测试单
- Location: tests/post-finishing-pda-role-boundary.spec.ts:159:1

# Error details

```
Error: page.evaluate: Error: 请先重新读取后道辅料资料，再确认入库。
    at translate (http://127.0.0.1:43915/src/data/fcs/post-finishing-records.ts:267:10)
    at Module.runPostFinishingCommand (http://127.0.0.1:43915/src/data/fcs/post-finishing-records.ts:321:11)
    at eval (eval at evaluate (:303:30), <anonymous>:5:19)
    at async <anonymous>:329:30
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - main [ref=e8]
  - navigation [ref=e24]:
    - generic [ref=e27]: 接单
    - generic [ref=e30]: 执行
    - generic [ref=e33]: 交接
    - generic [ref=e36]: 仓管
    - generic [ref=e39]: 结算
```