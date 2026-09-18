# PMS 采购管理系统迁移（P3a：基础资料与 BOM/样板）原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-18 |
| 相关需求 / 任务 | 采购管理系统 PMS 迁移 P3a：贸易主体、商品供应商、供应商供货档案、面辅料列表、成衣列表、样衣列表、仓库管理、单位管理、BOM/样板管理 + SPU 样板详情；需求矩阵 PMS-MD-001..012 共 12 条 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS |
| 涉及页面路径 | `/pms/trade-subjects`、`/pms/suppliers`、`/pms/supplier-supply-archives`、`/pms/material-archives`、`/pms/garment-skus`、`/pms/sample-skus`、`/pms/warehouses`、`/pms/units`、`/pms/bom-templates`、`/pms/bom-templates/:spu` |
| 端类型 | 管理端（1366×768 验收，1280×720 兜底） |
| 主要角色与任务 | 采购员：维护供应商、供货档案、单位，补充物料采购/申报/报关信息，核对 BOM 用量；采购主管：审核供应商、提交发布 BOM |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PMS 新增“基础资料”菜单组 9 个菜单项、9 个精确路由与 1 个 BOM 详情动态路由；新增供应商状态机、包装换算与快照、单位字典启停、BOM 用量修改与提交发布等可见交互；为满足真实图片硬门禁，牛皮纸吊牌、五层出口纸箱、印花包装贴纸、防潮珠 4 个演示物料替换为有实拍素材的白色府绸、涤棉里布、灰色罗纹布、2.5cm 弹力松紧带；“BOM 未匹配”发布后采购单可重新判定匹配并生成面辅料需求。

完整产品审查的当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 9 个标准列表页 + 1 个整页详情；页面标题、查询卡片、统计卡片、列表与分页层级完整 |
| 文案、状态、数量与单位 | 通过 | 供应商状态机、单位精度与换算、包装换算结果均使用中文业务文案；数量带基础单位与包装单位 |
| 扫码、真实图片与对象识别 | 通过 | 全部 14 个物料与 9 个款式均有真实素材；物料/款式图片与名称/编码同信息块，大图与失败态沿用共享渲染 |
| 防错、危险确认与主管兜底 | 通过 | 供应商名称唯一、驳回必填原因、启停二次确认；单位名称/缩写唯一且不可删除；供货档案变更生成快照；BOM 未匹配时用量只读、提交需二次点击 |
| 交接、跨端事实与异常追溯 | 通过 | 物料明确标注“PCS 同步、只读引用”，仓库标注“WMS 只读引用”；供货档案版本与快照可追溯；BOM 操作日志完整 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768/1280×720 验收通过；图片上传校验格式与大小并给出明确错误；本批无 PDA |
| 命名路由、交互、图片大图与打印 | 通过 | 10 个命名路由（含动态详情）可直达；BOM 详情返回列表导航正常；本批无打印 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 4 个演示物料无真实素材 | 视觉干扰 | 采购员 | 替换为有实拍素材的物料（白色府绸、涤棉里布、灰色罗纹布、弹力松紧带），同步更新 BOM 与演示数据；设计 §7.2 与矩阵 PMS-IMG-003 登记为已解决 | 否 |
| BOM 未匹配发布后，已有采购单行仍保留旧匹配标记 | 算不准 | 采购员 | 生成/校验时按当前 BOM 状态重新判定 SKU 匹配，发布 BOM 后可继续生成面辅料需求，并补充专项断言 | 否 |
| 样板富文本说明降级为纯文本 | 组件误用 | 采购员 | 已在页面与设计文档登记为原型范围内的有意简化 | 否 |

## 6. 最终结论

结论：通过（P3a 批次）

说明：

- P3a 负责的 12 条原子需求达到 `已实现待验证`，证据已写入矩阵；待产品确认后转 `已验证`。
- P1/P2 需求保持 `已实现待验证`；P3b/P4 需求保持 `待实施`。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pms/bom-detail.ts`
- `src/data/pms/bom-templates.ts`
- `src/data/pms/images.ts`
- `src/data/pms/materials.ts`
- `src/data/pms/product-purchase-orders.ts`
- `src/data/pms/product-skus.ts`
- `src/data/pms/supplier-supply-archives.ts`
- `src/data/pms/suppliers.ts`
- `src/data/pms/trade-subjects.ts`
- `src/data/pms/units.ts`
- `src/data/pms/warehouses.ts`
- `src/main-handlers/pms-handlers.ts`
- `src/pages/pms/bom-detail.ts`
- `src/pages/pms/bom-templates.ts`
- `src/pages/pms/material-archives.ts`
- `src/pages/pms/product-skus.ts`
- `src/pages/pms/supplier-supply-archives.ts`
- `src/pages/pms/suppliers.ts`
- `src/pages/pms/trade-subjects.ts`
- `src/pages/pms/units.ts`
- `src/pages/pms/warehouses.ts`
- `src/router/route-renderers-pms.ts`
- `src/router/routes-pms.ts`

### 页面路由

- `/pms/trade-subjects`
- `/pms/suppliers`
- `/pms/supplier-supply-archives`
- `/pms/material-archives`
- `/pms/garment-skus`
- `/pms/sample-skus`
- `/pms/warehouses`
- `/pms/units`
- `/pms/bom-templates`
- `/pms/bom-templates/HG-TS-2601`（动态详情示例）

### 验证命令

- `npm run build`：通过
- `npm run check:pms-purchase-chain`：通过
- `npm run check:menu-routes`：通过（PMS 菜单 20 条全部精确路由覆盖）
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm test`：通过（含 `tests/unit/pms-master-data.test.ts` 6 项）
- `CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_PORT=43253 npx playwright test tests/pms-master-data.spec.ts --workers=1`：通过
- `npm run workflow:verify -- --output /private/tmp/pms-p3a-task-receipt.json --task-boundary "PMS 迁移 P3a：基础资料与 BOM/样板（矩阵 12 条，含 P1/P2 回归）"`：通过（收据见 `/private/tmp/pms-p3a-task-receipt.json`）

### 性能证据（生产预览，Chromium，1366×768，2026-09-18）

- P3a 十个页面站内切换（45 次）：21–60ms，最大 60ms，均 < 200ms。
- 供应商交互（新增/详情，10 次）：30–40ms。
- 物料档案交互（详情/补充信息，10 次）：16–35ms。
- 供货档案交互（换算详情/编辑，10 次）：16–36ms。
- 单位交互（新增/启停，10 次）：28–38ms。
- SKU 详情交互（5 次）：26–38ms。
- BOM 列表 → 详情导航（5 次）：25–37ms。
- 原始样本见测试输出 `pmsMasterDataPerf.*`；P1 冷启动 68–83ms、P2 交互最大 40ms 回归通过。

### 真实图片验证

- 来源：`public/materials/`（fabric-main、fabric-lining、white-poplin、fog-grey-sweatshirt-fleece、cotton-yarn-cone、accessory-zipper/button/label/elastic-band、packing-bag 等）与 `public/` 款式实拍图。
- 对象对应：14 个物料逐一映射到对应品类实拍图（含替换后的 4 个物料）；7 个成衣款式、2 个样衣款式使用对应款式图。
- 同列缩略图：物料与款式图片均与名称/编码在同一单元格或同一信息块。
- 加载失败态与大图弹窗：共享图片渲染继续提供加载中、失败重试与 Esc 关闭；物料档案支持上传格式与大小校验。
- 缺图登记：无缺图对象；矩阵 PMS-IMG-003 标记 `不适用`（已通过素材替换解决）。

### 例外

- 无
