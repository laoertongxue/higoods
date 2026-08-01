# 毛织交出单打印与件数口径原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-01 |
| 相关需求 / 任务 | 毛织完工 / 交出按颜色+尺码件数；每次交出打印交出单；交出单展示生产单、毛织加工单、下游接收工厂、条码 / 二维码、款式图和物料图 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/craft/wool/work-orders`、`/fcs/craft/wool/work-orders/:woolOrderId/handover-print` |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 毛织业务、毛织仓管、下游接收工厂 |
| 主要任务 | 发起交出后打印随货交出单，确保部位毛织和整件毛织数量均按颜色+尺码件数流转 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 打印入口在毛织加工单操作栏，服务毛织业务和仓管；交出单随货给下游接收方。 |
| 任务清晰度 | 通过 | 有交出记录后才显示“打印交出单”，避免未交出打印空单。 |
| 信息架构与导航 | 通过 | 从加工单列表进入 A4 打印页；打印页按交出记录逐页展示。 |
| 页面模式 | 通过 | A4 单据模式，包含标题、业务信息、明细表、签收栏、条码 / 二维码。 |
| 信息负荷 | 通过 | 单据只展示生产单、毛织加工单、接收方、颜色尺码件数、款式图、物料图和签收信息。 |
| 文案 | 通过 | 页面使用“交出单”，不引入毛织菲票打印文案。 |
| 数量与状态 | 通过 | 部位毛织与整件毛织的完工 / 交出数量均统一为颜色+尺码件数。 |
| 扫码与识别 | 通过 | 每张交出单展示交出单号条码和业务二维码区域。 |
| 防错 | 通过 | 无交出记录时显示不可打印提示；缺图时提示需补真实图片。 |
| UI 样式 | 通过 | A4 宽度、打印样式、签收栏和随货单结构与现场纸质交出单匹配。 |
| 组件交互 | 通过 | 列表入口不触发整页重绘；打印页使用浏览器原生打印。 |
| 协作关系 | 通过 | 整件毛织接收方为后道工厂；部位毛织接收方为裁床工厂 / 裁床待交出仓。 |
| 异常与追溯 | 通过 | 单据绑定交出记录、生产单和毛织加工单，便于扫码追溯。 |
| 现场设备可用性 | 通过 | A4 打印页适配普通打印机；条码 / 二维码区域可用于后续扫码识别。 |

## 4. 问题标签

- `算不准`
- `缺扫码识别`
- `协作断裂`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 部位毛织按片数统计，和业务交出件数口径不一致。 | 算不准 | 毛织业务、下游接收方 | 将部位毛织计划 / 填报 / 交出统一为颜色+尺码件数，保留部位名称用于识别。 | 无 |
| 毛织没有交出单打印入口。 | 协作断裂 | 毛织仓管、下游接收方 | 在加工单操作栏增加“打印交出单”，有交出记录后显示。 | 无 |
| 交出单缺少扫码识别和图片辅助核对。 | 缺扫码识别 / 追溯不足 | 仓管、接收方 | A4 单据展示条码 / 二维码、款式图和物料图。 | 若源技术包未维护真实图片，页面会提示需补真实图片。 |

## 6. 最终结论

结论：通过

说明：

- 本次变更纠正毛织交出数量口径，并补齐交出单打印链路。
- 毛织打印链路只打印交出单，不恢复、不新增毛织菲票打印。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/fcs-route-links.ts`
- `src/data/fcs/wool-domain/mobile.ts`
- `src/data/fcs/wool-domain/mock-data.ts`
- `src/data/fcs/wool-domain/tech-pack-source.ts`
- `src/data/fcs/wool-domain/types.ts`
- `src/pages/process-factory/wool/handover-print.ts`
- `src/pages/process-factory/wool/work-orders.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`

### 页面路由

- `/fcs/craft/wool/work-orders`
- `/fcs/craft/wool/work-orders/:woolOrderId/handover-print`

### 验证命令

- `npm run check:wool-fact-workflow`：通过
- `npm run build`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:list-page-governance`：通过
- `CUTTING_E2E_PORT=63517 PLAYWRIGHT_REUSE_EXISTING_SERVER=false npm run test:wool-fact-workflow:e2e`：通过

### 例外

- 无
