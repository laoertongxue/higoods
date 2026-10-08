# 生产时效两轮对抗审查与文案修复

用户于2026-10-09要求第一轮开发审查、第二轮业务审查，查漏补缺并修正文案歧义与堆砌。当前命名页面为PO-202610-0101；覆盖20个演示场景的主图、阶段链路、单据摘要和只读来源详情。保留已确认图形结构、单据号及原始业务事实，不改变计时标准、完成条件、路由和存储。开发轮发现PO-0101主裁床与承包裁剪重复范围：修正此场景主裁床部位/辅助/交接数量及放行范围，整单采购1500、任务800/500/200、材料各自单位、后道实收和入仓480保持。

## 实施与验收

1. 开发轮：核对共享事实及渲染分支，修正名称、状态、数量和时间表达。主代理修改；一个只读代理独立审查。
2. 业务轮：在修正后的实际页面检查当前情况、历史结果、责任与动作能否清楚区分，减少同屏重复说明。
3. 验收：20场景相关契约，1366、1280、1024宽度实际页面，摘要/展开/新标签/打印，各受影响路径与动作5次≤1000ms；最终构建、治理和工作树任务收据。

## 原子需求与证据

|编号|来源与要求|实现位置/工作包|自动化与页面证据|状态|确认人/版本|
|---|---|---|---|---|---|
|COPY-201|开发轮：质检、数量条码复核及加工计时名称忠实业务动作|source.ts#timingClockWorkLabel；production-order-diagrams.ts#clockLabel；source-document-detail.ts#clocks|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-202|开发轮：部分入库不出现整单完成标记|production-order-diagrams.ts#row；source.ts#getTimingFacts|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-203|开发轮：同屏展示已完成和正在进行，未知不推定未开始|full-flow-diagrams.ts#fullFlowRail/fullFlowWorkCounts|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-204|开发轮：单据开始时间和数量只表达一次，保留所有核心事实|production-order-diagrams.ts#docNode/documentSummaryBase；source-document-detail.ts#facts|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-205|开发轮：已确认未处理与尚待记录结果数量区别明确|full-flow-diagrams.ts#processingStep/renderFullFlowBranch；source-document-detail.ts#postDetails；production-order-diagrams.ts#documentSummaryBase|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-206|业务轮：合同实收/实领指标有名称，实际分配符号不冒充节点超时|production-order-diagrams.ts#details；full-flow-diagrams.ts#fullFlowRail|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-207|业务轮：规则只在必要位置展示，去掉角色说明、重复跳转说明和长段防御文案|production-order-diagrams.ts#summary/chart/branchHeader；full-flow-diagrams.ts#title/renderFullFlowBranch；source-document-detail.ts#postDetails/clocks；index.ts#renderOrder|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-208|业务轮：20场景的状态、图示、单据摘要与来源详情一致|index.ts#drawer；production-order-diagrams.ts#sewingFlowRows/chart；source.ts#静态来源|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-209|两轮问题均修复并复核，无开放P1/P2|本轮审查记录§5；findings.json|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-210|适用页面/交互/图片/打印性能与治理证据有效|本轮审查记录§3/7；production-order-diagrams.css#@media print紧凑布局|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|
|COPY-211|开发轮P1：主裁床仅覆盖A800+C200，B500承包裁剪单独跟进，不重复裁完或放行|fixtures.json#fullContract.branch.parts/docs/releases/craftScope/materialAllocationNote；production-order-diagrams.ts#phaseTiming/craftDiagramBase/supplyDiagramBase|相关107项契约；两轮记录§5；page-reading、expanded-page-reading、dialog-reading、native-reading与最终responsive-final；性能见performance-summary.json|已验证|用户2026-10-09指示；主代理本地技术验收；HEAD8a740798＋最终CB9bGVLs；效果待用户接受|

存储登记：本轮读取静态fixtures→source→页面，不改IndexedDB跟进动作，不新增业务存储或迁移。固定Mock记录只代表演示。

最终验证：本轮12项内容问题均关闭；验证发现完整展开首次打印1272ms后，增加仅打印布局修正，最终五次最大935ms。300个最终加载样本、835个文案交互样本、31个最终资源交互补测、280个原模块冷开/刷新样本及三尺寸视图见审查记录。后续唯一打印CSS变动不影响7Lv版本已验证的TS模板、静态事实和非打印单据内容。相关107项专项通过；项目完整检查与最终任务收据在临时目录归档。
