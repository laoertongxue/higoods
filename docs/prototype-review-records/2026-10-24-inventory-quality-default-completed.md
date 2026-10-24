# 两笔线上完整流程进入默认Mock
依据 `AGENTS.md` REVIEW-01、TRACE-01、EVIDENCE-01、RELEASE-01。

## 基本信息
- 日期：2026-10-24
- 任务 / 需求编号：将两笔已在线上走通的库存质检纳入默认Mock，保留原11条及8个待办；按用户确认将第二笔重建为76件。
- 验证人：Codex
- 基准：`e436065efd9f63f22cf97baa47ce2129d16db6ac`；分支`codex/inventory-quality-publish`；工作树`/Users/laoer/.codex/worktrees/inventory-quality-release/higoods`。

## 影响判定
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：默认静态案例从11增至13，完整历史消耗原有基础款库存；种子按库位ID采用最新余额，不能叠加同一库存的原始余额。
- 范围：离线Mock生成器、固定JSON、库存种子合并、直接单元和页面夹具及本记录。没有改变质检、加工、交接、事务、路由、权限、附件或发布设施，不触碰测试数据库。
- 计划：业务命令顺序重建 → 保留原案例与日志身份 → 校验库存守恒与直接页面 → 固定生产资产采样 → 冻结文件生成技术收据 → main推送及同SHA Caddy发布 → 新浏览器直达验证。计划及原需求登记在独立证据目录的task-plan.json。
- 数据边界：新增案例使用独立MOCK身份，保留原可见申请单号；第二笔数量按用户明确选择重建，操作人和步骤时间由既有Mock业务命令生成。静态版本v2，结构不变，原11条事实不退役；现有浏览器覆盖和删除标记仍按原读取契约保留，不清理用户资料，不导入独立会话快照。

## 自查结论
| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| R1 两笔默认完整记录 | 通过 | INVQC-20261024-222e43126b为80件不加工；INVQC-20261024-2db1fa26c7为76件熨烫包装。共13申请、12QC、3加工单、28分类交接；固定JSON包含实际源库位、实收、检查轮次、升检、去向、接收和上架事实。由原业务命令重建，--check可重复得到同一输出。 |
| R2 连续库存 | 通过 | 两笔分别正常76/72、瑕疵各2、返工各2；第二笔至少56件来自第一笔返仓实物，原仓仅余20件，不另加补货。正常期末在架92、订单排除20、可送检72。种子以同ID新余额覆盖原库位，不重复加入原100件。单位、来源和三去向守恒通过。 |
| R3 原案例保留 | 通过 | original-cases-preserved.json逐值比较原11条cases、applications、transfers、movements、differences、scopes、qcTasks、postTasks、processCompletions和logs均保留；新日志独立编号，避免因排序变化重编号旧日志。原8待办仍存在，实际继续办理实收、QC、包装、交出、返仓接收、上架及返工接收各5次。 |
| R4 默认直达与回读 | 通过 | 默认两页10+3，新案例排序在前；两笔已完成详情及加工详情各5次，三类交接完成、刷新后仍可读，没有库存业务整包种子或Mock后道记录写入。对象对应图片和实际滚动后的页面截图已查看。 |
| R5 直接回归 | 通过 | 新基线72件再发起送检，真实页面完成无加工及熨烫包装两分支，最终正常68、瑕疵2、返工2，返仓上架后正常在架88、排除20、可送检68。加工事务失败重试、类型区分、唯一记录、刷新回读与原13条共存通过。 |
| R6 夹具隔离 | 通过 | 原100件QC算法测试改用原始基线，保留100/30/50/100数量断言；空案例浏览器夹具恢复被完整历史消耗的原始库位，其余示例定向移除。未降低业务断言或清理真实资料。构建曾发现的两项夹具失败保留在build-unit-fixture-failure.log，修正后的直接集成与构建通过。 |

## 最终结论
结论：通过
本记录声明上述本地产品验收。最终技术收据、main推送与线上版本/页面结果另存独立输出，不预填发布成功，不代填用户接受。

## 页面证据
- 版本：上述基准加本次增量的生产构建；http://127.0.0.1:43259；Chromium149，Asia/Jakarta；列表及已完成详情1366×768、待办续办1280×720；index.html SHA256 `1867a114e3ddf97275247627a9e8280079a980f232809333429ef77fdc25d939`。
- 证据：`/tmp/higoods-inventory-qc-default-completed-release/`的default-list-13.png、completed-direct-76.png、completed-processing-72.png；formal目录15次回放与截图、new-cycle目录2次完整后续流程、runtime-at-formal.json固定1375个文件；原始线上独立回放证据仍保留在inventory-qc-online-full-flow-20261024目录。
- 入口：成衣库存质检13条和第二页、两笔已完成详情、后道加工详情、原待办实收/QC/包装/分类交出、预入库、上架、goto_global接收及即时库存。

## 性能结论
- 结论：通过
- 依据：13条两页Mock，11个等价家族、60个有效样本，每类至少5次；最大501.40ms，全部<=1000ms；逐值见performance-summary.json及formal各inventory-performance.json。
- 起止：真实导航/点击开始，目标内容、数量、状态、必要图片解码、字体、两帧绘制且可交互；保存含持久回读，阅读填写等待不计。正式采样期间无重型构建、全量测试或索引同步。

## 验证命令
- `node --import tsx --test tests/unit/inventory-quality-entry.test.ts tests/unit/inventory-quality-mock.test.ts tests/unit/inventory-quality-processing.test.ts tests/unit/finished-inventory-quality.test.ts`：通过
- `node --import tsx --test tests/unit/post-finishing-quality-integration.test.ts`：通过
- `node --import tsx scripts/build-inventory-quality-mock.ts --check`：通过
- `npm run build`：通过
- `INVENTORY_QC_PERF=formal INVENTORY_QC_VERSION=default-completed-13 PLAYWRIGHT_BASE_URL=http://127.0.0.1:43259 CUTTING_E2E_PORT=43259 CUTTING_E2E_USE_PREVIEW=true PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/finished-inventory-quality-mock.spec.ts --grep 'Mock默认13条|两笔线上完整流程|Mock待办从现有节点' --repeat-each=5 --workers=1 --reporter=line --output=/tmp/higoods-inventory-qc-default-completed-release/formal`：通过
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:43259 CUTTING_E2E_PORT=43259 CUTTING_E2E_USE_PREVIEW=true PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/finished-inventory-quality-handoff.spec.ts --grep '真实页面完成' --workers=1 --reporter=line --output=/tmp/higoods-inventory-qc-default-completed-release/new-cycle`：通过

收据按实际路径独立选择并执行技术检查，不导入上述成功结果；如再次选择构建，属于工具不支持复用后的独立执行，与正式采样串行。

## 例外
- 无

## 受管文件
- `src/data/wls/finished-inventory-quality-seed.ts`
- `src/data/wls/finished-inventory-quality-mock.json`
