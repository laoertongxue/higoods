# PCS 商品中心重构实施计划

## 0. 文档信息

| 项目 | 内容 |
|---|---|
| 文档性质 | 本期重构执行计划（计划≠完成证明） |
| 权威需求来源 | `docs/product-design/PCS商品中心重构总体设计文档.md`（2026-09-22） |
| 矩阵 | `docs/product-design/PCS商品中心重构需求追踪与交付矩阵.md` |
| 代码基线 | `codex/shangpinzhongxinyouhua001` @ `5fdc7a4c` |
| 版本 | 1.0 / 2026-09-22 |

## 1. 目标与完成标准

**目标**：按总体设计完成阶段①→④，使 PCS 四大模块边界、测款单、档案关系、物料变种、样衣统一模型在页面与数据上可验收，且旧对象零残留。

**完成标准**：

1. 矩阵全部条目无无说明的 `待实施/实施中/已实现待验证/已阻塞`。
2. 分阶段专项契约 + 命名路由浏览器验收 + 全局治理检查通过；最后一次实质修改后证据重跑。
3. 涉及页面/交互条目满足 `AGENTS.md` §7.2 性能门禁（默认 <500ms）或有明确授权例外。
4. 生产准备 V2.4 相关命名页面回归通过（冻结验证）。
5. 产品确认人对矩阵勾选 `accepted` 前，仅可声明 `verified`。

## 2. 事实依据

- 总体设计 §1–§13（用户已确认口径）。
- V2.4 生产准备现状与路由（`src/router/routes-pcs.ts` 等）。
- 现状代码盘点：商品项目、旧测款、样衣、档案、物料文件清单见各工作包。

## 3. 范围 / 非范围

**范围**：WP-01～WP-06。  
**非范围**：生产准备/技术资料流程改造；样衣无码模块；真实后端；FCS 字典维护页；测款渠道扩展配置化；路由前缀统一（非阻断）。

## 4. 上下游影响与依赖顺序

```
WP-01 清理 ──▶ WP-02 商品档案 ──▶ WP-03 物料变种 ──▶ WP-04 测款单 ──▶ WP-05 样衣 ──▶ WP-06 总验收
         （WP-02 与 WP-03 同属阶段②，允许在 WP-01 完成后有限并行，合并门禁）
```

- 上游：WP-01 必须先删除旧事实源，避免双写。
- 下游：WP-04 依赖 WP-02 建档与渠道对象；WP-05 打标依赖 SKU 码语义（WP-02）。
- 生产准备：只读回归，不排期改造。

## 5. 工作包

### WP-01 阶段①：清理（商品项目、旧测款、包材、空路由）

| 项 | 内容 |
|---|---|
| 业务目标 | 代码与业务逻辑清洁：删除废弃模块与占位入口 |
| 主要文件/符号 | `src/router/routes-pcs.ts`；`src/data/app-shell-config.ts`；`src/state/store.ts`（死别名）；`src/pages/pcs-projects.ts`、`pcs-projects-list.ts`、`pcs-live-testing.ts`、`pcs-video-testing.ts`、`pcs-reset-placeholder.ts`；`src/data/pcs-project-*`（约 34）、`pcs-task-bootstrap.ts` 中项目节点、`pcs-live/video-testing-*`、`pcs-channel-product-project-repository.ts` 测款回写分支、`pcs-product-lifecycle-governance.ts` 测款通过场景、`pcs-pattern-task-*` 需求来源「预售测款通过」、`pcs-task-project-relation-writeback.ts`、`pcs-task-source-normalizer.ts`、`pcs-project-domain-contract.ts`；`main-handlers/pcs-handlers.ts` 对应事件；相关 tests/scripts |
| 修改 | ① 删商品项目菜单/路由/页面/数据/事件；② 删直播/短视频测款入口与回写链文案；③ 删包材分类全量引用；④ 删清空占位页与 workspace/mapping 占位路由、通配 PCS 占位实现（未知路径走应用级未匹配）；⑤ 清理 store 死别名；⑥ 全局 `工程变更/设计打样` 已清零基础上，增加「商品项目/直播测款/短视频测款/包材/测款通过（现行写链）」残留扫描 |
| 验证证据 | 专项扫描脚本或契约测试：旧路由 0 注册、旧菜单 0 项、包材 0 引用、占位页函数 0 引用；`npm run build`；`rg` 残留清单为空；生产准备路由抽查不回归 |
| 完成条件 | CLEAN 矩阵条目全部至少 `已实现待验证`；阶段①页面抽查通过 |
| 需求编号 | CLEAN-001～CLEAN-012 |

### WP-02 阶段②A：商品档案

| 项 | 内容 |
|---|---|
| 业务目标 | 去测款门禁；SPU–SKU–渠道对象收口；预计用料挂 SKU；采购链接不进档案 |
| 主要文件/符号 | `src/pages/pcs-product-archives.ts`、`pcs-channel-products.ts`、`pcs-channel-stores.ts`、`pcs-material-archives.ts`（若共用）；`src/data/pcs-style-archive-*`、`pcs-sku-archive-*`、`pcs-channel-*`、`pcs-product-lifecycle-governance.ts`、`pcs-product-archive-fixtures.ts`；routes/apps 菜单分组调整 |
| 修改 | ① 删除测款通过建档门禁与场景文案；② SKU 增加预计用料 1..N 编辑与展示；③ SKU 详情移除/禁止采购链接字段；④ 渠道店铺、渠道店铺商品菜单明确归商品档案分组；⑤ 定义并实现「测款单→档案」回写字段清单与钩子（供 WP-04 调用，本期可先落地接收端）；⑥ Mock 按总体设计 §10.2 |
| 验证证据 | 档案专项：无测款历史可建档；预计用料增删改；SKU 无采购链接断言；渠道列表命名页 1366×768 截图；回写接收器单测 |
| 完成条件 | ARCH 条目验证通过；与 CLEAN 无冲突残留 |
| 需求编号 | ARCH-001～ARCH-012 |

### WP-03 阶段②B：物料档案与变种

| 项 | 内容 |
|---|---|
| 业务目标 | 五类物料 + SPU–变种 + 命名/同类型唯一 + BOM 迁移 |
| 主要文件/符号 | `src/data/pcs-material-archive-types.ts`、`pcs-material-archive-repository.ts`、`pcs-engineering-bom-*`（仅引用与迁移映射，不改生产准备流程）、`pcs-tech-pack-*` 快照挂接点；`src/pages/pcs-material-archives.ts`、`pcs-material-archive-detail.ts`；新变种类型/仓储文件（命名 `pcs-material-variant-*`，目标位待绑定） |
| 修改 | ① 删除包材（若 WP-01 已删类型则本包验收）；② 变种实体与血缘；③ 染色命名生成器 `SPU-颜色-Pantone+PT`；④ processes type 对接 FCS 工序工艺字典只读源（本地镜像种子）；⑤ 同类型仅一层校验；⑥ variantId 作为 BOM 行挂接与存量一次性映射；⑦ 展示码生成不作为主键 |
| 验证证据 | 变种契约测试：多层链、同类型重复阻断、命名样例 `CNIDML130-apricot-17-4030PT`、迁移后 BOM 指向基础态变种；页面：面料变种详情+图片大图 |
| 完成条件 | MAT 条目验证通过；生产准备 BOM 页面回归（沿用可调语义抽查） |
| 需求编号 | MAT-001～MAT-014 |

### WP-04 阶段③：测款单

| 项 | 内容 |
|---|---|
| 业务目标 | 独立测款模块，十步行为链 + 大货三态 + 两次上架 + 回写 |
| 主要文件/符号 | 新页面目录 `src/pages/pcs-testing-order/*`（目标）；路由 `src/router/routes-pcs.ts`；菜单 `app-shell-config.ts`；数据 `src/data/pcs-testing-order-*`（目标待绑定）；复用档案建档 API、渠道商品创建、样衣入库/打标、回写接收器 |
| 修改 | ① 测款单列表/详情（十步步骤条）；② 唯一性：同 SPU 仅 1 进行中单；③ 挂链数据：采购链接、物流、核价、判断、寄样方式；④ ⑧创建渠道商品并推送 TikTok/Shopee；⑤ ⑩是/否/待定状态机；⑥ 进入下一步触发档案回写；⑦ 大货=是提供进入生产准备的引导（不改门禁）；⑧ Mock 十场景（总体设计 §10.1） |
| 验证证据 | 测款单专项契约（状态机/唯一性/回写时机/淘汰）；命名路由浏览器验收全步骤+三态；旧测款路由 0 匹配；性能门禁每入口 ≥5 样本 |
| 完成条件 | TEST 条目验证；与 WP-02 回写清单一致 |
| 需求编号 | TEST-001～TEST-024 |

### WP-05 阶段④：样衣统一模型

| 项 | 内容 |
|---|---|
| 业务目标 | 营销/生产样品统一 + 类型互转 + 位置抽象 + SKU 码 |
| 主要文件/符号 | `src/pages/pcs-sample-management.ts`（或按任务边界局部重写）；`src/data/pcs-sample-*`；位置主数据新文件（`pcs-sample-location-*` 目标待绑定）；测款单④⑤对接 |
| 修改 | ① 样品类型字段与互转动作+留痕；② 流转位置主数据（直播间/家播/工厂/部门/仓库）替换自由文本；③ 打标：码值=SKU 编码、必须贴码；④ 营销/生产流转 Mock；⑤ 删除摄影营销位残留文案；⑥ 无码能力明确不做 |
| 验证证据 | 样衣专项：互转留痕、位置 ID 引用断言、打标完成条件、扫码=SKU 展示；命名页浏览器验收+图片大图；性能门禁 |
| 完成条件 | SAMP 条目验证；测款④⑤链路联调通过 |
| 需求编号 | SAMP-001～SAMP-014 |

### WP-06 总验收与治理

| 项 | 内容 |
|---|---|
| 业务目标 | 两轮正反向追踪、治理与交付状态 |
| 主要动作 | 正向：总体设计→矩阵→实现→证据；反向：代码/路由/Mock→需求编号；`npm run check:prototype-design-governance`；`check:list-page-governance`；构建；受影响性能门禁汇总；`npm run workflow:verify` 收据；CodeGraph sync |
| 完成条件 | 矩阵状态闭环；收据绑定当前 HEAD；待产品 `accepted` |
| 需求编号 | GATE-001～GATE-006 |

## 6. 风险

| 风险 | 缓解 |
|---|---|
| 清理误删生产准备依赖的项目/测款符号 | WP-01 前 `impact`/rg 依赖清单；生产准备冒烟 |
| 回写清单与档案字段不一致 | WP-02 冻结字段表后再开发 WP-04 回写 |
| 变种迁移破坏既有 BOM 展示 | 先写迁移契约测试再批量映射 |
| 性能门禁在大列表失败 | 分页/局部更新，禁止首屏全量 |
| 双事实源（旧测款缓存 localStorage） | 清理存储键扫描并列入 CLEAN |

## 7. 验证命令基线（实施时按任务边界裁剪）

```bash
npm run build
npm run check:prototype-design-governance
npm run check:list-page-governance
npm run workflow:verify -- --output <tmp>/task-receipt.json --task-boundary "<WP>"
```

## 8. 变更控制

- 需求变化先改总体设计，再同步本计划与矩阵。
- 每个提交/PR 声明负责的矩阵需求编号。
- 本计划不构成完成证明。
