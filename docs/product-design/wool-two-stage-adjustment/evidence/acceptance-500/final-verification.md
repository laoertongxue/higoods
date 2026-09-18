# 毛织两阶段最终收口记录

本轮原型实现与内部验收通过，126条原子需求已验证，最终增量对抗式复审通过。版本、源码摘要见 [manifest](./final-source-manifest.json)。

## 已取得的冻结版本证据

| 检查 | 结果 | 证据 |
|---|---|---|
| 构建及工程检查 | 266单元测试通过，Vite构建通过 | [build.log](./build.log) |
| Web/PDA业务 | 47个不同业务用例均已取得通过证据：46项轮次45通过，分页等待修正后单项通过，另补A08单项通过 | [browser.log](./browser.log) |
| 两阶段业务契约 | 17组通过 | [core.log](./core.log) |
| 新对抗反例 | 7项通过 | [adversarial.log](./adversarial.log) |
| PDA投影与跨厂 | 通过 | [pda-projection.log](./pda-projection.log) |
| 接收及领退移库守恒 | 通过 | [receiving.log](./receiving.log) |
| 印花演示保护 | 10厂×5场景、原12条保留通过 | [printing-demos.log](./printing-demos.log) |
| 批处理回滚及精确事实 | 通过 | [print-batch.log](./print-batch.log) |
| 优化前后精确等价 | 578任务、239进度、267入库、91出库、29厂默认库位及KOL事实一致 | [equivalence.log](./equivalence.log) |
| 路由加载 | 37种路由/设备组合×3种加载×5轮＝555样本通过；常规最大448.60000002384186ms；PDA队列冷进入最大697.9000000059605ms，按用户例外通过 | [route-performance.json](./route-performance.json) |

## 证据边界

性能从导航或事件起到实际内容、必要图片完成绘制和可操作；没有以Loading计终点。每轮使用独立上下文，保留首次样本及所有慢样本。图片负向实验故意失败且被正确判为失败，不能计为正常页面通过样本。此前 `remaining-action-performance-pre-freeze.json` 因开发导航中断少5项的各一个样本，作为失败记录保留，不能代替本轮五样本证据。

本轮是原型实现与内部验证，不代表真实工厂业务发生或产品负责人已接受实现，也不代表已推送当前增量。

## 范围外既有检查边界

本轮12个受影响源码路径及毛织页面的TypeScript范围检查0诊断；仓库全量仍有61条既有诊断，未将其宣称全量通过，见[范围类型日志](./scoped-types.log)。

水溶整包旧专项在BOM工艺推导处失败：`check-water-soluble-process.ts:193`预期WATER_SOLUBLE节点而实际undefined。由`git archive HEAD src scripts package.json`生成独立基线再执行，得到同位置同断言失败，见[基线](./water-head.log)与[当前](./water-current.log)。此次只改水溶接收查询的重复读取，完整任务/库存/来源等价检查通过，不借该范围外BOM问题扩大业务修改。既有印花online-gap与KOL专项失败的旧对照仍保留在首轮/诊断证据中，不计为通过测试。

最终仓库竞态修复后46项回放中45项通过；分页偏好用例在异步change尚未完成时立即读取localStorage得到旧值。测试补充等待真实14行列表完成，单项重放通过，见[完整轮次含原失败](./browser-before-page-size-wait.log)与[修正后重放](./browser-page-size-wait.log)。该测试修正未改变业务源码或构建。

## 需求与变更的双向检查

- 正向：126条原子需求保持原编号与来源章节；A01—A20分别联查原有契约、七份浏览器用例及本轮入口性能。A07需要节点身份不合并与双纱不翻倍，已有契约和三节点页面身份，未扩大为另建工艺流程；A08补足真实100→60+40；A15明确夹具仅准备版本，启用新版动作实际由页面执行。
- 反向：12个源码文件只涉及减少共享重复读取、毛织PDA来源图片与直接加载、打印分页、仓库迟到筛选修复；分别回到VERIFY-003～006、PAGE-017～020、PRINT-003与既有接收/库存不变契约。新增测试不创建真实业务后端、历史迁移、结算或其他能力。
- 被撤回的KOL懒初始化、PDA排序、Vite预加载等试验不在当前交付；用户其他工作树修改未吸收。
- 产品确认字段保留用户对业务规则/方案的原确认和未接受实现的边界；“已验证”仅为本轮Codex内部有证据核验，不代替用户产品接受。

[A08同批分两次接收日志](./split-receipt.log)及[页面](./split-receipt-complete.png)补足最后业务场景缺口。

## 最终五轮性能（同一构建）

[原始证据汇总校验](./final-evidence-validation.json)重新核对每个原始样本、五次完整性、错误、构建指纹和源码摘要，不只相信报告的pass字段。复核命令：仓库根目录执行 `python3 docs/product-design/wool-two-stage-adjustment/evidence/acceptance-500/validate-evidence.py`。

| 场景 | 原始样本数 | 最大ms | 结论 |
|---|---:|---:|---|
| 37种页面/设备组合×冷进入/刷新/切换各5次 | 555 | 常规448.60000002384186；队列冷进入697.9000000059605 | 通过，只有队列冷进入≤1000ms例外 |
| 71项主交互各5次 | 355 | 75.90000000596046 | 通过 |
| 18项补充交互各5次 | 90 | 65.30000001192093 | 通过 |
| 375项剩余操作各5次 | 1875 | 395 | 通过 |
| 158项1024主管操作各5次 | 790 | 213.5 | 通过 |
| 实际裁厂接收详情冷/刷新/真实卡片切换各5次 | 15 | 277.40000000596046 | 通过 |
| 四批打印失败反馈/恢复/完整PDF各5次 | 15 | 196 | 通过，五份PDF均4页 |

共3695个样本全部满足对应上限，622个命名操作/设备组合均有5个原始值；打印额外3类结果独立计量。正常页面和操作没有减少Mock数据或预热模块。每份性能JSON的构建摘要均为 `5628743d94d6f72e96d1c30a866fccfeb4be8850ef8479c4ea077d6daad89266`。

报告：[加载](./route-performance.json)、[主交互](./action-performance.json)、[补充交互](./extra-action-performance.json)、[剩余操作和下游详情](./remaining-action-performance.json)、[1024操作](./remaining-action-performance-1024.json)、[四批打印](../acceptance-500ms/print-extra-performance.json)。原失败样本保留；修复后完整重测，没有剔除慢样本。

## 治理与验收结论

标准列表扫描436页/17历史基线、真实Chromium列拖拽和模板检查通过；原型治理覆盖11个受管文件、1份本轮记录通过（另main.ts纳入构建与路由验收）。[列表/模板日志](./governance.log)末尾保留首次记录命令格式失败；补齐规范命令清单后[原型治理重测](./prototype-governance.log)通过，未修改检查脚本或基线。

本轮源码12个文件及全部受影响毛织页面TypeScript范围0诊断；全量61条既有错误明确保留。126条正反向追踪已完成，A01—A20全部获得约定结果证据。最终性能与业务实现不再有本任务范围内开放项。产品接受、真实工厂执行与本轮再次发布不在本记录的通过断言内。

## 技术收据与复现

[任务技术收据](../../../../../output/wool-acceptance-technical-receipt.json)由仓库 `workflow:verify` 对该隔离工作树的全部实际变更生成（含原始验收证据，输出保存于仓库忽略的output目录以避免自引用摘要）；不吸收其他工作树差异，受影响检查、独立服务E2E、构建和CodeGraph由收据记录。技术收据不是用户产品接受回执；本轮没有再次发布。

浏览器功能复现：`PLAYWRIGHT_BASE_URL=http://127.0.0.1:5198 CUTTING_E2E_PORT=5198 npx playwright test tests/wool-acceptance-extra.spec.ts tests/wool-acceptance-gaps.spec.ts tests/wool-final-craft-pda.spec.ts tests/wool-management-fact-workflow.spec.ts tests/wool-pda-main-local-rerender.spec.ts tests/wool-stage-actions.spec.ts tests/wool-split-receipt-acceptance.spec.ts --workers=1 --reporter=line`。本轮先执行前六份46项并按实际完成条件修正一项测试等待后重放，再单独补A08；分轮日志保留，不冒称单次47项整组运行。
