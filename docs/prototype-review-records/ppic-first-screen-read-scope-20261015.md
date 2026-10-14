# PPIC 首屏读取依赖补修本地验证记录

依据 [AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。继承已确认每日回货方案 R51／R52／R58／R59，实施范围见 [S01～S08 方案](../product-design/ppic-first-screen-read-scope-refinement-20261015.md)。本记录只关闭本地补修阶段；正式部署及性能写入外部发布记录。旧版本失败保留。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：PPIC 首屏 S01～S08，继承 R51／R52／R58／R59
- 验证人：Codex 主代理；一个独立只读代理累计审查

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：读取已冻结生产事实及已有换款映射不再静态载入 PCS 当前技术包写入链；命名 FCS 页的实际 IDB 读取模块提前抓取，缩短首屏。实时建单、换款预览、新建与条码补全保留当前校验。数量、当前人、截止、两节点及正式后道回货政策未变。

## 来源与实施绑定

030fdecb 正式 Web 113 项业务断言通过，但冷加载 1075.6～1535.6ms，成员首例1599.2ms，仍失败。按直接依赖拆分：S01 11 个冻结 clone；S02 原生产单数组／持久覆盖不动；S03 三种建单及三辅助迁移并更新六个实际消费者；S04 不新增事实或写入；S05 消除 PCS 重链并只提前 IDB 抓取；S06 最终差异／发布闭合；S07 同一换款记录核心；S08 原默认完整快照静态发布。产品及直接消费者源集合 SHA256 `387740f4cd71521d4f832b23c4a93e5bd77fa55d85270b7c23d720fcfdbf2584`，逐文件 SHA 见原始汇总。

18 个生产函数原体一致；成衣 39 个原体一致，只改 loadSnapshot 默认来源，保留唯一缓存和原存储键。新静态样本 54,043 UTF-8 字节（52,921 字符），与原捕获快照逐字节相同；3 替换、12 库存、3 换码任务、8 移动。普通读取不落种子、保存覆盖优先、坏数据阻断。旧换款 localStorage 保存未在本轮整体迁移，不冒称新的 IndexedDB 事务。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 冻结字段、深拷贝及默认 | 通过 | moved-function-contract.json 18 原体；snapshot-freeze-replay.log V1/V2、旧快照和追溯断言；969 单元 |
| 实时建单门禁 | 通过 | demand-current-replay.log 到正式建单及缺来源／未启用负例；现有测款动作夹具补全，产品门禁不变 |
| 同一换款及数量、条码／图 | 通过 | garment-flow.log core/integration；原始种子逐字节、read-contracts.json；实时代码保留当前 SKU |
| 普通读取、覆盖和损坏恢复 | 通过 | read-contracts.json 五个隔离模式全部通过且零写入；读取失败不回种子 |
| 回货数量与原子保存 | 通过 | ppic-browser.log 22 项；事务失败无半套、输入保留、重试去重、399→499 新标签闭环 |
| 当前人及职责 | 通过 | 当前负责人／成员及组长、异步身份变化阻断；无演示身份选择；浏览器22及保存失败性能 |
| 两节点、正式收货及合同 | 通过 | 合同新两页35%／100%；后道实际确认产生同库事实与 PPIC 分摊；物理交接不冒充正式收货 |
| 页面、PDA和真实图片 | 通过 | browser-1791996766529 的 1366／1280／1024 Web及390×844 PDA；真实对象图片、Esc与电子合同；原图未更换 |
| 预取边界 | 通过 | preload-contract.json 17 正反路径；仅 IDB优先，PMS／PCS顺序与 PDA登录保持；专用毛织／后道和非法地址不命中 |
| 本地生产产物性能 | 通过 | 73 类×5共365样本，全部≤1000ms，最大915.5ms；实际输入、完整内容／图片／绘制及保存回读终点 |
| 独立累计差异审查 | 通过 | 一个只读代理检查 S01～S08、Vite优先级、测试前置修复，无新增P1／P2；主代理核对实际diff与产出 |
| 正式站及真实硬件接受 | 不适用 | 本记录仅本地阶段，正式站新SHA另验；PDA为Chromium小屏、打印为电子预览，非真实工厂接受 |

验证入口 S09：初始收据 implemented，三份 Node 专项未识别，原件保留 task-receipt-initial.json。精确路由两份实际建单／冻结；旧工程驱动只允许三 builder 导入移位且其它源码、imports及别名原样，并实际执行建单／冻结；其余改变必须完整执行旧driver。审查P2（导入属性／求值顺序判定过宽）收紧：拒绝解析错误与属性、新建导入必须紧邻原订单导入且全顺序一致；只允许首尾空白不同，内部源码及注释原样。两个原反例加入并复测，326 治理测试和迁移专项通过，未使旧全流程失败变成通过。新增治理工具不进入产品构建，性能原资产／消费者哈希未变，按 EVIDENCE-01 保留原身份。

## 最终结论

结论：通过

仅本地补修阶段通过。正式部署、线上业务与性能仍需新版本证据；不以本地收据宣称整体交付。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/garment-spu-replacement-records.ts`
- `src/data/fcs/garment-spu-replacement-seeds.json`
- `src/data/fcs/garment-spu-replacement.ts`
- `src/data/fcs/production-frozen-snapshot.ts`
- `src/data/fcs/production-order-create.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-return-fulfillment.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/production-upstream-chain.ts`
- `src/data/fcs/return-inbound-workflow.ts`
- `src/pages/production/demand-domain.ts`
- `src/pages/production/garment-spu-replacement-display.ts`
- `src/pages/production/orders-domain.ts`
- `src/pages/wls-garment-relabel-tasks.ts`
- `vite.config.ts`

### 页面证据

- 版本：codex/ppic-daily-return，基准030fdecb7119fc96e7af2dc579fd6c886ce78d84及上述源集合；HTML SHA256 `a9812b696a95acbe8c7c6667d0944b2365e452c2cbdadb1beb038b7218baa5ce`；工作树 `/Users/laoer/.codex/worktrees/5f34/higoods`。生产预览端口5526／5527／5437／5586以各报告为准，PPIC真实浏览器服务5482禁止复用。Chromium149，Asia/Jakarta真实时钟；1366×768、1280×720、1024×768、390×844；隔离数据，未动用户资料或测试站数据库。
- 证据：`output/ppic-release-20261015/read-scope/`；browser证据 `output/ppic-adversarial-20261014/browser-1791996766529/`（实际目录身份不因记录日期改变）。日报、团队、累计回货、工作台、任务分配、生产进度、后道仓及PDA正式确认；合同图片真实母版、两页两节点，图片大图Esc、错误阻断与持久读回。

### 性能结论

- 结论：通过
- 依据：performance-summary.json 73类365样本最大915.5ms；原始4份JSON和脚本保留冷context、独立browser冷启动、首次／刷新、输入、取消、成功／失败分支。正式030超时仍有效，不删除慢值或放宽门禁。

### 验证命令

- `npm run build`：通过
- `npx vite build`：通过
- `node --import tsx tests/fcs-demand-to-order-current-tech-pack.spec.ts`：通过
- `node --import tsx tests/fcs-production-tech-pack-snapshot-freeze.spec.ts`：通过
- `npm run check:garment-spu-replacement:core`：通过
- `npm run check:garment-spu-replacement:integration`：通过
- `npx playwright test --config tests/ppic-daily-return.config.ts`：通过
- `node output/ppic-release-20261015/read-scope/read-contracts.mjs`：通过
- `node output/ppic-release-20261015/read-scope/preload-contract.mjs`：通过
- `node output/ppic-release-20261015/read-scope/performance.mjs`：通过
- `node output/ppic-release-20261015/read-scope/consumer-performance.mjs`：通过
- `node output/ppic-release-20261015/read-scope/receipt-performance.mjs`：通过
- `node output/ppic-release-20261015/read-scope/identity-save-failure-performance.mjs`：通过

- `npm run test:workflow-governance`：通过
- `GOVERNANCE_BASE_SHA=030fdecb7119fc96e7af2dc579fd6c886ce78d84 node --import tsx scripts/check-pcs-engineering-test-import-migration.ts --scope worktree`：通过

### 例外

- 无性能或业务门禁例外。附加旧工程/KOL/surface专项未通过，已在干净030 primary按原入口复现同一失败，baseline-*.log与当前日志均保留；不记通过。旧换款创建UI与旧后道outbound选择器的附加browser失败，在实际正式030与新preview隔离比较matched=true（legacy-browser-comparison.json），未成功保存，未因本次修改新增。这些旧入口不作为本次PPIC接受证据，也未扩大去修改旧路由。当前直接建单／冻结、记录core/integration、正式回货和预览覆盖如上。
- 全量裸tsc存在13项原诊断，typecheck-before与refined内容一致，无新增；本轮通过正式构建及适用契约，不冒称裸tsc全绿。
- 技术收据输出约定 `output/ppic-release-20261015/read-scope/task-receipt.json`，由最终文件冻结后实际生成；线上同SHA收据与结论登记外部部署记录，不回写已冻结本记录冒充原证据。
