# 三类菲票中转袋生命周期验收

验收工作树：`/private/tmp/higoods-replacement-fabric-release-20260925`；分支 `codex/replacement-fabric-acceptance-20260925`；基线 HEAD `3a3d16481156a8858155f992aab492cd2cf6bfde`，证据对应本次尚未提交的工作区变更。本旁路已完成统一生产预览验收：build7 的生命周期/Web 详情/HPB 扫码 165 个样本，加 build8 的旧袋列表/保存 45 个样本，累计 210 个样本全部通过。主代理已确认 build8 仅针对旧袋初始化快照写入及其它旁路修复，本目录 165 样本对应的现代袋页面与操作源码未再更改；旧袋受影响范围已在 build8 重测。具体构建归属和结果见文末及 `evidence-manifest.json`。以下 dev 记录作为历史诊断证据保留，不替代最终预览回执。

## 前置与边界

- 每个脚本使用独立浏览器 context，页面入口导入 `.higcut`，不通过内部业务函数伪造测试动作。
- `../acceptance-final/mixed.higcut` 是明确的隔离 Mock 备份。
- `repack-prerequisite.higcut` 仅在该备份的混装来源袋中加入另一车缝任务的 12 片部位票，以使真实任务交出触发拆袋重装。生成脚本 `build-repack-fixture.py`、原始与变体 SHA `fixture-provenance.json` 保留来源说明。测试中的扫描、分袋、确认库位、交出、回收和报废均为真实页面操作。
- HPB 第 3 张由实际“新增独立票”创建、实际打印预览确认成功后扫描。只拦截 `window.print` 作为软件打印证据，不声称实体打印机输出完成。
- 旧备份含 7 条已保存裁后事件；其它静态演示事实可读但不得被本次动作复制落库。

## 已复现并修复的实际问题

1. 异步重装失败回调引用已经被仓库通知重绘后移除的容器：运行状态有“未保存”，屏幕没有反馈。`pda-cutting-transfer-bag-repack.ts/updateRepackWorkflow` 改为更新当前仍连接的工作区。
2. 重装来源与结果汇总曾把换片布、捆条与裁片混计张数，只展示裁片片数。现在按类型分别显示张数与自然数量单位，确认页、剩余来源袋和完成页统一。
3. 占用库位保存失败后缺少保留分袋结果的库位修改入口。增加“修改回仓库位”，保留任务、目标袋及已扫菲票后回到库位步骤。
4. 首次有效保存曾将 3 条未变更的静态入仓事件一并持久化。主代理在事件存储桥接中规范化前后值后再比较差量；本次实际 UI 重放证明只新增应有的 3 条事件。

## 功能证据

- `lifecycle-probe-fixed-canonical.txt`：当前 dev43237，PDA 390×844。占用库位 `A-R01-L01-P01` 可见拒绝；全记录 JSON 不变，所有输入状态（排除反馈文字）不变；从实际可用库位图选 `A-R01-L04-P01` 后重试成功。7 条原事件 → 失败 7 → 成功 10 → 回收与报废后 13。浏览器错误为 0。
- `lifecycle-hook-diagnostic-final.txt`：补充逐票 ID、票号、类型、数量、单位的前后守恒断言。部位裁片来源 32 片 → 交出 20 片 + 留仓 12 片；换片布 1 张 5 Yard、捆条 1 张 8 米均进入结果袋交出，身份不变。
- `hpb-scan-hook-diagnostic-final.txt`：列表新增独立 HPB003 → 打印预览软件确认 → PDA 扫袋、扫完整票码、确认装袋 → IDB 1 条本袋装袋事件 → 刷新袋详情仍为同一票号 5 Yard。
- `web-detail-hook-diagnostic.txt`：Web 1366×768，通过实际新增袋档案后进入袋详情，稳定身份、当前状态、当前周期、装袋、入仓、重装、交出、特殊工艺、回收、报废、历史周期共 11 个 Tab 可达；当前周期同时展示三类票及各自单位。
- 图片：`repack-success.png`、`hpb003-scan.png`、`web-mixed-detail.png`。

## 保留的失败证据

- `lifecycle-probe-state.txt`：最初未更新到可见 DOM 的失败反馈。
- `lifecycle-probe-fixed-conservation2.txt`：修复差量前，重装动作连带保存 3 条静态 Mock 入仓事件。
- `lifecycle-hook-diagnostic.txt`：测量脚本在 `document.body` 尚不存在时读取 innerText 的工具错误，已对测量钩子加存在性检查，不是业务异常。
- `hpb-scan-hook-diagnostic.txt`：测量脚本在详情明细尚未完成读取时取票号，误选已交出的 HPB001；页面正确阻断。脚本现等待已有 2 票展示后新增并严格断言新票序号 3。

## 最终五样本脚本

- `lifecycle-five-samples.js`：PDA 重装直达、刷新、读任务、三类票扫描、占用库位失败、空闲库位重试、回收/报废直达与刷新、保存及袋详情。
- `web-detail-five-samples.js`：Web 袋详情直达、刷新、11 个 Tab；含三类明细图片完成。
- `hpb-scan-five-samples.js`：每个样本独立通过 UI 新增/软件打印 HPB003，再测扫码、装袋保存、详情直达及刷新。
- 旧袋档案列表/保存：`../acceptance-legacy-bags/preview-five-samples.js`。

计时从原生 click/Enter 捕获或 navigationStart 开始，到可读结果、当前图片完成和两次 animation frame。保存另读回实际 IDB 记录，失败另外断言既有记录和输入保持一致。导入和建立场景期间资产可能已经加载，因此对应“直达/刷新”数据不冒称全新浏览器冷缓存。每个样本须单独满足性能门禁，不能以均值代替。

## 统一 production preview build7 结果

2026-09-25，在主代理确认的 build7、`http://127.0.0.1:43236`、独占采样窗口执行；本轮无源码更改。每个类别都是 5 个独立 context。

| 场景 | 样本数 | 最大值 | 结果文件 |
| --- | ---: | ---: | --- |
| PDA 重装、回收、报废及详情 | 80 | 249.3 ms | `lifecycle-five-samples-build7.json` |
| Web 袋详情直达、刷新、11 个 Tab | 65 | 183.2 ms | `web-detail-five-samples-build7.json` |
| HPB003 扫码、装袋保存、袋详情、刷新 | 20 | 268.7 ms | `hpb-scan-five-samples-build7.json` |

165 个样本逐个低于 500 ms，浏览器错误为 0；五轮占用拒绝的可见反馈、全记录不变与输入保留均通过；五轮重装都严格为 7 → 10 条裁后事件，逐票身份与原数量单位守恒。五轮新增 HPB003 都经真实页面新增、软件打印确认和扫码装袋，再经详情刷新核对。

旧袋档案列表的独立脚本在 build7 第 1 例发现首次读取仍两次写入 `cutPieceReleaseHandoverSnapshots`，因此立即停止，未以本轮 165 样本覆盖该问题。失败保留于 `../acceptance-legacy-bags/preview-five-samples-build7.json`，主代理另行修复并复验。该问题与此处已导入备份后的袋链结果区分记录。

## 关联旧袋门禁关闭

build8 针对模块初始化旧快照写入修复后，`../acceptance-legacy-bags/preview-five-samples-build8.json` 的 45 个样本全部通过，最大 285.2 ms，五轮首次读取、刷新及保存均无业务 localStorage 写入。此前的 165 个生命周期样本按主代理确认，其相关源码未变，保留 build7 证据。袋旁路累计 **210 个有效严格样本**，全部逐项低于 500 ms；不同构建来源如实保留，不混写成同一构建。
