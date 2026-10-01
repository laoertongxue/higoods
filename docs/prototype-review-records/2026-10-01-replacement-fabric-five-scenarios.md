# 换片布五行演示场景

## 1. 基本信息

2026-10-01；main @ e7aa82b5；/Users/laoer/Documents/higoods；管理端；preview43236、dev43235。用户要求五行 Mock，覆盖多种业务场景。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：四个独立演示生产批次及其裁床、车缝任务分配，静态菲票、打印与历史交出回执；原三面料生产单保留。
- 基线：AGENTS.md。静态数据直接读取，用户动作仅保存变化记录到 IndexedDB，不首次写入演示种子。

## 3. 自查结论

| 项目 | 结论 | 依据 |
| --- | --- | --- |
| 数量和来源 | 通过 | 五行14张有效票、7张已打印、70 Yard；另1张失效历史票 |
| 物料图片 | 通过 | 灰色主面料、黑色拼接面料、白色府绸袋布均复用对应正式物料图，列表与票面同对象 |
| 状态与交接 | 通过 | 9001部分打印、9002补打、9003两张已交与两张备用、9004失效历史；回执对应存在的车缝任务和接收工厂 |
| 存储边界 | 通过 | 首读0条记录；补打与新增后只写2条换片布变化记录；刷新保留修改，不把其他演示单写入 |

## 4. 问题标签

- Mock 场景不完整

## 5. 需求、实施与追踪

五行分别覆盖：0002三面料全待打印；9001两面料各两票且只打印两张；9002单面料一票且补打一次；9003两面料各两票、每种交出一票并保留一票；9004两面料待打印和一张不可操作的失效历史票。均为固定原型场景，不代表真实工厂操作。

| 编号 | 实施 | 验证 | 状态 |
| --- | --- | --- | --- |
| MOCK-01 | buildReplacementFabricDemoOrders及裁床/车缝初始分配；保留既有多面料单 | 五行及用料数量断言 | 已验证 |
| MOCK-02 | buildReplacementFabricDemoState：稳定票号、打印、补打和交出回执 | 单测及详情/真实票面浏览器 | 已验证 |
| MOCK-03 | replacementStateFromRecords按ID覆盖，事务只保存静态基线以外记录 | 隔离浏览器首读、补打、新增、刷新 | 已验证 |
| MOCK-04 | 五行筛选、详情、放大、单选及整单打印、失效票排除 | 三尺寸与逐项性能 | 已验证 |

存储登记：静态源为 replacement-fabric-demo.ts 及既有技术资料 JSON；用户修改为 higood-cutting-records-v1 的 replacement-tickets/prints/receipts；沿用已有写事务和备份入口，不新增 localStorage 业务键。静态历史身份不跟随改派重建；同ID持久覆盖优先。无需迁移旧数据。

实施顺序：补齐来源批次与任务 → 静态票据/回执 → 合并持久覆盖且不落整包种子 → 单测、存储与五行页面验证。只改这些来源和读取/差异保存逻辑，不改页面布局、打印确认或交出门禁。

## 6. 最终结论

结论：通过。365个加载与交互样本全部<500ms，最大382.90000000596046ms，三尺寸无主体横溢。当前本地修改未提交、未发布。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/production-order-demo-tech-packs.json`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/cutting/replacement-fabric-demo.ts`
- `src/data/fcs/cutting/replacement-fabric-repository.ts`

### 页面路由

- `/fcs/craft/cutting/replacement-fabric-fei-tickets`
- `/fcs/print/preview?documentType=REPLACEMENT_FABRIC_LABEL`

### 验证命令

- `npm run build`：通过，567项单元测试通过，Vite构建9.53秒。
- `playwright-cli run-code --filename output/playwright/hpb-five/storage.js`：通过，首读0条，补打与新增仅2条换片布变化，刷新一致。
- `playwright-cli run-code --filename output/playwright/hpb-five/browser.js`：通过，265样本；另navigation 5样本、toolbar 95样本均通过。

### 例外

- 无性能例外。实物出纸不属于本次Mock场景补齐。既有记录和用户网站数据未清空。

### 证据

[evidence/2026-10-01-hpb-five](evidence/2026-10-01-hpb-five) 包含本次脚本、原始耗时、三尺寸截图、五种详情和代码指纹。最终收据：`output/playwright/hpb-five/task-receipt.json`。历史三面料证据仅作为前一轮记录。

验证版本为上述base加version.json指纹；实现与自动化核验人：Codex。用户业务口径来自本次“五行、多场景”要求，尚无用户最终接受回执。

最终审查修正：9004原第1张票在2026-09-27创建、次日失效，当前主面料第2张票在失效后创建，保持序号和时间一致。受影响页面在最后修改后重新生成证据。

计时修正：browser-final.json保留629.7ms和517.6ms原始样本；该脚本把预览就绪后的关闭窗口清理动作包含在打开预览耗时内。最终browser.js在票面、二维码和图片就绪后、关闭窗口前记录结束时间。browser-target-ready.json全部265样本通过，另navigation-final.json 5样本和toolbar-final.json 95样本通过，未使用平均值或删除样本掩盖结果。旧browser.json仅为先前迭代。
