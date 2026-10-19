# 中央工厂 PDA 目录入口修正

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-19
- 任务 / 需求编号：NEWPDA-PUBLISH-V34 / NP-06、NP-07
- 验证人：Codex 主代理

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：首轮 ac14fc7e 的 60 个静态资源均已上线且与本地一致，但服务器 /newpda/ 回退到了主站 HTML。根 index.html 增加仅匹配 /newpda 与 /newpda/ 的同步入口跳转，转到 /newpda/index.html，保留 query/hash。原页面业务、PDA 运行文件及 Caddy 配置均不改。
- 范围：本次只修正用户指定发布入口。沿用上一轮静态包及数量 / 状态 / 图片证据；新增目录入口契约与浏览器验证。T3 + T5。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
|---|---|---|
| 目录入口 | 通过 | /newpda 和 /newpda/ 均转到真实独立首页，location.replace 不增加无效返回层 |
| 参数保留 | 通过 | 工序、screen、lang、hash 完整保留；5 次浏览器实际跳转显示印尼语绣花接收 |
| 其他业务地址 | 通过 | 根站、旧 PDA、PCS、FCS、相似前缀、设计文件和图片路径均不匹配；3 项实际源码契约通过 |
| 初始化时序 | 通过 | 非 module 的同步入口脚本在业务 module 脚本之前执行 |
| 数量 / 状态 / 交接 / 保存 | 不适用 | 仅导航入口，60 个设计资源字节不变；沿用 V34 已验证业务规则，无数据写入 |
| 图片 / 打印 | 不适用 | 未改任何图片、显示尺寸、图片交互或打印；沿用静态包图片证据 |
| PDA 布局和语言 | 通过 | 360×744 实际显示 Rina、Pabrik pusat、Terima、Bordir 与 20 panel 来源单据，无页面异常 |

## 最终结论

结论：通过

本地入口修正验证通过。首轮公网目录失败原证据保留；最终 Production SHA/run_id 与浏览器结果在补丁部署后另行记录，不冒称首轮已满足目录访问。

## 变更覆盖与验证

### 受管文件

- `index.html`

### 页面证据

- 版本：基准 ac14fc7e75c5cae4c062c3c17c4ca12c8e1d31c3，codex/publish-newpda-v34；只修改 index.html 的 6 行入口脚本。服务 http://127.0.0.1:48336 模拟当前 Caddy 目录回退：目录 URL 返回根 HTML，其他资源读取同工作树 dist；Chrome，360×744。
- 证据：独立设计目录 verification/publish-v34/directory-entry-browser.txt；实际跳转到 /newpda/index.html?op=绣花&screen=receive-list&lang=id&v=34#note。没有页面异常。原 production-asset-verification.json 保留首轮目录失败事实和 60 文件正确上线路径。

### 性能结论

- 结论：通过
- 依据：5 个独立无缓存浏览器 context，导航前开始计时至最终页面内容、账号与两帧绘制结束，包含两跳导航，最大 262ms；原始样本在 directory-entry-browser.txt。仅表示本地目录回退夹具，公网响应另测。

### 验证命令

- `node --import tsx --test /Users/laoer/.codex/visualizations/2026/10/17/central-factory-pda/verification/publish-v34/entry-contract.test.ts`：通过
- `Playwright CLI directory-entry browser checks`：通过

### 例外

- 无。仅技术验证，不代表真实业务接入或现场员工验收。
