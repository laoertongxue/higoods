# 主代理改动的独立对抗式审查

审查日期：2026-09-18。审查者：Codex 子代理 `wool_stage_pages`；修复者：主代理。本轮业务源码只读，按主代理要求新增了专项测试 `scripts/check-wool-adversarial-regressions.ts`，未修改被审查实现。

## 1. 版本、范围与结论边界

- 工作树：`/Users/laoer/Documents/higoods/.worktrees/work-20260918`。
- 分支：`codex/work-20260918`；基准 HEAD：`4804328a822eec3c77eee1ffa5b10911bb77c9fe`。被审查内容包含尚未提交的本任务差异，HEAD 本身不能代表这些差异。
- 服务：`5186` 开发服务与 `4186` 生产预览的进程 cwd 均经 `lsof -a -p <PID> -d cwd` 确认为上述工作树。本轮两项真实点击复核使用 `http://127.0.0.1:5186`。
- 范围：`main.ts` 毛织直达加载和事件分发；统一收货演示批次与毛织初始化；印花固定演示初始化；KOL 任务生成复用；PDA 毛织仓储摘要、流水；本轮新增浏览器与性能脚本。
- 不包含：另一审查代理负责的末道工艺与最终下游；全部页面的性能、打印和完整链路验收；未经本轮执行的旧测试结论。

**本轮发现 2 项 P1、4 项 P2，主代理已修复。三个数据反例的 7 项专项、PDA 返回及站内切换真实点击已复核通过；测量脚本的错误通过条件已按最终源码复核移除。当前范围内没有遗留的已确认 P1/P2。此结论仅关闭列出的缺陷，不构成总体交付通过：完整性能与逐入口五样本证据仍未关闭。**

## 2. 发现、复现、修复与复核

### ROOT-01 / P1：初始化存储失败后仍能读到毛织半成事实

涉及位置：`src/data/fcs/factory-receiving.ts:38`、`src/data/fcs/wool-domain/mock-receiving.ts:79`、`src/data/fcs/wool-domain/store.ts:873`。

原行为：毛织初始化先把新对象发布为 `memoryStore`，再进入共享收货批次。回调已投影片实收、纱线实收及完单，并写入初始化标记；共享收货最终持久化失败只回滚 receiving。第二次读取会直接返回仍在内存中的毛织半成对象。

最小反例：独立 Map storage 对 `higood-factory-material-receiving-v1` 的 `setItem` 抛错；第一次 `readWoolStore()` 失败；恢复写入后再读。修复前实际输出：

```json
{"secondReadSucceeded":true,"hasInit":true,"receivingReceipts":0,"woolYarnReceipts":13,"pieceReceipts":10,"completions":7,"savedWool":false}
```

修复：`readWoolStore` 在局部草稿中完成共享收货、校验和毛织持久化后才发布 memory；发生后续失败且 receiving revision 已变化时恢复 receiving 快照。批次自身继续在失败时恢复缓存和 revision。

复核：新专项分别让 receiving key、wool key 写入失败；两次连续读取都必须失败，receiving 快照不变且 wool key 不存在；恢复存储后重新读取、清缓存再读取，实收记录不重复，初始化标记只一条。四项通过。共享收货原有 batch 专项再次通过。此测试使用单 key 的明确失败注入；不声称具备跨进程或浏览器崩溃事务能力。

### ROOT-02 / P1：其他工厂未绑定备料进入本厂仓储摘要

涉及位置：`src/data/fcs/factory-mobile-warehouse.ts:105`。

原行为：通过本厂流水的 `woolOrderId` 集合过滤已经聚合的库存。备料的加工单 ID 都为空字符串，本厂有一笔备料时，其他工厂同为空 ID 的备料也会命中。接收和交出计数还曾遍历所有加工单。

最小反例：在独立 store 中创建合法的另一厂横机/缝盘配对，登记另一厂未绑定纱线来源，通过 `prepareFactoryReceipt` / `savePreparedFactoryReceipt` 实收 123 kg。本厂原摘要 310 kg，修复前变为 433 kg。未伪造仓储流水，来源和实收都是共享接收事实。

修复：先按工厂筛选流水，再聚合库存；接收记录和交出记录只从本厂加工单集合取值。

复核：新专项真实保存另一厂 123 kg，断言另一厂实际接收可读、本厂整份摘要完全不变、本厂流水不包含这筆来源。通过。

### ROOT-03 / P2：PDA 毛织详情首次点击返回无效

涉及位置：`src/main.ts:376`、`src/pages/pda-wool-fact-execution.ts:520`、`src/pages/pda-exec-detail.ts:4373`。

原行为：毛织根容器内的“返回”属于通用执行详情事件，毛织专用 handler 返回 false；main 提前返回该 false，通用详情 handler 永远收不到事件。

修复：毛织 handler 处理成功才返回；未处理时继续分发给 `handlePdaExecDetailEvent`。

复核：全新隔离 Chromium 上下文、360×800，打开 `/fcs/pda/exec/TASK-WOOL-STAGE-002%3AKNITTING`，首次点击根容器内“← 返回”，实际 URL 变为 `/fcs/pda/exec`，`pageerror=[]`。这是一次功能复核，不是五样本性能证据。

### ROOT-04 / P2：负数库存调整抵消出库总数

涉及位置：`src/data/fcs/factory-mobile-warehouse.ts:141`、`src/pages/pda-wool-warehouse-flows.ts:34`。

原行为：正常出库流水 qty 为正、分配转出调整 qty 为负。虽然按方向选择了两者，展示却直接加 raw qty；10 kg 领用与 -4 kg 转出显示成 6 kg，卡片还出现 -4 kg。

修复：方向卡片和入/出库聚合采用 `Math.abs(woolWarehouseFlowSignedQty(flow))`；账本保持原始符号以用于守恒。

复核：新专项通过共享分配命令转出 4 kg，再通过真实领料命令领用 10 kg，今日出库为 2 笔、14 kg。PDA HTML 卡片分别为 4 kg 与 10 kg，单位分组汇总与同源事实一致，原始分配流水仍为 -4 kg。两项通过。

### ROOT-05 / P2：性能脚本站内切换按钮不在应用事件树中

涉及位置：`scripts/check-wool-route-performance.mjs:44`、`src/main.ts:1622`。

原行为：脚本把 data-nav 按钮挂到 `document.body`，应用只在 `#app` 上委托点击。事件不会向子节点传播，实际没有路由切换，只会等超时。这会产生失败，不能作为有效的站内切换测量。

修复：按钮插到 `#app`；以点击捕获时间启动观察，排除旧 root；修正 `waitForFunction` 的参数位置。

复核：1366×768 真实浏览器中从横机列表插入同样的按钮并点击，实际切到 `/fcs/craft/wool/linking-orders`，缝盘标题存在，`pageerror=[]`。源码确认目标根替换、图片 decode 与两帧绘制均进入计时；超时和图片失败均返回 fail。没有在本轮重跑全路由五样本，也不把这次导航验证当成计时通过。

### ROOT-06 / P2：功能脚本可能输出错误的 performancePass

涉及位置：`scripts/check-wool-stage-browser.mjs:11`、`:56`。

原行为：必要图片 `decode().catch(()=>{})` 吞错；结尾只检查 routes/actions 的 every，没有非空和 errors 门禁。首次导航失败、数组为空时，控制台可能显示 `performancePass:true`，虽然退出码仍为 1。多个保存动作仅一例，也不满足每项至少五次。

修复：该脚本明确降为功能与截图证据，图片失败向外抛出，functionalPass 同时要求无错误、5 项检查、6 条路由；最终固定输出 `performanceStatus: NOT_ASSESSED_BY_THIS_SCRIPT`。操作耗时字段改为 `diagnosticDriverInclusiveMs`，不用于性能通过。

复核：最终源码和 `node --check` 通过；无条件 performancePass 已删除，不再吞图片错误。修复后完整脚本运行由主代理合并证据，本审查不据此声称截图、所有动作或性能已通过。

## 3. 本轮没有发现问题的具体范围

1. `main.ts` 对横机/缝盘详情、打印的直接加载保留明确阶段并向页面传入，未新增旧加工单地址。data-nav 与图片预览在专用处理器前处理；此次优化没有新增在局部事件分支整页重绘的逻辑。监听器先注册、初次 render 后执行，未发现首次渲染前缺失 root 监听器。
2. `initializeFactoryReceivingDemoBatch` 只在同步固定演示初始化使用。每笔实收仍先 prepare，来源数量、工厂、库位等校验没有省略。共享接收单模块的单次持久化、中途异常、存储异常回退专项通过；跨 wool 回调的缺口按 ROOT-01 单独覆盖。
3. `printing-factory-demos.ts` 的改动限于固定演示收货使用 prepare/save，避免无关 PDA 登录工厂阻断演示初始化。它使用固定来源、固定接收 ID、对应订单工厂；真实用户确认仍走 `confirmFactoryMaterialReceipt`。没有把该演示专用路径接到用户收货按钮。未修改或复核其他印花生产操作的全部行为。
4. `process-tasks.ts` 将已经按生产单分组的 artifacts 传给 KOL 构建函数；独立调用保留原生成路径。使用当前数据的 5 个 KOL 生产单逐一对比独立生成与批量复用结果，深度相等。主代理报告的另一个既有 KOL 专项失败不属于本条比较证据，也未被本审查写为已通过。
5. PDA 流水由运行会话工厂确定范围，不接受 URL 指定任意工厂；读取页没有新增接收或加工写操作。kg、片、件仍分组显示。修复后的同厂摘要与负数方向展示有上述反例证据。
6. 新 route-performance 脚本每条路由分别设置 5 个空上下文 cold、同上下文 refresh、真实应用切换；PDA 只预置登录，无预置毛织业务事实。总体 pass 要求所有预定路由、无错误、所有原始样本通过；没有把图片失败或超时算成功。它只覆盖页面加载，不能替代每个交互入口的五样本测量。

## 4. 已执行证据

| 核查 | 结果 | 范围限制 |
|---|---|---|
| `node --import tsx scripts/check-wool-adversarial-regressions.ts` | 7 项通过，退出码 0 | 隔离内存事实和 PDA HTML；无浏览器性能声明 |
| `node --import tsx scripts/check-wool-receiving-demo-batch.ts` | 通过，退出码 0 | receiving 单模块事务，另由新专项覆盖 wool 初始化 |
| 当前 5 个 KOL 生产单：独立生成与批量复用 `assert.deepEqual` | 5/5 通过 | 仅本次复用优化的行为等价性 |
| 5186 PDA 首次返回 | 成功，pageerror 空 | 360×800，新隔离上下文，一次功能样本 |
| 5186 站内 data-nav 真实分发 | 成功，pageerror 空 | 1366×768，一次功能样本 |
| 两个浏览器脚本 `node --check` | 通过 | 仅语法和另述静态门禁核查 |
| `git diff --check -- scripts/check-wool-adversarial-regressions.ts` | 通过 | 新专项文件空白检查 |

新专项最后执行原始摘要：`PASS 7 adversarial regression checks; no browser/performance claim.`。测试执行不访问用户浏览器的 localStorage、登录数据或线上系统。浏览器运行使用独立 Playwright 上下文；第一次受沙箱 MachPort 限制未启动，授权执行后的两项复核才作为证据。

## 5. 剩余与交付判断

- 当前缺陷修复的功能复核已完成；若受审查文件再次实质修改，对应证据须重跑。
- 完整浏览器功能脚本的本次最终运行结果、全部必要图片及打印最终页效果，仍由主代理纳入矩阵；本记录不替代这些证据。
- **性能总体不通过。** 本记录没有执行每条受影响路由的 cold / refresh / route switch 和每项交互各五次完整计时。已知性能整改仍在继续；任何当前原始样本 `>=200ms` 或缺失项均必须保持未验证，不能使用本轮 7 项通过或单次真实点击作为豁免。
- 矩阵 `VERIFY-003～005`、适用页面/PDA/打印行仍须按最终证据关闭。当前只能确认本文件列出的对抗反例已解决，不能宣称总体任务完成。
