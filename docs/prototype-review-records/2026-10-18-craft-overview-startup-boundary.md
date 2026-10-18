# 工艺总览与工厂档案首次加载边界修复

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01；使用 `docs/prototype-review-record-template.md`。

## 基本信息

- 日期：2026-10-18
- 任务 / 需求编号：CAP-BOOT-01～CAP-BOOT-06
- 验证人：Codex，技术验证不代替用户接受
- 阶段：因正式验收出现有效性能失败而开展的直接初始化依赖修复；不得覆盖 f5943ca6 的原失败或发布证据。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：T4 共享主入口的限定路由分支，T5 发布另行核验；页面内容、工厂能力规则、路由身份、业务保存及其他入口保持现有契约。

## 需求与当前事实

基准 `f5943ca6e225889aaa289b0f31501629ed607d2c` 已正式发布，已修复能力派生元数据误冲突。正式页面内首个总览冷启动样本为 `1257.1000000238419ms`，是有效超时，保留在 `output/playwright/seam-capability-startup-regression/formal-f5943ca6/browser-metadata-v2/result.json`；本地 701.5ms 不能替代该正式失败。该版本正式全部页面 / 性能未验收完成；新修复的本地与正式证据分别登记，不把本地通过改写成旧正式通过。

当前总览渲染器只读取固定的概览卡片定义和 escapeHtml，不读取生产、裁片、采购或分配数据。通用 renderCurrentPageContent 却先启动 PMS 和生产资料恢复，再经过宽 FCS 路由表找到同一个渲染器。独立正式诊断还发现工厂档案同样加载119个脚本，完成1020.6ms；总览诊断1039.0ms。诊断含额外栈记录开销，不作为5样本通过。两页均在约955～978ms后才请求真正页面模块，实际打开无关PMS、生产与裁片数据库。目标是复用两页原渲染器及外壳，准确限定这两个具名入口，普通业务入口仍在真正消费来源前执行原来的恢复和错误保护。不把 Loading 或占位当完成，不移动既有数据的真实完成终点，不新增后端、状态机或维护功能。

浏览器策略禁止读取用户原 43183 标签页和其资料；独立诊断及验收仅用新 context、自造存量、43185 或正式 HTTPS。原本地服务已在原 43183 端口恢复，不以工具读取用户页面来证明成功。

工厂档案既有 `factory-profile → store-domain-pda` 初始化会写 PDA 角色 / 用户种子，这在 f5943ca6 原诊断中已存在；本次不改该接口或初始化，不把“工厂主源零写”扩大为整个 localStorage 零写。

## 实施计划与原子矩阵

1. 用实际主入口函数的最小契约证明静态总览当前错误启动无关依赖，保留失败。
2. 在主入口直接调用既有总览渲染器和既有工厂档案owner loader，保留优先错误检查；限定规范路径、查询及尾斜杠，不影响相邻或未知入口。
3. 核对从总览进入业务页后仍恢复必要 PCS/FCS 来源及已保存覆盖，元数据修复、16 类页面、单工厂显示不回退。
4. 原页面内容等价、具名设备和首导航性能验证；完成两轮实质审查、冻结治理收据，之后发布并重新正式核验。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / 性能证据或理由 | 状态 | 证据位置 | 确认人和版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAP-BOOT-01 | 正式失败、当前事实 | 静态总览及独立工厂档案使用原内容，不先恢复无关采购和生产资料 | 入口边界 | main.ts / renderCurrentPageContent | 原 HTML 等价、初始化调用序列 | 独立加载诊断及当前构建页面 | 已验证 | 本文运行证据与 asset-version.json、build.log | Codex，f5943ca6 + 当前3路径差异 |
| CAP-BOOT-02 | 来源恢复 | 相邻业务导航仍独立恢复已保存来源及错误，不依赖总览预热 | 业务边界 | 原通用入口及现有处理器 | 相邻入口、普通采购、工艺已保存覆盖 / 失败契约 | 真实导航与读回 | 已验证 | navigation-local/result.json、实际主入口契约 | Codex，当前限定入口差异 |
| CAP-BOOT-03 | 精确范围 | 保留外壳、优先错误与相邻路由；不改业务保存 | 范围保护 | main.ts、原总览渲染器 | 查询、尾斜杠、近似路径、既有门槛 | 页面内容及工厂主源无改写 | 已验证 | local/result.json、17项专项与1158构建 | 同上 |
| CAP-BOOT-04 | PERF-01、UI-01 | 当前构建实际页面、设备和有效性能通过 | 运行验证 | 受影响入口与直接调用方 | 版本、资源、原生存量检查 | 有效原失败保留，新版本每家族至少5样本 | 已验证 | local/result.json（131场景，95有效样本） | 同上；正式另验 |
| CAP-BOOT-05 | 用户要求 | 两轮独立实质对抗审查及冻结收据通过 | 审查 | 本次3路径及原件 | 明确实质结论与字节绑定 | 运行证据由主代理整合 | 已实现待验证 | R1、R2实质审查已通过；冻结收据另由final-delivery.json登记 | 同上 |
| CAP-BOOT-06 | 已有发布授权 | main / GitHub / 正式版本一致，全量16类线上核对 | T5 | 后续提交和发布回执 | 发布后独立登记 | 不预填部署或线上通过 | 待实施 | final-delivery.json（实际发布后） | 同上 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 限定入口修复及边界 | 通过 | 两具名入口复用原owner；8项初始化契约与9项能力迁移契约，整体构建1158通过；原成本清理错误优先 |
| 页面、持久资料与性能 | 通过 | 当前生产预览131场景、95有效样本最大356.5ms；原正式f594慢样保留失败，T5新正式另验；empty/saved/invalid实际导航与恢复0主源写 |
| 双轮审查 | 通过 | R1八项反证与R2证据/代码独立实质审查均0阻断；R2原件hash61713e7421858d04600f18d8c7cb2698c749c62afbb38fb26795aca31efa0417；仅文档结论增量再封印 |
| PDA、打印、数量、金额 | 不适用 | 本次具名两页不改这些业务对象，不更改相关渲染或读写规则；相邻业务初始化契约须保留 |

## 最终结论

结论：通过

本记录的T4产品阶段（CAP-BOOT-01～04和05双轮实质审查）通过；主代理已审查完整3路径实际diff及运行原件，未关闭产品问题0。CAP-BOOT-05尚待的文档封印/冻结技术收据与CAP-BOOT-06的T5推送、部署和新正式页面/性能由独立 output/verification/craft-overview-startup-boundary/final-delivery.json 逐项关闭；未满足时不宣称完整交付。旧f594正式1257.1ms失败保持原版本和身份，不能由本地通过自动关闭。技术验证不代填用户接受。

## 变更覆盖与验证

### 受管文件

- `src/main.ts`
- `tests/unit/craft-entry-initialization.test.ts`
- `docs/prototype-review-records/2026-10-18-craft-overview-startup-boundary.md`

### 页面证据

- 证据：output/playwright/craft-overview-startup-boundary/local/result.json、navigation-local/result.json、真实CLI日志及下列截图，分别记录本地实际页面与功能回读；正式另验。
- 版本：基准 f5943ca6 + main.ts 限定入口差异；工作树与资源哈希固定在 output/verification/craft-overview-startup-boundary/asset-version.json（1386源文件、1220资源），Node v26.8.2。
- 本地环境：http://127.0.0.1:43185，同工作树 npm run preview；Chromium 155.0.8059.80，Asia/Shanghai、zh-CN、未设网络或CPU降速。自造有效历史工厂能力配置在原生 storageState 中于导航前提供，未读取用户资料。
- 页面原件：output/playwright/craft-overview-startup-boundary/local/result.json，131场景，包括18个实际入口（总览、工厂档案、16类加工单）、1366×768冷入口与刷新、1280×720和1024×768共36布局；标题、当页min(total,10)条数、总数、单工厂显示、交互、相应可见图片解码、无文档溢出及控制台错误均核对。工厂编辑器正确保留缝边绣、模板工序、普通绣花勾选，取消零工厂主源写，刷新仍一致。1024压褶首屏图片在下方，真实滚动并解码核对。
- 导航与存量原件：output/playwright/craft-overview-startup-boundary/navigation-local/result.json。三个新context实际先开总览，再点击现有侧栏“打揽加工单”；总览前无生产actions、宽FCS路由表或具名PMS模块。空源用静态记录；有效原生effects以INIT-EFFECTS-READ-001在实际界面/关联单据读回并刷新保留；故意无效源阻断正常页面且原records/commands/meta逐字不改，隔离夹具修复后实际reload恢复（该泛工艺错误页现无重读按钮，未伪造按钮）。全部普通业务0写、工厂主源字节不变，无人工import还原内存。此脚本只作功能证据，不报<=1000ms。
- 截图：local/workbench-1366-cold.png、profile-1366-cold.png、profile-editor-merged.png、list-1366-cold.png，以及1280/1024布局及pleating-1024-scrolled-image.png。主代理实际查看总览、档案、编辑器，未用HTTP200代替页面。
- 该修复不改变16类详情渲染、物料、打印、迁移保存；这些原功能证据保持原版本身份，仅本次直接入口与相邻恢复重新核对。未对用户标签页或用户业务数据做写入/清空。

### 性能结论

- 依据：local/result.json的19家族各5个有效导航样本，全95原值最大356.5ms；具名环境、完成终点及原正式失败保留说明如下。
- 结论：通过
- 范围：本阶段T4当前生产预览；T5新正式发布后另验，旧正式1257.1ms仍是f5943ca6有效失败。
- 当前采集器 collector-local.js 沿用已核读v5真实终点；从导航起点0开始，在页面内MutationObserver先于应用安装，核对真实标题、数量、必要可见图片decode、fonts.ready、有限动画和两帧绘制。无自动化locator等待时间冒充完成点，无加载占位、删慢值、取平均、预热或同版本刷绿。
- 19家族各5个有效样本，共95：总览1366冷90.700/61.200/68.700/68.800/67.400ms；工厂档案86.900/74.700/81.100/79.700/84.100ms；总览刷新40.800/52.800/37.300/44.900/50.300ms；16加工单冷样全部原始值见local/result.json，每类5样，最大356.5ms。18冷入口分开家族，刷新独立家族；36布局场景不冒充重复性能样。
- 原f594正式失败与startup-waterfall-diagnostic/diagnostic.json保留，诊断开销样不作为5样本验收；代码变更后追加当前新证据，未覆盖旧结果。正式通过只由后续独立final-delivery.json及新正式原件关闭。

### 验证命令

- `npm run check:prototype-design-governance -- --scope worktree --paths src/main.ts,tests/unit/craft-entry-initialization.test.ts,docs/prototype-review-records/2026-10-18-craft-overview-startup-boundary.md`：通过
- `npm run build`：通过
- `git diff --check`：通过
- `playwright-cli -s=craft-startup-local run-code --filename output/playwright/craft-overview-startup-boundary/collector-local.js`：通过
- `playwright-cli -s=craft-startup-local run-code --filename output/playwright/craft-overview-startup-boundary/navigation-local.js`：通过

实际主入口最小失败：red-contract.log 2失败/6通过；navigation-state-red.log 证明未更新previousRenderedPagePathname的反例失败。修复更新该状态后再await原loader，保留相邻补料、退片、准备时效重新进入语义。

`node --import tsx --test tests/unit/craft-entry-initialization.test.ts tests/unit/seam-factory-capability-migration.test.ts`：17通过（green-contract.log）；后增导航状态断言由最终npm run build覆盖。

`npm run build`：退出0，1158通过/0失败、Vite22.91s；build.log和build-outcome.json。产物与采集器asset-version.json绑定。

`playwright-cli -s=craft-startup-local run-code --filename output/playwright/craft-overview-startup-boundary/collector-local.js`：passed=true，0失败。

同新隔离CLI执行navigation-local.js：passed=true，3场景均通过；原collector仅改自有43185地址与截图路径，运行包装器将首个真实goto替换为总览加受信侧栏点击，来源脚本与变更说明见navigation-local/provenance.json。

第一轮审查：output/verification/craft-overview-startup-boundary/adversarial-round-1.json，passed=true、0阻断，源码/测试相同，报告当时为计划身份；第二轮adversarial-round-2.json，passed=true、0阻断，独立核对41件文件、CLI真实输出与落盘JSON、实际包装器与恢复、95原始值、85首批实际响应body及1386/1220全字节。R2报告快照保留，本记录仅追加已发生的结论，不改其原件。

最终文档封印与收据：adversarial-round-2-document-seal.json、task-receipt.json；文件冻结后运行，实际状态独立登记，不预填收据通过。

治理预检v4通过；v1～v3为记录字段/枚举格式错误，原日志保留，只修正本记录的命令结果格式及页面/性能依据字段，未改产品、原样本或验收标准。最终冻结收据会再次检查最终文档字节。

### 例外

- 无。不清理用户资料，不写测试站数据库，不降低1000ms门槛。
