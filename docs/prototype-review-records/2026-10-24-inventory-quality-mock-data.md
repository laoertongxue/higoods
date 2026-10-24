# 成衣库存质检默认Mock补齐
依据 `AGENTS.md` REVIEW-01、MOCK-01、SCOPE-02、PERF-01。
## 基本信息
- 日期：2026-10-24
- 任务 / 需求编号：INVQC-MOCK-20261024
- 验证人：Codex
- 当前工作树：`/Users/laoer/.codex/worktrees/inventory-quality-verification/higoods`，detached HEAD `6ad9f423a5c496898d61e7305bc767dd0a5cf2e7`。本次为上轮流程修复后的增量，前一轮源码及记录未回退。产品源码已定向合并至原工作树`/Users/laoer/Documents/higoods`，保留其他任务差异。
## 影响判定
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：用户要求“先补齐Mock数据”。在原送检流程补充静态关联示例，业务动作、结构、事务和路由契约保持不变；原生产任务目录及生产结果看板排除没有生产单身份的库存加工，修复新样本激活的读取错误。按T3定向Mock及直接消费者验收，不把上一轮版本收据冒充本次证据。
- 范围：成衣库存质检、正式出库、后道QC/加工/分类出货、仓库接收/上架及goto_global接收；仅本地同源Mock。
- 非范围：线上发布、测试站数据库、真实库存及工厂接受；没有新增导入、加载种子、演示模式或身份切换入口。
## 需求追踪
| 编号 | 独立结果 / 实现 | 验证与状态 |
| --- | --- | --- |
| M1 | 默认11条申请：1待实收、2待QC、1待加工、1待分类交出、1待返仓接收、1待上架、1待返工接收、3已完成 | 已验证；第一/第二页及统计，当前用户页面实际显示11条 |
| M2 | 同一静态数据提供11出库、10QC、2加工单、22分类出货/交接；对应来源/数量/时序一致 | 已验证；原业务命令离线生成，单据直达、源类型筛选及关联回读；22条分类出货保持默认20每页的第二页 |
| M3 | 各待办可从当前节点继续办理 | 已验证；独立浏览器上下文真实实收、QC、补包装、交出、返仓实收、上架与返工接收后刷新保留，5轮重复 |
| M4 | 正式SKU与对应实物图，逐SKU库位扣减及分类数量守恒 | 已验证；8个新增款各100件初始实物；3次历史返仓再发起形成96/95等合法后续批次，没有虚构补货；原4款可发起库存保留 |
| M5 | 仅静态读取，普通打开/刷新不整包写入或覆盖办理结果 | 已验证；默认原页面及各下游读取后库存业务持久记录为0；办理只写变化记录；没有清除用户数据 |
| M6 | 库存加工没有生产单身份，不误入生产目录或生产结果看板 | 已验证；两个生产来源投影明确过滤库存申请；相邻生产/PDA/设计改款读取回归及全体1789单测通过 |
## 原问题及数据边界
- 之前`createFinishedInventorySeed`只提供库存，申请、交接、流水和差异均为空，打开列表看不到完整链条。新增JSON是离线经现有业务动作生成的固定事实；页面只读，不运行生成器。
- 新样本使用独立`FI-APP-MOCK-INVQC-20261024-*`与`FI-MOCK-LOT-*`身份，保留原4款库存和所有浏览器覆盖/删除记录。没有数据结构或业务规则迁移，不需要清空旧业务库；无首次打开落种子或重复重建。
- 生成器校验正式档案图片；商品识别图不冒充缺陷照片。使用现有固定操作人，不新增角色或权限。质检与加工记录包含实际生成的轮次、稽查、完成量和事件时间，没有只填最终状态。
- 原命令回归使用专属隔离的空送检前置，先走现有标准版本切换，再仅对新增固定Mock建立删除标记；只存在测试上下文，不影响默认Mock专项或用户浏览器。默认Mock的3例专项从完整11条数据开始，未调用空前置助手。
## 自查结论
| 检查项 | 结论 | 证据 / 处理 |
| --- | --- | --- |
| 默认展示及两页范围 | 通过 | M1，当前页面截图、默认列表两页；原有非本模块销售/原料示例保留，不扩展或清理其他模块 |
| 关联身份、数量、时序、图片 | 通过 | M2/M4，2个Mock契约及生成器只读重建对照；每款100件在仓/后道/在途/返工/差异守恒 |
| 可继续办理及持久回读 | 通过 | M3/M5，默认Mock15次浏览器回放、相邻5例和原生事务3例 |
| 原生产链与完整技术回归 | 通过 | M6；工程类型检查及1789单测，生产结果看板专项；初期暴露的读取错误及日志ID冲突已修复，原始失败日志保留 |
| 页面加载与操作响应 | 通过 | 9家族各5次，共45样本，最大449.40ms，全部<=1000ms |
## 最终结论
结论：通过
## 页面证据
- 版本：本工作树；正式生产构建预览`http://127.0.0.1:43244`，同一构建在用户当前`http://127.0.0.1:43241`展示，当前用户原有标签已刷新；index.html SHA256 `535af30dac131759f8441e60b6e5487cbcef25f689741e32685f8965f39ba3c2`。
- 证据：`/tmp/higoods-inventory-qc-mock-evidence/formal-ui/`的默认第一/二页、各端直达与办理后刷新；当前用户页面`current-user-page.png`可见11条、2页和状态统计。正式主页面1366×768；办理用1280×720，Chromium 149.0.7827.55，Asia/Jakarta。当前用户页按实际窄侧栏截图，没有修改列表布局。
- 目录及清单：`/tmp/higoods-inventory-qc-mock-evidence/source-manifest.json`、`runtime-at-formal.json`、`performance-summary.json`；生成器例目及单号在`build-mock-final.log`。
## 性能结论
- 结论：通过
- 依据：45个有效样本、9家族、每族5次，最大449.40ms。起点为真实导航或click，终点包括目标内容、数量/状态、可交互、必要图像解码、字体、两帧绘制及IndexedDB持久回读；填写/确认等待不计。逐值及来源见`performance-summary.json`。
- 正式性能期间无重型构建/全量测试并行，产品源码与资产固定。后续补齐JSON原生导入属性只服务Node加载，独立输出目录重构建的index及其资源指纹与正式资产相同，证据`import-attributes-asset-equality.json`，因此复用原正式样本，不重测取快值。
## 验证命令
- `node --import tsx scripts/build-inventory-quality-mock.ts --check`：通过
- `node --import tsx --test tests/unit/inventory-quality-mock.test.ts tests/unit/post-finishing-current-surfaces.test.ts tests/unit/post-finishing-qc-shipping-integration.test.ts tests/unit/sewing-missing-business-date-demo.test.ts`：通过
- `node --import tsx --test tests/unit/fcs-design-revision-process-work-orders.test.ts`：通过
- `npm run typecheck:engineering`：通过
- `npm test`：通过
- `npx vite build --outDir /tmp/higoods-inventory-qc-mock-evidence/dist-import-attributes`：通过
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:43244 INVENTORY_QC_PERF=formal npx playwright test tests/finished-inventory-quality-mock.spec.ts --repeat-each=5 --workers=1 --reporter=line`：通过
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:43245 npx playwright test tests/finished-inventory-quality-handoff.spec.ts tests/finished-inventory-quality-flow.spec.ts tests/quality-management-rules.spec.ts --grep '真实页面完成|原库存页面申请|后道原入口整批实收79|库存原页面→实际收79' --workers=1 --reporter=line`：通过
- `QUALITY_MANAGEMENT_TEST_URL=http://127.0.0.1:43245 node --import tsx --test --test-name-pattern '同PCS库存QC完成事务故障|原库存80检24结果由中心窄源真实回读|中心两份原PCS附件' tests/browser-contracts/post-quality-storage.test.ts`：通过
- `node --experimental-strip-types --test tests/workflow-governance/affected-checks.test.ts`：通过
- `git diff --check`：通过
## 例外
- 用户接受状态：未接受。未发布、未测试真实库存/多人/工厂/硬件，不涉及测试站数据库。
- 未新建版本收据：本次为专用Mock及原生产来源边界修正，没有共享写事务/公共运行契约/路由/正式迁移变化，直接产品与技术证据完成本次验收；前轮收据只证明其原版本。
- 不回填前轮审查或收据；本次治理结果独立保存。命令校准中的选择器、确认框及JSON原生导入错误保留原日志，修正后补实际回放；未删除业务断言或伪造性能样本。
## 受管文件
- `src/data/wls/finished-inventory-quality-seed.ts`
- `src/data/wls/finished-inventory-quality-mock.json`
- `src/data/fcs/post-finishing-full-flow.ts`
- `scripts/build-inventory-quality-mock.ts`
- `src/data/fcs/platform-process-result-view.ts`
- `scripts/workflow-governance/affected-checks.ts`
