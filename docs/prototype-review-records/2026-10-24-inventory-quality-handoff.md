# 成衣库存质检职责、来源及完整流转修复
依据 `AGENTS.md` REVIEW-01、TRACE-01。本记录为产品审查及实际页面证据；版本收据的检查结果独立保存，不在此预填或回填。

## 基本信息
- 日期：2026-10-24
- 任务 / 需求编号：INVQC-20261024
- 验证人：Codex
- 原工作树 / 分支 / HEAD：`/Users/laoer/Documents/higoods`，main，`297cdf4ffb83a4b174a37221e5aafcc7774d5c6d`，本任务尚未提交或发布。
- 隔离验证工作树：`/Users/laoer/.codex/worktrees/inventory-quality-verification/higoods`；基准 `6ad9f423a5c496898d61e7305bc767dd0a5cf2e7` 已包含开始时的质检结构化项目等既有修改，以免治理与收据吸收无关差异。本任务文件逐一复制；同期商品反馈在共享菜单中新增的`pcs-feedback-topics`一行及main.ts对topics地址的提前路由扩展仅在隔离副本中剔除，原工作树保留。其他非任务源码沿用开始时冻结基准，未吸收同期无关新增入口。
- 既有差异：`/tmp/higoods-inventory-qc-baseline/preexisting.patch`；保护其他工作区文件及资料。

## 影响判定
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：成衣仓、后道工厂、返工接收及后道加工的共同事实、关联单据、岗位动作与跨页回读变化，T4，触发完整追踪和版本收据。
- 范围：本地 Web 管理及现场 Web；仓库发起、后道实收、QC、按所选项目加工、分类交出、返仓接收与上架；直接列表、打印预览及存储调用方。
- 非范围：线上发布、测试站数据库、真实库存或工厂接受、登录权限、分批送检或新增分批出货。PDA未新增入口或操作；库存加工单二维码回到对应 Web 加工详情。实体打印设备未验收。

## 需求 → 计划 → 原子结果与证据
| 编号 | 来源与独立结果 | 负责实现 / 完成条件 | 状态 / 证据 |
| --- | --- | --- | --- |
| R1 | 用户：谁操作谁出库 | 送检表取消实际出库人手填，WLS沿用当前显示的管理员；后道沿用既有当前操作人上下文 | 已验证；真实页面送检80件并持久回读创建人，所有送检/接收表无手填操作人 |
| R2 | 用户：正式成衣质检出库单 | 原成衣出库表按唯一送检事实投影，类型成衣质检，单号、详情、来源及日志可查，不重复扣库 | 已验证；源单OUT筛选、详情刷新、原销售取消打单回归 |
| R3 | 用户及批注1：后道工厂实际接收，仓库回显 | 后道工厂管理新增成衣质检收货与交接菜单；由该页实收并生成原QC，WLS只显示实收事实和办理链接 | 已验证；80/80及80/79页面回放，仓库详情没有后道收货输入或按钮 |
| R4 | 用户：QC衔接正确 | 来源单明确指定本批QC，不静默切换到其他在检单；原工作台领取、逐SKU检查、稽查升检、完成后回到本批流转 | 已验证；实际24件抽检触发稽查并升全检，补检56件；另有在检单时明确阻断并保留本批单号 |
| R5 | 用户：分类交接至返仓上架闭环 | 正常回原仓、瑕疵入独立瑕疵仓并实收上架，返工由goto_global接收；必要分支及差异未完成时不整体完成 | 已验证；76正常/2瑕疵/2返工的实际全流程，末步及刷新回读均已完成 |
| R6 | STORE-02/04：共同保存与定向重建 | QC、加工及仓库投影用同库同事务；外部一次切换，仅清相关旧演示链并登记完成标记，不随普通打开/刷新重清 | 已验证；应用创建/加工包装/上架失败回滚、重试去重；定向切换CAS、关联加工记录清理、共享附件保留及幂等契约 |
| R7 | 用户：操作问题与相邻回归 | 实际点击、图片、刷新、直达、键盘；1366/1280管理及1024现场；保留数量、顺序、不可重复和必要责任校验 | 已验证；本记录页面与专项证据；共享技术检查由独立收据执行 |
| R8 | PERF-01 / REVIEW-01：最小充分证据 | 两页内Mock；每个实际性能家族至少5有效样本，保存含持久回读；源码、运行资产、全部差异及治理范围明确 | 已验证（产品证据）；273样本/28家族，最大939.60ms；技术收据独立生成 |
| R9 | 用户：参照染色加工单筛选 | 复用公共查询按钮、更多筛选与统计布局；综合查询、仓库、申请/接收/QC进度，高级时间类型/日期/出库人；查询与统计/总数联动，重置和Enter可用 | 已验证；三种宽度截图、日期反向阻断、查询与重置实际回放 |
| R10 | 用户：库存质检更名成衣库存质检 | 菜单、页标题、列表与相关类型文案显示更名；保留业务身份、地址与追溯 | 已验证；菜单、页标题、源单及QC业务类型实际可见 |
| R11 | 用户：与三方工厂回货区分并贯通下游 | QC清单/工作台、后道加工单/详情/流转卡、后道出货表/详情显示成衣库存质检或工厂回货质检，列表按来源筛选 | 已验证；工厂回货类型包含三方来源，不将其他工厂来源伪称为三方；库存记录无虚构生产单/第N次回货/PPIC责任 |
| R12 | 用户明确答复：勾选加工项才加工 | QC选择非空项目且有正常放行量时进入原分项加工模型；不选直接进入分类出货；正常货全部加工完成后整批交出，瑕疵/返工沿原分类去向 | 已验证；真实不加工/熨烫→包装两支；顺序、超量、幂等、已交出量订正保护；抽检24+未检56形成加工80；全瑕疵不建空加工单 |

## 原问题与修复依据
- 原页面在成衣仓送检详情中填写实际出库人、后道实收数量和接收人，职责混在一页；成衣出库表只附加送检卡片，没有正式成衣质检列表类型。
- 相邻回归发现：QC纸单分区保存时，同一SKU多个观察项的草稿身份重复，导致尚未提交的项目选择丢失。控件身份增加观察项ID，保留各项目值；原生文件、数量及依据草稿继续保留。补5次纸单保存逐项比较全部草稿，再提交轮次与完成QC。
- 实际回放复现：库存QC的指定批次链接被当前其他在检QC替代；零实检SKU仍要求项目观察；完成QC回到空扫码页；库存加工单刷新被错误套用工厂回货身份校验。这些断点已分别修复并重放。
- 不改抽样、升检、纸单等原生产回货规则。库存QC没有额外纸面双签要求；加工按正常放行量（实检合格+未检放行）执行。
- 性能原始失败保留：开发期冷态1178ms、生产资产校准冷态1051ms、旧加工清单1014/1022ms、收窄生产来源后仍有1078ms。分别处理即时库存整组WLS加载、库存专属入口的无关生产/辅料准备，以及重读时重复克隆静态固定标准。固定标准防修改、可变输入隔离及回滚/版本校验继续保留。

## 自查结论
| 检查项 | 结论 | 证据 / 处理 |
| --- | --- | --- |
| 需求及直接上下游 | 通过 | R1–R5、R9–R12，两条完整真实页面支路及79件实收差异 |
| 共享事实、旧演示切换与失败处理 | 通过 | R6；实际包装事务故障后原数据/输入保留，重试只留1次记录；重试成功后旧错误提示消失亦有断言 |
| 界面、图片与可操作性 | 通过 | R7、R9；真实SKU图、表内横向滚动、查询/重置/Enter、三宽度；打印预览二维码与图片实际就绪，前后持久记录一致 |
| 源码与变更边界 | 通过 | 本任务差异及文件清单；既有修改保留；新增测试与两个助手已精确登记到实际页面运行器，未知测试仍不豁免 |
| 加载、保存及打印预览响应 | 通过 | R8；原始失败不删除，修复后的原始值及家族汇总见性能证据 |

## 最终结论
结论：通过

## 页面证据
- 版本：原工作树开发服务：`http://127.0.0.1:43240`；最终生产构建预览：`http://127.0.0.1:43241`，均为127.0.0.1，同一原工作树。本次没有线上写入或发布。
- 浏览器：Playwright Chromium 149.0.7827.55；主流程时区Asia/Jakarta；主流程功能视口1366×768、1280×768、1024×768；系统macOS、Node 26.8.2，既有依赖未升级。
- 纸单草稿修复的补测：同工作树新开发服务`http://127.0.0.1:43242`，1024×768、Asia/Shanghai，5次完整保存195/145.8/146/146.2/145.9ms，单独标明开发环境，不冒充生产冷态；输入图片沿用真实静态SKU图片。
- 数据：每个新场景独立浏览器上下文，1个实际送检申请、2个SKU、3个分类去向，沿用现有两页内静态Mock。未扩量压测。默认操作身份用于原有QC上下文，无新增身份切换UI。
- 证据：关键路由：`/wls/finished/stock/realtime` → `/wls/finished/inventory-quality`；正式出库 `/wls/finished/outbound-orders`；工厂接收 `/fcs/craft/post-finishing/inventory-quality`；QC `/fcs/craft/post-finishing/qc-workbench`；加工 `/fcs/craft/post-finishing/work-orders`；后道出货 `/fcs/craft/post-finishing/outbound-orders`；返仓 `/wls/finished/pre-inbound`、`/wls/finished/putaway`；返工 `/fcs/production/inventory-rework-receipts`。
- 实际全流程原始页面与持久记录：`/tmp/higoods-inventory-qc-evidence/formal-direct-current/`、`formal-processing-current/`、`print-fixture-from-ui/`。
- 筛选与来源类型三宽度截图：`/tmp/higoods-inventory-qc-evidence/optimized-preview-calibration/`；后续只调整来源准备及固定树复制，筛选的可见结构与交互未变化，复用这些截图。最终查询操作另有formal-filters-current回放。
- 打印图：`/tmp/higoods-inventory-qc-evidence/processing-print-final.png`。打印冷态数据复制自真实页面已完成的隔离会话，在中性空页读入前后比较持久记录；没有在产品中增加导入/维护步骤。
- 定向切换：仅在开发验收浏览器origin执行`inventory-quality-handoff-20261024-v2`，删除30条相关旧演示记录、0附件；实际标记见`local-demo-markers-v2.txt`。不声称其他浏览器已被清理。

## 性能结论
- 结论：通过
- 依据：两页内Mock，273个有效样本、28个家族均不超过1000ms；完整逐值、环境及复用说明见本节与`/tmp/higoods-inventory-qc-evidence/final-performance-summary.json`。
- 起止：真实click或navigation开始；目标内容/数量/状态、必要SKU图片解码、字体、两帧实际绘制及可交互后结束；保存的ready还包含同源IndexedDB持久回读。填写和确认等待不计。
- 家族：1366不加工分支5次、1024熨烫包装分支5次；相同实现/数据/终点的保存与分类动作合并为家族，三分类/两返仓保留全部样本；查询、重置、错误阻断各5次；加工流转卡冷启动5个独立上下文；纸单分区保存补5次。每族至少5有效值。
- 最终273个有效样本、28家族，最大939.60ms。逐值、最大值、路由、浏览器、时区与视口见`/tmp/higoods-inventory-qc-evidence/final-performance-summary.json`及其sources；原始计时逻辑在测试助手和`measure-processing-print.cjs`。
- 初期有效失败按版本保留。首轮打印校准使用了含应用脚本的前置页，未计入冷态正式结果；正式打印改用中性HTML且不预热目标页，样本另存`processing-print-performance.json`。
- 同机重型构建和正式性能串行。各次正式采样期间产品源码/资产未改动。原268样本的资产版本保存在`main-formal-runtime-manifest.json`，最终资产另存`final-runtime-manifest.json`。末次产品差异为两个菜单的精确路由注册（同一既有渲染器）及纸单分区保存草稿身份；该纸单动作不在原库存主流程中，故原主流程/查询/打印证据按EVIDENCE-01保留，新增分支单独5样本。最终完整功能回归仍由收据重新执行。

## 验证命令
- `npx vite build`：通过
- `node --import tsx --test tests/unit/inventory-quality-processing.test.ts`：通过
- `node --import tsx --test tests/unit/inventory-quality-entry.test.ts tests/unit/inventory-quality-processing.test.ts tests/unit/quality-entry-read-scope.test.ts tests/unit/craft-entry-initialization.test.ts`：通过
- `node --import tsx --test tests/unit/post-finishing-record-performance.test.ts`：通过
- `QUALITY_MANAGEMENT_TEST_URL=http://127.0.0.1:43240 node --import tsx --test --test-name-pattern='库存交接定向切换' tests/browser-contracts/quality-demo-rebuild.test.ts`：通过
- `node --experimental-strip-types --test tests/workflow-governance/affected-checks.test.ts`：通过
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:43241 npx playwright test tests/finished-inventory-quality-handoff.spec.ts --workers=1 --reporter=line`：通过
- `INVENTORY_QC_PERF=formal PLAYWRIGHT_BASE_URL=http://127.0.0.1:43241 npx playwright test tests/finished-inventory-quality-handoff.spec.ts --grep 不勾选 --repeat-each=5 --workers=1 --reporter=line`：通过
- `INVENTORY_QC_PERF=formal PLAYWRIGHT_BASE_URL=http://127.0.0.1:43241 npx playwright test tests/finished-inventory-quality-handoff.spec.ts --grep 勾选熨烫包装 --repeat-each=5 --workers=1 --reporter=line`：通过
- `INVENTORY_QC_PERF=formal PLAYWRIGHT_BASE_URL=http://127.0.0.1:43241 npx playwright test tests/finished-inventory-quality-handoff.spec.ts --grep 查询、重置与日期错误 --workers=1 --reporter=line`：通过
- `INVENTORY_QC_PERF=formal INVENTORY_QC_VERSION=draft-control-identity-20261024 PLAYWRIGHT_BASE_URL=http://127.0.0.1:43242 npx playwright test tests/quality-management-rules.spec.ts --grep QC分区保存 --workers=1 --reporter=line`：通过
- `node /tmp/higoods-inventory-qc-evidence/measure-processing-print.cjs /tmp/higoods-inventory-qc-evidence/print-fixture-from-ui/finished-inventory-quality-c3211-接收、QC升检、勾选熨烫包装加工、三去向交接和返仓上架/inventory-session.json /tmp/higoods-inventory-qc-evidence/print-fixture-from-ui/finished-inventory-quality-c3211-接收、QC升检、勾选熨烫包装加工、三去向交接和返仓上架/inventory-processing-reference.json`：通过
- `git diff --check`：通过
- `npm run check:menu-routes`：通过
- `QUALITY_MANAGEMENT_TEST_URL=http://127.0.0.1:43242 node --import tsx --test --test-name-pattern="中心两份原PCS附件|原稽查冷直达|未知条件可保留草稿" tests/browser-contracts/post-quality-storage.test.ts tests/browser-contracts/quality-management-storage.test.ts`：通过
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:43242 npx playwright test tests/quality-management-rules.spec.ts --grep "QC分区保存|原QC完整30" --workers=1 --reporter=line`：通过

## 例外
- 用户接受状态：未接受，代理不代填；本次交付为本地原型修改与验证。
- 未宣称真实工厂试用、多人共享、物理库存、硬件或生产能力。测试站数据库未使用。
- 共享回归夹具修复：原生存储测试在构建夹具前显式准备现有结构化标准版本，再启用只读写计数；页面就绪选择器改用唯一标题，未削弱发布拒绝、原数据不变、只读与回滚断言。原工作台4例先发布规则，再领取真实未领取100件/5SKU原工厂批次以冻结本次要求，替代已退役的开始按钮及正在进行批次。完成仍断言持久质检完成和工作台任务退出，不伪造完成提示。
- 收据重跑限制：工具不能复用已通过检查；首轮收据因菜单登记、记录格式及上述旧夹具失败而保留implemented；后续两次发现同期商品反馈菜单/提前路由混入后主动终止，仅移除隔离副本的无关菜单与提前路由行。最终生成独立新收据，原始失败和中止日志保留。
- 额外全项目`npm run typecheck`在无关PCS技术资料文件中仍有既有错误（日志`typecheck-processing-final.log`），本任务受影响文件无此类错误；标准engineering检查与最终构建/共享集成由独立收据核实。不能把该额外命令说成全站通过。
- 本记录冻结后，治理/收据检查结果写入独立输出；不回填绑定文件，不以产品记录替代收据或用户接受。

## 文件与运行资产版本
- 最终产品运行资产index.html SHA256：`88d72bb169c82c872401bbc8f0c2ba046d953efb2388f5615755edc25b9dc433`；其脚本和样式哈希见`/tmp/higoods-inventory-qc-evidence/final-runtime-manifest.json`。
- 本任务隔离源码/测试逐文件清单：`/tmp/higoods-inventory-qc-evidence/final-source-manifest.json`，该清单SHA256为`49fae5d78153fbaf392c925aa8dfcd56b3f6f523dd7da3d60835f64f5b1f2519`。
- 原工作树同名文件当时哈希另存`/tmp/higoods-inventory-qc-evidence/original-source-at-final-isolation.json`；与隔离版仅差无关商品反馈菜单及main.ts提前路由行。原工作树其他任务改动及资料未被覆盖。

## 受管文件
- `src/data/app-shell-config.ts`
- `src/data/fcs/post-finishing-qc-entry.ts`
- `src/data/fcs/quality-demo-rebuild.ts`
- `src/data/wls/finished-inventory-quality.ts`
- `src/data/wls/finished-outbound-orders.ts`
- `src/main.ts`
- `src/pages/process-factory/post-finishing/qc-workbench.ts`
- `src/pages/wls/finished/inventory-quality.ts`
- `src/pages/wls/finished/outbound-orders.ts`
- `src/router/routes.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-records.ts`
- `src/data/fcs/post-finishing-inventory-bridge.ts`
- `src/data/wls/finished-inventory-quality-types.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/outbound-orders.ts`
- `src/pages/process-factory/post-finishing/full-flow-print.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `scripts/workflow-governance/affected-checks.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
