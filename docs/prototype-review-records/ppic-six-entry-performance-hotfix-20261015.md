# PPIC 六入口性能专项本地冻结记录

依据 [AGENTS.md](../../AGENTS.md) 的SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。继承R51/R52/R58/R59及[H01-H04方案](../product-design/ppic-six-entry-performance-hotfix-20261015.md)，只关闭本地阶段，正式性能另验。旧六类慢样本保持原身份。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：PPIC六入口性能专项H01-H04
- 验证人：Codex主代理；一个独立只读审查代理

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：四个精确入口使用原record-aware renderer避开无关注册表；只读裁片单ID不再载入整套配料/染印。物料账块864KB降26KB；数量/身份/状态/事务/门禁不变。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 路由及身份 | 通过 | 精确四入口与原mapping同const/同参数；主初始化未改，未登录/当前人及命令身份保持，独立累计diff无新增P1/P2 |
| 数量/BOM/单位 | 通过 | material-contract.json两个辅助原体及ID读取规范化原体一致；8base+7seq+15默认身份及实际4个runtime cut IDs与干净main等值；歧义仍不选，13裁床专项通过 |
| 记录恢复及原子保存 | 通过 | 22浏览器及最终111Web/21PDA；失败输入保留、零半套、重试唯一、正式100实收/PPIC10分摊、399→499、独立新文档/刷新一致 |
| 当前人与两节点 | 通过 | 原角色/任务工厂、两节点分配及合同、原截止不变，实际页面操作回放 |
| 页面/图片/合同 | 通过 | 1366/1280/1024 Web及390×844 PDA；真实对应图、Esc、新两页合同；图片原件字节未改，实际本地截图在最终run目录 |
| 本地指定性能 | 通过 | 六类30有效样本，全部≤1000ms，最大481.5ms；相邻27类135样本通过 |
| 正式性能及硬件接受 | 不适用 | 本记录仅本地阶段，正式新SHA另验；PDA为Chromium小屏，打印为电子合同 |

## 最终结论

结论：通过

只支持本地冻结，正式六入口及版本/资源另验，未宣称整体交付或工厂接受。

## 变更覆盖与验证

### 受管文件

- `src/router/routes.ts`
- `vite.config.ts`
- `src/data/fcs/cutting/material-ledger.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/material-prep-cut-order-read.ts`
- `src/data/fcs/cutting/material-prep-seed-identities.ts`

### 页面证据

- 版本：codex/ppic-daily-return，基准3b114622加六运行文件，逐文件SHA见local-six-summary.json；生产HTML SHA256 `70e2b34e00f82dce9c5c92514a790533bfc99169526598e37e47d9ce32d817cf`；工作树/Users/laoer/.codex/worktrees/5f34/higoods，真实Chromium149/Asia/Jakarta，生产预览5529，浏览器服务5482。未修改用户资料或外部数据库。
- 证据：output/ppic-performance-hotfix-20261015/material-contract.json、build.log、build-final.log、browser.log、cutting-gate.log；最终local-check-final.log与online-acceptance-local.json/online-pda-acceptance-local.json绑定上述HTML。前一候选及正式3b慢样本原件保持，首个material-contract路径错误日志不计产品失败，修正后原版等值实际通过。

### 性能结论

- 结论：通过
- 依据：六入口导航起点到正确内容、全部必要图片、有限动画及两次绘制；实际控制动作到持久回读。每类5原值，冷report独立context；PDA同context新文档/共享自然HTTP缓存并有已保存承诺和会话，未冒称冷HTTP。dispatch补内部目标观察，保留toolObserved及旧慢样本；均无替换JS/CSS或mock clock。正式135样本待另验，本地未替代。

### 验证命令

- `npm run build`：通过
- `npx vite build`：通过
- `npx playwright test --config tests/ppic-daily-return.config.ts`：通过
- `npm run check:cutting:all`：通过
- `node --import tsx output/ppic-performance-hotfix-20261015/material-contract.mjs`：通过
- `node output/ppic-performance-hotfix-20261015/local-check.mjs`：通过

### 例外

- 无门禁例外。三条新增Web映射影响的实际入口使用最终生产预览回放；已验证H02/PDA 22源浏览器的未变化断言保持原身份，不为仅三个同renderer短路径重复全部浏览器。物料源相关13项由收据映射要求执行，未扩到旧工程/KOL。
- 收据约定output/ppic-performance-hotfix-20261015/task-receipt.json，最终冻结后实际生成；外部发布记录登记最终正式结果，不回写此冻结记录伪造时效。
