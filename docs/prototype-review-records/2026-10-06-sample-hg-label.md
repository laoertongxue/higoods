# SKU 维度 HG 样衣编号与标签打印原型审查

## 1. 基本信息

- 日期：2026-10-06；需求 HG-001～009 / SAMPLE-LABEL-001～004，WP-SAMPLE-LABEL。
- 模式：完整产品审查；PCS 管理端，仓管和样衣管理人员。
- 工作树 / 版本：/Users/laoer/Documents/higoods，codex/sample-hg-label，基准55627178d7b3b6bd1742cdd539bbc34064522b83加当前差异；源manifest见对应审查证据。
- 功能服务4206，最终构建性能服务4207；1366×768 / 1280×720。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增样衣标签独立预览/打印、HG 编号和首次登记日期；样衣库存与卡片/详情有打印入口；测款⑤扫码HG映射内部SKU。打印不写贴码事实。

依据 `AGENTS.md` 第 4 节现场基线、第 5 节 UI 与图片门禁、第 7 节验证规则、总体设计7.3/7.5、实施计划WP-SAMPLE-LABEL。本次用户确认的条码/日期优先于旧“码值=SKU”规则。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 页面层次、角色与任务 | 通过 | 库存/卡片/详情只提供入口，独立预览设置宽高和份数 |
| 文案、状态与单位 | 通过 | HG和完整SKU分开；日期固定首次登记；尺寸mm；编号为演示序列，默认尺寸仅试打 |
| 对象识别和扫码 | 通过 | 条码编码HG，映射内部SKU并核对本单；原SKU/错HG阻断；PDF实际条纹解析及校验位通过 |
| 保存与恢复 | 通过 | 编号/序列/入库/台账/测款单同事务；空间不足和中途中止不丢已有数据；并发防重复；普通读取不落种子 |
| 事实与追溯 | 通过 | 最早入库日期复用，重复到样/类型转换不改变HG与日期；打印/取消不改位置/台账/贴码 |
| 图片与大图 | 通过 | 原库存/详情图片资源保持同源；样衣现有图片加载和大图开关已重跑；标签按照片只输出条码及文字 |
| 低分辨率、交互与打印 | 通过 | 1366及1280无页面溢出，完整SKU不截断；宽高/份数边界、PDF一份一页、取消只读 |
| 统一性能 | 通过 | 1445原始样本，每项至少5次，最大385.80000001192093ms，全部≤1000ms |

## 4. 问题标签

- 追溯不足、缺扫码识别（已修正，见下表）。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
|---|---|---|---|---|
| 原SKU可回退当作HG | 缺扫码识别 | 仓管 | HG唯一映射、无编号阻断、相邻契约重放 | 否 |
| 旧SKU再到样首次日期可能被替换 | 追溯不足 | 样衣管理 | 两注册入口共用最早入库事实，台账时间固定到样事实 | 否 |
| 详情贴码仍显示SKU | 对象识别 | 仓管 | 展示HG、对应SKU和贴码时间 | 否 |

一名只读代理二次复核上述问题关闭；主代理核对完整diff和实际浏览器/PDF。

## 6. 最终结论

结论：通过。

本结论限HG标签本次原型功能和相邻样衣回归；不声称实体打印机/纸张校准、实际生产后台、全项目类型错误归零或远端发布。技术收据以 output/playwright/sample-hg-label/task-receipt.json 实际结果为准。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-sample-management.ts`
- `src/data/pcs-sample-label-seeds.ts`
- `src/data/pcs-testing-order-repository.ts`
- `src/pages/pcs-sample-management.ts`
- `src/pages/pcs-sample-label.ts`
- `src/pages/pcs-testing-order-detail.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`

### 页面路由

- `/pcs/samples/label/smp-001`及动态新到样/旧资料标签路由
- `/pcs/samples/inventory`、`/pcs/samples/view`、`/pcs/samples/detail/smp-001`
- `/pcs/samples/application`、`/pcs/samples/transfer`、`/pcs/samples/return`
- `/pcs/samples/ledger`、`/pcs/samples/ledger/stocktake`
- `/pcs/testing/orders`、`/pcs/testing/orders/to_seed_normal`、`/pcs/testing/orders/create`及新建双SKU测款单详情

### 验证命令

- `node --import tsx --test tests/unit/pcs-sample-hg-label.test.ts tests/unit/pcs-sample-wp05.test.ts`：通过，4/4。
- `node --import tsx --test tests/browser-contracts/pcs-sample-hg-label.test.ts tests/browser-contracts/pcs-sample-wp05.test.ts`：通过，HG专项1/1＋样衣全流程5/5。
- `node --import tsx --test --test-name-pattern='legacy receipt' tests/browser-contracts/pcs-sample-hg-label.test.ts`：通过，5轮旧资料生成/失败/重试/缺日期。
- `node --import tsx --test tests/browser-contracts/pcs-sample-hg-performance.test.ts`：通过，170样本。
- `node --import tsx --test tests/browser-contracts/pcs-sample-performance.test.ts`：通过，1080样本。
- `node --import tsx tests/pcs-sample-management.spec.ts`：通过。
- `npm run build`：通过，工程类型检查＋586单元测试＋Vite。
- `npm run check:list-page-governance:static`：通过，573页面。
- `npx tsc --noEmit`：失败，3项既有范围外错误，当前文件无新增错误。
- `node --import tsx tests/pcs-testing-order.spec.ts`：失败，旧reset/bootstrap清空演示单假设失效，详见本次证据，不替代新HG契约。
- `codegraph sync` / `codegraph status --json`：通过，同工作树无待同步。

### 真实图片验证

库存、卡片和详情复用现有服装实拍图，在对象身份同一信息块显示；最终浏览器回归逐张等 naturalWidth>0，图片大图打开/关闭与低分辨率均通过。未替换图片或添加无关占位图。标签本身按用户照片不添加服装图或二维码。

### 验证结果

验证结果：通过（PASS）。实现、源hash、原始响应样本、失败记录、PDF和截图见 docs/reviews/2026-10-06-sample-hg-label/implementation-and-evidence.md 及 evidence。最终治理检查绑定任务收据。

### 例外

- 无性能例外。
- 标签按用户现场照片仅含条码、HG、首次登记日期、完整SKU，不添加图片。纸张宽高采用可调试打，60×40mm不是正式现场尺寸；实体纸张与打印机验收尚未发生。
