# 成衣库存质检最终发布增量审查
依据 `AGENTS.md` REVIEW-01、TRACE-01、EVIDENCE-01、RELEASE-01。

## 基本信息
- 日期：2026-10-24
- 任务 / 需求编号：保留最新main的成衣库存质检和结构化质检，追加验证发现的修复并发布Caddy，线上确认11条Mock直接可见
- 验证人：Codex
- 基准：`8fa2059496c8b88fa0e0c169d07bca5947ead34c`；分支`codex/inventory-quality-publish`；工作树`/Users/laoer/.codex/worktrees/inventory-quality-release/higoods`。
- 执行期间main先合入PDA版本b41f7b597，随后8fa205949已经合入完整库存质检、11条Mock及结构化质检。旧验证分支codex/inventory-quality-release和全部历史证据保留。本轮只追加实际仍缺少的增量，不用旧标准模型覆盖main新增功能。

## 影响判定
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：成衣出库列表的渲染/事件模块加载路径影响送检链路；固定Mock加工完成意图按当前加工命令重建；其余为现有回放的就绪条件和发布校验工具前置修正。
- 范围：2个应用入口、固定Mock中3条加工完成intent、3个回放脚本、2个发布检查工具及本记录。质检业务模型、数量状态、仓库/工厂去向、附件及上游结构化项保留main版本，不改依赖或发布设施，不触碰测试数据库。
- 计划：以8fa现有功能为事实基线 → 仅合并已经定位的加载/就绪/校验修复 → 用当前原命令重建Mock并比较事实 → 当前组合版完整两分支和待办复核 → 冻结文件后生成增量收据 → main快进推送 → 同SHA Caddy成功、版本JSON和线上页面确认。最终SHA、技术收据、Actions及线上结果另存独立证据，不回填本记录。

## 自查结论
| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| F1 出库列表按需加载 | 通过 | src/main.ts、src/router/routes.ts直接加载已有出库页面及事件处理，避免进入完整WLS注册表时加载返仓/盘点等无关模块。此前组合版出库导航1401.90/1013.10/1021.70ms的有效失败保留formal-current-main；当前正式样本全部<=1000ms。数据、权限、路由地址和原操作保持原契约。 |
| F2 固定Mock当前命令一致性 | 通过 | 使用现有build-inventory-quality-mock.ts离线重建。与8fa源JSON比较，11个cases、全部库存事实、加工任务逐值一致，只有3条processCompletions.intent包含当前main命令新增的空未处理原因。数量、人员、时间、项目及状态不变；mock-8fa-diff.json记录差异，重建确定性检查通过。 |
| F3 无加工分支完整闭环 | 通过 | 默认11条与新申请共存，80件送检生成成衣质检出库单；后道实收、原QC首检24/稽查升全检补56；不选加工直接分类交出。正常76返原仓上架、瑕疵2入瑕疵仓上架、返工2由goto_global接收。刷新与原记录回读保持，正常在架96、订单占用20、可用76。当前正式回放5次。 |
| F4 选择加工分支完整闭环 | 通过 | 相同实物和QC结果，选择熨烫、包装后顺序加工；包装未完成不能交正常货。事务中止注入保留原事实和输入，恢复重试只保存一次。随后完成相同三去向、返仓接收及上架，5次正式回放通过。 |
| F5 默认Mock与岗位入口 | 通过 | 默认11申请、两页10+1；10QC、2加工、22分类交接。无导入/手动加载前置，刷新不整包写种子。待办从真实接收、QC、包装、交出、返仓实收、上架及返工接收继续各5次。后道办理实收，成衣仓只回显；菜单名称、来源类型和自动操作人仍由8fa保留。 |
| F6 回放等待与计时完整终点 | 通过 | 上架用例等本批表单和全部库位控件出现后选择；仓位查询等待原逐SKU/仓库实物合计，未降低数量断言；出库计时等已保存单据读取完成、无读取错误及可交互，而非仅表头可见。原失败日志和trace保留在receipt-stock-read-failure、browser及各失败日志中。 |
| F7 两项发布工具前置 | 通过 | 菜单检查加入实际routes-central-pda注册表，未加路由白名单；标准列表Node夹具显式准备已读空接收快照，与原空部位票快照一致，不修改业务未读保护。两项独立校准通过，保留menu-routes-current-calibration.log和list-template-current-calibration.log。 |

## 最终结论
结论：通过
以上是当前组合版的产品行为证据。最终增量技术收据、main推送和线上发布另有独立输出，不提前宣称完成，用户接受不代填。前三份handoff、mock-data、full-mock-replay报告保留原版本；当前证据不冒充真实工厂、物理库存或多人接受。

## 页面证据
- 版本：8fa基线加本轮增量的生产构建，http://127.0.0.1:43249；index.html SHA256 `c75ebb491cc7f6492ef5e62dcfc01982e5308b56a0887f61e238a97761fe4bd5`；Chromium149，1366×768，Asia/Jakarta；独立浏览器上下文，不清理用户既有浏览器数据。
- 证据：`/tmp/higoods-inventory-qc-release-evidence/formal-8fa/`的20次真实页面回放、截图、持久回读与inventory-performance.json；源数据差异mock-8fa-diff.json，源码和运行资产哈希另存release-source-manifest.json、runtime-8fa-at-formal.json。
- 入口：即时库存、成衣库存质检、成衣出库、后道成衣质检收货与交接、QC工作台、加工详情及出货、预入库、返仓上架、goto_global返工接收。旧版本已发现的界面/加载问题保留原始日志，本轮没有为通过检查放宽业务条件。

## 性能结论
- 结论：通过
- 依据：当前两页Mock，34个等价操作家族、310个有效样本，每类至少5次，最大952.40ms，全部<=1000ms；逐值、路由、版本和环境见performance-8fa-summary.json与formal-8fa各例JSON。
- 起止：真实click/navigation开始，到目标内容、状态、数量、必要图片解码、字体、两帧实际绘制且可交互；保存含持久回读；出库含已保存记录读取就绪。填写阅读等待不计。正式采样未同时运行重型构建、全量测试或索引同步。

## 验证命令
- `node --import tsx --test tests/unit/inventory-quality-entry.test.ts tests/unit/inventory-quality-mock.test.ts tests/unit/inventory-quality-processing.test.ts tests/unit/finished-inventory-quality.test.ts`：通过
- `node --import tsx scripts/build-inventory-quality-mock.ts --check`：通过
- `node scripts/verification/run-quality-native-contracts.mjs`：通过
- `INVENTORY_QC_PERF=formal INVENTORY_QC_VERSION=release-on-quality-8fa205949 PLAYWRIGHT_BASE_URL=http://127.0.0.1:43249 CUTTING_E2E_PORT=43249 CUTTING_E2E_USE_PREVIEW=true PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/finished-inventory-quality-handoff.spec.ts tests/finished-inventory-quality-mock.spec.ts --grep '真实页面完成|Mock默认11条|Mock待办从现有节点' --repeat-each=5 --workers=1 --reporter=line --output=/tmp/higoods-inventory-qc-release-evidence/formal-8fa`：通过

Native契约47项通过，日志native-8fa.log；本轮未重复修改存储/结构化项模型。最终收据按实际增量选择构建及相邻页面检查，不导入旧成功结果，结果另存独立输出。

## 例外
- 无

## 受管文件
- `src/main.ts`
- `src/router/routes.ts`
- `src/data/wls/finished-inventory-quality-mock.json`
