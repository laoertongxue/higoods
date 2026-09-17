# 技术包准备工序投入／产出 SKU 链原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-16 |
| 相关需求 / 任务 | 技术包准备阶段维护物料加工前、加工后 SKU，并投影到对应加工单 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS |
| 涉及页面路径 | `/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo`；染色、印花加工单由专项契约验证 |
| 端类型 | 管理端 |
| 主要角色与任务 | 技术人员维护标准工艺路线；生产计划与加工厂在加工单中识别上游投入和本工序产出 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：技术包“工艺路线”的准备阶段工序卡片新增加工投入、加工产出和产出 SKU 选择；前道产出会成为后道投入；真实物料缩略图可打开高清大图。正式生产工艺快照以及染色、印花加工单新增投入／产出 SKU 投影。没有新增页面、路由或多层操作。

审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 保留现有技术包工艺路线页面和工序卡片；只在准备工序内补充投入、产出维护。 |
| 文案、状态、数量与单位 | 通过 | 染色、印花直接提示“必须更换 SKU”；单独水溶显示“SKU 不变”；水溶＋染色只显示一个工序卡片。本次不修改数量和单位口径。 |
| 扫码、真实图片与对象识别 | 通过 | 验收数据使用物料档案 `CNIDML360` 的真实 SKU 图；投入缩略图与 SKU 同块展示并能打开高清大图。扫码不适用。 |
| 防错、危险确认与主管兜底 | 通过 | 染色、印花禁止沿用投入 SKU；单独水溶禁止更换 SKU；相邻工序投入与前道产出不一致时阻断路线确认。 |
| 交接、跨端事实与异常追溯 | 通过 | 正式生产快照保存每个 occurrence 的投入／产出，染色、印花加工单从该快照读取，不另建事实源。 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 本次是管理端技术资料维护，不涉及 PDA、上传或弱网操作。 |
| 命名路由、交互、图片大图与打印 | 通过 | 原命名路由不变；1366×768 下无页面横向溢出；产出选择、刷新持久化和大图已验证。打印不适用。 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 准备工序只显示工序名，不能表达物料加工前后 SKU | 协作断裂 | 技术、生产计划、加工厂 | 在原工序卡片维护标准投入／产出 SKU，并向正式加工单投影 | 否 |
| 多道准备工序各自回退到原始 BOM，无法形成连续物料链 | 追溯不足 | 技术、生产计划 | 前道产出自动成为后道投入；排序和刷新后重新物化整条分支 | 否 |
| 水溶、染色分别生成卡片，且染色／印花允许显示 SKU 不变 | 业务规则错误 | 技术、生产计划、染厂、印花厂 | 单独水溶固定不换 SKU；染色、印花强制换 SKU；水溶＋染色合并成一张染色卡片和一张染色加工单 | 否 |

## 6. 最终结论

结论：通过

说明：

- 当前分支本地页面已验证同一物料的“水溶＋染色”只生成一张卡片，不再出现独立水溶卡片。
- 页面已验证 `CNIDML360-white-1 → 水溶＋染色 → CNIDML360-blue-1 → 印花 → CNIDML360-white-1`；两道含染色／印花的工序都实际更换 SKU 后，路线确认成功。
- 页面刷新后组合卡片、路线确认状态和两道工序的投入／产出仍保留，说明人工维护结果未被 BOM 重同步覆盖。
- 染色、印花加工单的投入／产出由专项检查验证；未在本次浏览器中制造正式生产单，避免把原型页面点击冒充生产发布事实。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-technical-data-version-types.ts`
- `src/data/tech-pack-process-route.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/process-work-order-generation-key.ts`
- `src/data/fcs/process-work-order-generation-registry.ts`
- `src/data/fcs/production-process-snapshot-derivation.ts`
- `src/data/fcs/production-process-work-order-service.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/pages/tech-pack/bom-process-linkage.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/process-domain.ts`

### 页面路由

- `/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo`

### 验证命令

- `npm run check:tech-pack-preparation-sku-route`：通过。
- `npm run build`：通过；101 条单元测试通过，Vite 生产构建通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run check:tech-pack-process-route`：失败；既有夹具缺少“已完成设计改款来源”而被发布门禁阻断，尚未进入本次 SKU 路线断言。本次新增专项已覆盖相关路线和加工单投影。

### 真实图片验证

- 图片来源：物料档案 `material_fabric_001` 下的 `CNIDML360-white-1`、`CNIDML360-blue-1` 正式 Mock 物料图。
- 对象对应：染色投入显示白色 SKU 图；印花投入显示前道产出的蓝色 SKU 图。
- 缩略图位置：与工序投入 SKU 编码、名称位于同一信息块。
- 大图：点击染色投入缩略图后显示“物料高清大图”弹窗，可用关闭按钮退出。
- 失败态：沿用现有真实图片组件的加载中和失败提示；不以无关占位图冒充。

### 例外

- 无。
