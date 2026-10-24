# 商品反馈管理页面、弹窗精简与工作台读取修复

依据 `AGENTS.md` REVIEW-01、LIST-01、UI-01、STORE-04、EVIDENCE-01。需求基准为 [V1.3 完整方案](../product-design/商品反馈管理一期完整方案-2026-10-23.md)，本次用户要求优先于原方案的说明文字呈现；业务规则继续执行已确认的 V1.3。

## 基本信息

- 日期：2026-10-24
- 任务 / 需求编号：商品反馈管理五页及弹窗说明精简、筛选布局修正、采集工作台读取故障修复。
- 验证人：主代理，完成业务语义审查、产品实际操作与增量 diff 审查。本轮未另行委派代理。
- 授权：用户要求其他页面及弹窗一并检查，移除不必要的技术说明和大段解释，保留必要业务提示；暂不发布。
- 起始分支 / HEAD：main / `cb4e6a076d4da71190052850cfd557754a94fa00`；原 V1.3 和上一轮界面修正尚未提交，本次以任务开始快照比较增量。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 契约变化：有
- 判定依据：五页和弹窗为界面呈现调整；同时修复反馈页面被无关生产数据初始化阻断的读取入口，按 T3 验证。
- 范围：`/pcs/product-feedback/{collection,batches,comments,products,analysis}`，采集工作台三个视图及相关详情、核查、表单和确认状态。
- 本轮不改变评论、任务、人员责任、完成判定、分类、去重、统计、导出内容或持久化格式；不改变其他页面的生产初始化与异常处理。无关质检工作区差异保持原状。
- 独立反馈入口仍由原反馈仓库准备商品及评论资料；真实读取失败仍显示错误，不以空列表或假成功掩盖失败。未建设维护页面、迁移界面、权限或真实平台接入。
- 本次不涉及共享写入事实、公共业务格式、正式对象退役或发布链，按 RECEIPT-01 使用直接证据，不生成新的版本绑定收据。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 标题操作和筛选布局 | 通过 | E01：五页在 1280×720、1366×768 无整页横向溢出；标题按钮相邻排列，筛选等宽，“更多条件”和查询按钮同一行，展开字段位于按钮下方。查生产浮动入口位于右下角，不再挡住筛选区。 |
| 说明精简与业务提示 | 通过 | E01、E02、E03：移除版本、哈希/指纹原理、技术凭据及大段口径解释；任务、采集记录、分类、修正关联、分析等弹窗保留必填、错误、未保存离开、确认影响、撤回原因、实际失败与覆盖缺口提示。来源记录与操作历史仍可核对。 |
| 结果直接显示 | 通过 | E01、E03：采集记录直接显示批次、上报、新增、更新、重复、排除、失败、待处理，不再要求展开说明后查看；处理数量使用业务名称。五个常规统计卡等宽，采集记录八项为两行四列。 |
| 弹窗可读、可点、可关闭 | 通过 | E02：35 个详情、表单及确认状态逐项实际打开，均在视口内；切换、取消、关闭和固定页脚可用。E03：两套按钮在悬停时继续保持深色选中背景，修复浅底白字。 |
| 原黄色生产资料读取错误 | 通过 | E04：原浏览器现场复现；反馈六个合法入口直接由所属页面读取资料，不再依赖无关生产恢复。修复前回归失败，修复后通过；相邻 PCS 页面仍执行原生产准备和失败处理。 |
| 旧固定演示残留 | 通过 | E05：现场随后暴露旧渠道演示规格不匹配；确认原值与历史固定种子 23 条逐字节一致后，按 STORE-04 在业务页面外定向清理该旧键，原浏览器重新打开后直接显示九家店铺任务。未修改转换器去绕过校验，未清空数据库或清理其他键。 |
| 业务语义及直接依赖 | 通过 | E04、E06：全星级、昨日核心及七个完整日、主责、交付/处理判定、去重和分析分母未改变。跨日期“到期应采”仍是任务数，避免误写成不同店铺数；批次各去向仍按当前回执求和，重试未重复计数；采集成功不等于分类完成。 |
| 图片及必要来源 | 通过 | E01、E02、E03：必要图片均解码且无破图；大图可打开。商品素材仍明确标为“商品参考图”，不冒充真实买家图片；移除大图下方冗长 URL，实际图片地址与失败提示保留。 |
| 日期防错与原结果保留 | 通过 | E03：日期填反显示一句错误，原结果保留；改正日期后恢复查询并清除提示。高级筛选展开、收起和查询均正常。 |
| 保存、数据格式、真实生产接入 | 不适用 | 本次未改变写入和格式，已有保存/回读证据按 E06 复用，真实平台接入不在范围内。弹窗巡检不提交新业务事实；没有以演示场景宣称真实采集或生产接受。 |

## 页面证据

- 版本：2026-10-24，以上 HEAD + 本次九个产品源文件及一项回归测试；完整文件 SHA256、任务开始摘要、隔离副本一致性、实际 HTML 摘要见 `output/playwright/product-feedback-polish-20261024/version.json`。本轮增量见同目录 `change.patch`，不包含无关质检差异。
- 环境：主目录 `/Users/laoer/Documents/higoods`；验证副本 `/Users/laoer/.codex/worktrees/feedback-verification/higoods`；本地生产构建 `/tmp/higoods-feedback-final`；服务 `http://127.0.0.1:4182`；浏览器 Chromium，1280×720 / 1366×768，业务时区 Asia/Jakarta；默认小型 Mock，无批量扩量。
- 证据：以下 E01～E06 分别记录实际页面、35 个弹窗状态、查询防错、原始读取故障、旧演示残留处理及复用范围；截图、原始值和命令日志均在 `output/playwright/product-feedback-polish-20261024/`。
- E01：同目录 `final-layout.json` 共 84 项布局/页面断言；五页各有 `*-final-1280.png`、`*-final-1366.png`，另有 `analysis-final-expanded.png`。主代理已逐页视觉检查。标题操作间距、筛选宽度、折叠/展开位置、浮动入口以及直接结果均已检查。
- E02：`final-dialogs.json` 共 35 个状态、36 项断言，截图在 `final-dialogs/`。覆盖：历史补采计划、采集安排及安排历史；任务的目标责任/覆盖缺口/批次结果/核查调整/时间线；原证据核验、补证及重新判定；批次五个栏目及来源记录；评论四个栏目、分类确认与撤回；关联修正及确认；批量建议；商品汇总和图片；分类说明、分析观察；五页列设置。所有表单均采用只读检查或取消，本次不新增业务保存。
- E03：`interactions.json` 共 17 项业务/呈现检查及 25 个操作耗时；`batch-basic-final.png`、`comment-final.png`、`classification-rules-final.png` 保存实际悬停/弹窗结果。该次检查后只将工作台两处四字指标名改为“到期应采”、缩短一条说明并去掉空字符串；分析、评论、批次、列设置和筛选交互实现及样式未改变，操作证据按 EVIDENCE-01 复用。最终五页截图、冷启动和全部 35 弹窗已在最终构建复验。
- E04：`route-before.log`、`route-after.log`、`unit.log`；新增 `tests/unit/product-feedback-route-entry.test.ts` 提取实际入口函数，验证六个反馈入口避开无关失败、自己的读取错误仍可见、相邻 PCS 页面原准备和错误处理不变。合并反馈模型及主档直接契约共 55 项通过。
- E05：原 IAB 同源现场核验。先发现无关生产初始化错误，再发现旧本地渠道种子 `CP-603005-01` 指向已退役 SKU。外部只读重建历史仓库 `f62108bd4^:src/data/pcs-channel-product-project-repository.ts` 固定种子，23 条 / 69742 字节，与浏览器键 `higood-pcs-project-channel-product-store-v2` 原值 SHA256 均为 `edeacc9b648c93ea8dbdb210493de2337da052cb7f7962fd361c2adeae42bd49`。匹配原值保存在同目录 `retired-channel-demo.json`；仅在摘要及数量再次匹配后移除该键，设置有界完成标记 `higood-feedback-retired-demo-20261024`。未动反馈业务库、其他本地键及 IndexedDB。最终在原 IAB 刷新检查：标题“采集工作台”，店铺任务 9 条，错误提示消失，指标为 9 / 4 / 4 / 5 / 6。此清理是已核实固定演示残留的一次现场处理，不表示其他浏览器资料已被清理。
- E06：原 [V1.3 实施及业务、产品审查](2026-10-23-product-feedback-phase1.md) 的数据/去重/原子保存/回读/直接上下游结果，在未变化范围复用；本轮页面及弹窗证据替代原记录和 [上一轮界面精简](../product-design/review-history/2026-10-24-product-feedback-ui-cleanup.md) 对应呈现部分。旧收据保留原始版本身份，不代表本轮源文件摘要。
- 实际命令输出见同目录 `build.log`、`types.log`、`unit.log`。范围内类型错误 0，范围外 19 项既有错误未纳入本次修复；未宣称全站类型检查通过。审查中一次时间可信枚举误写被范围检查阻断并已修正，原失败保存在 `types-before-enum-fix.log`。首次弹窗脚本对同一个原生弹窗重复接受属于脚本问题，修正监听后重做相关样本，保留 `browser-attempt-1.txt`，未伪造通过。

## 性能结论

- 结论：通过
- 依据：最终构建五页各 5 个新浏览器上下文冷启动，共 25 样本，最大 290.4ms，零破图，原始值见 `performance-cold.json`。开始为导航开始，终点为标题、表格、字体、必要图片解码并完成两帧绘制，可交互。1366×768、Asia/Jakarta、独立冷上下文、默认不超过两页的 Mock，未与构建并行。
- 操作采用共用筛选和抽屉的代表页“反馈分析”，查询、高级条件展开/收起、列设置打开/关闭五个等价家族各 5 样本，共 25 样本，最大 49.2ms，见 `interactions.json`；从真实点击事件捕获起点，到目标状态、字体/必要图片及两帧绘制，非函数返回或 Loading。全部适用样本小于 1000ms。两种抽屉按钮已分别在批次和评论核对悬停结果，全部弹窗另验功能，不把功能数量机械乘为性能样本。

## 验证命令

- `npx vite build --outDir /tmp/higoods-feedback-final`：通过
- `node scripts/check-typescript-scope.mjs src/pages/product-feedback/ src/components/product-feedback/ src/main.ts`：通过
- `node --import tsx --test tests/unit/product-feedback-route-entry.test.ts tests/unit/product-feedback-model.test.ts tests/unit/product-feedback-master.test.ts`：通过

列表/产品治理入口另存 `governance.log`，仅证明选定路径和记录符合检查要求，不代替以上页面、业务和性能证据。

## 例外

- 无

## 最终结论

结论：通过

已实现并完成本地验证，更新到当前本地预览。未提交、未推送、未部署；用户接受状态不代填。无需清缓存、导入或进入维护工具即可直接查看九家店铺任务。

## 受管文件

- `src/main.ts`
- `src/pages/product-feedback/collection.ts`
- `src/pages/product-feedback/batches.ts`
- `src/pages/product-feedback/comments.ts`
- `src/pages/product-feedback/products.ts`
- `src/pages/product-feedback/analysis.ts`
- `src/components/product-feedback/insights-shared.ts`
- `src/components/product-feedback/operations-ui.ts`
- `src/components/product-feedback/product-feedback.css`
