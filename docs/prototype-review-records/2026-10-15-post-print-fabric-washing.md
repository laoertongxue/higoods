# 印花后面料水洗实施与专项审查记录

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、TRACE-01、STORE-01～05、REVIEW-01、PERF-01 和 EVIDENCE-01。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：印花后面料水洗 WASH-001～WASH-205；WP-01～WP-10
- 验证人：Codex 主代理（技术验证；不代表用户接受或工厂现场确认）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：面料印花实际完成后的现场触摸、三手感建单、染厂真实执行和交回；按卷放行；新静态路线和初始拆解退出固定水洗；涉及必要印花/接收记录、Web/PDA、打印及存量切换，按 T4。用户要求本地完成，不提交、不推送、不发布。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 业务目标及现场边界 | 通过 | R1～R13；现场触摸由人登记，系统不声称自动识别触摸；仅目标手感，不建立线上助剂或配比。 |
| 实际完成、批次、整卷及六来源 | 通过 | 单元 CT-01～04；浏览器 14 项基础契约与 10 项追加边界；保留 rootSource、来源和最终目标。 |
| 数量、差异、状态及角色 | 通过 | 不设固定缩水，不混单位；真实实收、投入、产出、交回、下游实收及人工完单分别登记。 |
| 新路线与初始拆解退出 | 通过 | route-codec、technical-pack-demo-completion 单元及实际混合流转契约；不重建裁剪车缝任务。 |
| 同库原子保存与失败保护 | 通过 | CT-08/09/10：空间错误、事务中止、稳定标识重试、双标签、升级阻塞、versionchange、旧源指纹与续迁。 |
| 必要附件与 FCS 资料保护 | 通过 | 原图转 Blob、同图复用、坏格式/缺引用/重复/冲突保护、隔离恢复及全库引用复核；仅 wash-file- 清理。 |
| Web/PDA 真实入口、图片、打印 | 通过 | 当前生产UI报告覆盖真实点击/直达/刷新、图片正常和失败、大图三种关闭，独立A4 PDF与纸面检查通过。 |
| 全部适用性能逐次不超过 1000ms | 通过 | 1675个有效样本，263个家族最少5次，最大905.90ms；完整原始数据及历史失败保留。 |
| 需求正反向覆盖与最终治理 | 通过 | 205条连续唯一，逐条实际绑定及当前支持证据；46个运行文件及测试/脚本反向归属WP-01～10，未说明遗漏为0。 |

## 两轮对抗审查

两轮均由主代理执行，没有创建或派发独立审查子代理，不冒称独立人员验收。审查对象为四份需求文档、本轮全部运行差异、专项契约、页面与失败记录；修复后重放受影响场景。

| 轮次 | 攻击面与具体问题 | 修复与复核 |
| --- | --- | --- |
| 第一轮 | 正常交出与水洗混合时，新持久交接空结构缺必要数组，可能失败。 | 补齐仅必要空根结构；真实正常交出 50 + 水洗交出 50，印花实发合计 100，原裁剪车缝任务快照不变。 |
| 第一轮 | 重包新码可能脱离原卷，历史可用量兜底可能超过真实水洗实收。 | 保留 originRollId；洗后分配和领用追溯原卷；实际库存 50 时，即使旧可用量 9999，领用 51 仍阻断。 |
| 第一轮 | 已提交提前匹配仅在联读视图出现，完整备份可能丢关联；匹配后旧打印可能不提示重印。 | 备份冻结真实已提交关联，保留原事务事实所有权；打印内容签名覆盖关联及目标，真实匹配/刷新/隔离恢复均复核。 |
| 第一轮 | 上游版本变化后异常恢复可能继续使用旧判断。 | 所有实物命令核对当前卷版本；负责人核对同一实物范围后更新版本且保留判断历史。 |
| 第二轮 | 路由包装无法覆盖 main.ts 对 PDA 交接的直接渲染；相关缓存先按空源建立。 | 真实主入口先读原 PCS/FCS 与专项资料；记录改变后更新相关缓存；PDA 仓库实际重定向后的交接页显示同一真实水洗库存。 |
| 第二轮 | 毛织演示收货在普通读取时整包写盘；改为只读后刷新又会丢固定演示实收。 | 固定演示行仅内存回退，用户持久记录优先；从原固定夹具重建，绝不把后续用户交出自动当作实收。印花保存后刷新及 PDA 仓库直达复核。 |
| 第二轮 | 旧片段清理失败后的同操作重试未继续清理；旧标签再写可能被后续清理吞掉。 | 仅重复 JUDGE 重试安全收集必要旧片段，保留单号；用已提交迁移指纹复核旧片段。正常续迁与旧写冲突两个相反场景均验证。 |
| 第二轮 | 标准列表发出 sort-column，专项处理器监听 sort，排序无效；列设置能力需实际核验。 | 对齐公共事件与三态排序；以 18 张真实持久单核验升/降/默认、列显隐、冻结、拖动、恢复及分页。 |
| 第二轮 | 仅用直达地址会漏掉 PDA 建单后的真实跳转；维护成功后的统计可能显示旧值，零附件不能覆盖真实 Blob I/O。 | PDA 成功链接与已有判断链接保持 PDA 通道，并复用执行导航；真实点击、直接打开、刷新分别测量；恢复/清理后即时回读统计，真实 PNG Blob 备份分家族验证。 |
| 第二轮 | Web 染厂仓库也绕过读取包装；水洗库存行缺少专属单据/执行跳转，新码在待交出查询中未纳入检索。 | 主入口与四个既有印花/染厂仓库渲染路径补齐同源读取；库存投影保留 washingOrderId，水洗行明确身份并打开真实水洗单/PDA，避免通用染色流程；新码查询纳入真实 fabricRollNo；直达、刷新、筛选、唯一库存与跳转复测。 |
| 第二轮 | 染厂仓库通过缓存对象及动态 Tab 生成列表，标准列表结构无法被静态门禁追踪；水洗列表的异步条件返回也遮住了 Web 列表入口。 | 将仓库控制器和渲染封装为单一缓存表实例，主库存内容直接组合，保留原 Tab、分页、列设置和偏好；水洗 Web 返回与 PDA 包装分支明确。未改检查器或基线；静态门禁及真实仓库 Tab/列设置/筛选/跳转复测通过。 |
| 第二轮 | PDA 图片安装先于异步页面实际挂载，失败图仍停留“加载中”；大图关闭按钮曾在委托根之外。 | 捕获实际挂载后的原生图片事件；大图原生关闭、遮罩和 Esc 均复测；失败态和正常真图分别取证。 |

## 最终结论

结论：通过

本轮本地技术验证完成，205条矩阵及两轮审查按当前命名版本与证据关闭；用户接受、真实工厂执行和生产发布分别登记。

## 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/design-revision-pcs-command.ts`
- `src/data/fcs/design-revision-pcs-storage.ts`
- `src/data/fcs/dyeing-warehouse-view.ts`
- `src/data/fcs/fabric-washing-gates.ts`
- `src/data/fcs/fabric-washing-maintenance.ts`
- `src/data/fcs/fabric-washing-mock.ts`
- `src/data/fcs/fabric-washing-model.ts`
- `src/data/fcs/fabric-washing-repository.ts`
- `src/data/fcs/fabric-washing-storage-bridge.ts`
- `src/data/fcs/fabric-washing.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-receiving-types.ts`
- `src/data/fcs/factory-receiving-warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/printing-factory-demos.ts`
- `src/data/fcs/printing-material-receipts.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/wool-domain/mock-receiving.ts`
- `src/data/pcs-record-db.ts`
- `src/data/pcs-technical-data-demo-completion.ts`
- `src/data/pcs-technical-data-demo-projection.ts`
- `src/data/production-timing/source.ts`
- `src/data/tech-pack-process-route.ts`
- `src/main.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/dyeing/warehouse.ts`
- `src/pages/process-factory/dyeing/washing/storage-tools.ts`
- `src/pages/process-factory/dyeing/washing/work-orders.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/wls-inbound.ts`
- `src/pages/wls/raw/inbound-list.ts`
- `src/pages/wls/raw/washing-stock.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-pda.ts`
- `src/router/routes-wls.ts`
- `src/router/routes.ts`

### 页面证据

- 版本：detached HEAD 67499ec61a1e770c39e5cdf3eddc4d2068eb7f4a 加本轮未提交差异；运行源码逐文件 SHA256、构建资产 SHA256 和脚本版本以专项 production-ui 报告及最终运行清单为准。工作树 /Users/laoer/.codex/worktrees/a266/higoods；正式验收服务 http://127.0.0.1:43158，为同工作树 Vite 生产预览；http://127.0.0.1:43157 仅用于开发诊断与浏览器原生数据契约，不混作生产性能。
- 证据：见 [专项验收索引](../verification-evidence/2026-10-15-post-print-fabric-washing/acceptance-summary.md)。管理端 1366×768、1280×720；主管员工 Web 1024×768；PDA Chromium 小屏视口 390×844，时区 Asia/Shanghai。采用独立上下文，不清理用户浏览器或真实业务数据。
- 图片：正式材料静态资源 /materials/fei-ticket/blue-white-print-cotton.png 对应蓝白碎花棉府绸 FAB-P200-BLUE-FLORAL，其他来源继承原正式面料图和 SKU；正常图、失败态、大图按钮/遮罩/Esc 与 contain 比例分别核验。
- 打印：真实点击打印前等待图片解码，捕获产品生成的独立 A4 文档，再由 Chromium 输出 PDF；不把 PDF 当作物理打印机或现场扫码验收。原生 Code128 数量与卷码映射、图文对应和纸面版式通过最终渲染图确认。

### 性能结论

- 结论：通过
- 依据：当前1675个有效原始样本、263个家族，每家族至少5次，最大905.90ms，全部<=1000ms，0无效和页面错误。测量从真实导航或 pointerdown/change/input/keydown 开始，结束为正确内容/状态/数量、必要图像就绪及两次动画帧；保存追加原生 IndexedDB 回读。每种冷态、刷新、站内、规模与成功/失败分支分别记录，不取平均掩盖超时。

### 验证命令

- `npm run build`：通过
- `node scripts/check-typescript-scope.mjs src/data/app-shell-config.ts src/data/fcs/design-revision-pcs-command.ts src/data/fcs/design-revision-pcs-storage.ts src/data/fcs/dyeing-warehouse-view.ts src/data/fcs/fabric-washing-gates.ts src/data/fcs/fabric-washing-maintenance.ts src/data/fcs/fabric-washing-mock.ts src/data/fcs/fabric-washing-model.ts src/data/fcs/fabric-washing-repository.ts src/data/fcs/fabric-washing-storage-bridge.ts src/data/fcs/fabric-washing.ts src/data/fcs/factory-internal-warehouse.ts src/data/fcs/factory-receiving-types.ts src/data/fcs/factory-receiving-warehouse.ts src/data/fcs/factory-receiving.ts src/data/fcs/pda-handover-events.ts src/data/fcs/printing-factory-demos.ts src/data/fcs/printing-material-receipts.ts src/data/fcs/printing-task-domain.ts src/data/fcs/process-order-task-links.ts src/data/fcs/production-artifact-generation.ts src/data/fcs/wool-domain/mock-receiving.ts src/data/pcs-record-db.ts src/data/pcs-technical-data-demo-completion.ts src/data/pcs-technical-data-demo-projection.ts src/data/production-timing/source.ts src/data/tech-pack-process-route.ts src/main.ts src/pages/pda-exec-detail.ts src/pages/pda-handover.ts src/pages/process-factory/dyeing/pending-receipts.ts src/pages/process-factory/dyeing/warehouse.ts src/pages/process-factory/dyeing/washing/storage-tools.ts src/pages/process-factory/dyeing/washing/work-orders.ts src/pages/process-factory/printing/work-order-detail.ts src/pages/production/detail-domain.ts src/pages/tech-pack/context.ts src/pages/wls-inbound.ts src/pages/wls/raw/inbound-list.ts src/pages/wls/raw/washing-stock.ts src/router/route-renderers-fcs.ts src/router/route-renderers.ts src/router/routes-fcs.ts src/router/routes-pda.ts src/router/routes-wls.ts src/router/routes.ts`：通过
- `node scripts/check-post-print-fabric-washing.mjs`：通过
- `node scripts/check-post-print-fabric-washing-edges.mjs`：通过
- `npm run check:menu-routes`：通过
- `node scripts/check-post-print-fabric-washing-ui.mjs`：通过
- `WASH_UI_MODES=Web1024 node scripts/check-post-print-fabric-washing-ui.mjs`：通过
- `npm run check:fcs-end-to-end`：通过
- `npm run check:wool-fact-workflow`：通过
- `CUTTING_E2E_USE_PREVIEW=false CUTTING_E2E_PORT=43159 PLAYWRIGHT_REUSE_EXISTING_SERVER=false npm run test:wool-fact-workflow:e2e`：通过
- `npm run check:standard-list-page-template`：通过
- `npm run check:prototype-design-governance -- --scope worktree`：通过
- `npm run check:list-page-governance -- --scope worktree`：通过
- `git diff --check`：通过

### 例外

- 本轮不提交、不推送、不部署，不声称真实工厂触摸、染厂线下加工、物理 PDA 或打印机已经验收。
- 全量 TypeScript 的 13 个既有错误位于任务范围外，范围统计见 types-final.log，原始诊断见 types-full.log；本轮 46 个运行文件的渐进类型检查为 0 错误，工程入口检查与构建通过。
- 额外执行的旧加工关系脚本在 HEAD 已存在的毛织阶段路由/对象断言上失败，原脚本及业务保持；原始日志单列为范围外背景失败，不作为本任务通过证据。水洗直接消费者由专项真实混合流转、提前匹配、生产关系页面及既有单元回归覆盖。


## 采集器与相邻回归校正记录

- 毛织浏览器用例的 /src 动态导入依赖开发服务，生产预览中的该组运行无效；有效毛织回归使用独立开发端口 43159，17 项通过，原运行日志保留。水洗完整响应仍单独在生产预览 43158 测量。
- 毛织列表已有正式来源投影，数量不止14个固定演示；原生回归按真实来源总数核对重置/分页，并通过既有每页50条控件定位目标后填报。保留实际收发、守恒、禁止超量、刷新及工厂范围结果断言。
- PDA 原有底部导航也有“接单”按钮，性能采集器改为在当前水洗单/实物来源内点击业务动作；每次非导航采样先清空旧事件起点，避免把未发生点击的定位错误误算成有效响应。原始严格定位失败和中断数据保留，不作为产品通过证据。

- 仓库列设置补测曾以同一动作属性同时命中遮罩、标题关闭和底部关闭，结束断言出现严格定位错误；该探测报告保留。采集器改为点击具有明确名称的“关闭”按钮，再检查所有关闭控件已移除；随后真实单轮及五轮复测追加，不改写原报告。

## 最终收据复核及证据复用

- 首次最终收据没有通过，原结果、完整日志和原生 trace 保留于专项证据 `failures/receipt-attempt-1/`。一项为单消费者的 tests/helpers 夹具没有检查路由，现将相同纯判断辅助函数内联到实际消费者 tests/unit/fcs-design-revision-result-readiness.test.ts，不改收据检查器；8项单元契约通过。
- 另一项为毛织填报用例中“搜索输入/失焦防抖 → 查询 → 立即点填报”的测试序列存在竞争。仅等待筛选结果1行仍有1次失败，4次通过，原探测和trace保留于 `failures/wool-query-completion-probe/`。该用例以既有每页50条控件定位固定目标，再真实点击填报，五个独立重复均通过；完整17项原生套件随后全部通过。不增加固定sleep、不重试保存、不放宽81件须阻断和50件真实保存的断言，也不修改毛织业务代码。
- 仅调整测试输入序列和单消费者纯夹具位置，46个运行文件与563个构建资产没有改变，水洗UI采集器及基础/边界驱动字节也没有改变。因此原14项、10项、1675样本与6份纸面保留原时间、指纹及身份复用；其原报告sourceHashes包含当时其他测试的指纹，未篡改为新测试版本。当前测试指纹另由运行清单和最终收据绑定。
- 最终收据工具不能复用先前退出结果，会再次执行其自动路由选中的检查；相关实际结果以 /tmp/post-print-fabric-washing-delivery/task-receipt.json 为准。收据生成期间不改绑定文件；运行文件、附件/打印和页面性能结论不由机器状态代替。
