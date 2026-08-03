# 毛织交出单打印与件数口径原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-01 |
| 相关需求 / 任务 | 毛织计划 / 填报 / 库存 / 交出按颜色+尺码件数；彻底删除交出单投入纱线板块及其专用数据链；加工单批量打印、详情单条打印；SPU 同区唯一真实款式图；标准可扫描二维码；毛织无菲票 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/craft/wool/work-orders`、`/fcs/craft/wool/work-orders/:woolOrderId`、`/fcs/craft/wool/work-orders/:woolOrderId/handover-print`、`/fcs/craft/wool/work-orders/:woolOrderId/handover-print/:handoverId` |
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
| 任务清晰度 | 通过 | 有交出记录后列表显示“打印交出单”；详情每条记录显示“打印本次交出单”，批量与单条入口语义明确。 |
| 信息架构与导航 | 通过 | 列表入口批量打印全部交出记录；详情入口携带 `handoverId` 精确打印本条，不存在时显示明确空态。 |
| 页面模式 | 通过 | A4 单据包含标题、SPU 款式信息、加工后 SKU、颜色尺码件数明细、签收栏和标准二维码。 |
| 信息负荷 | 通过 | 单据只展示交出对象所需的生产单、毛织加工单、接收方、加工后 SKU、颜色尺码件数、款式图和签收信息；投入纱线不作为交出对象展示。 |
| 文案 | 通过 | 页面使用“交出单”，不引入毛织菲票打印文案。 |
| 数量与状态 | 通过 | 部位毛织与整件毛织的完工 / 交出数量均统一为颜色+尺码件数。 |
| 扫码与识别 | 通过 | 每张交出单使用 `qrcode.react` 输出真实 SVG 二维码；不存在装饰条纹假条码或 7×7 假二维码。 |
| 防错 | 通过 | 打印按钮初始禁用；无交出记录时不可打印；浏览器确认每页款式图真实加载且全部二维码 SVG 生成后才解锁，图片加载失败继续禁用，二维码尚未生成时点击会提示且不调用打印。 |
| UI 样式 | 通过 | A4 宽度、签收栏和随货单结构与现场纸质交出单匹配；唯一款式图与 SPU 款号款名处于同一区块，不另设款式图片区。 |
| 组件交互 | 通过 | 列表入口不触发整页重绘；打印页使用浏览器原生打印。 |
| 协作关系 | 通过 | 整件毛织接收方为后道工厂；部位毛织接收方为裁床工厂 / 裁床待交出仓。 |
| 异常与追溯 | 通过 | 单据绑定交出记录、生产单和毛织加工单，便于扫码追溯。 |
| 现场设备可用性 | 通过 | A4 打印页适配普通打印机；标准二维码可供扫码设备识别。 |

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
| 交出单曾使用装饰条纹和伪方格冒充条码 / 二维码。 | 缺扫码识别 / 追溯不足 | 仓管、接收方 | 删除伪条码、伪二维码，复用标准二维码组件并绑定交出记录、生产单和毛织加工单。 | 无 |
| 款式图曾独立成区且与 SPU 信息分离。 | 视觉干扰 / 选不对 | 毛织业务、仓管、接收方 | 每页只保留一张真实款式图，并与 SPU 款号、款名置于同一区块。 | 无 |
| 交出单曾错误展示“本次交出对应物料”，把上游投入纱线误当成交出对象。 | 选不对 / 追溯不足 | 毛织业务、仓管、接收方 | 彻底删除错误板块、DOM 标记、毛织专用 `materialImages` / `materialImageUrl` 映射、Mock 与图片资产；保留开工门禁所需 `requiredYarnSkus` 和来源 ID，交出单只展示加工后 SKU。 | 无 |
| 款式图 URL 后缀合法但图片实际 404 或损坏时曾可启用打印。 | 选不对 / 追溯不足 | 毛织业务、仓管、接收方 | 打印按钮默认禁用，以每页图片 `complete + naturalWidth` 和二维码 SVG 作为浏览器真实门禁；图片错误保持禁用，点击时再次校验。 | 无 |
| 批量打印 Mock 的两次交出曾复用同一款色尺码输出行，无法验证第二页事实映射。 | 选不对 / 追溯不足 | 毛织业务、仓管、接收方 | 批量样例改为黑色 M 与白色 L 两条不同加工后 SKU，分别补齐必需纱线接收、加工入库、交出与库存事实；逐页按 `outputSkuCode` 验证颜色、尺码、件数。 | 无 |
| 列表只能按加工单批量打印，详情不能精确打印本次记录。 | 点错风险 / 追溯不足 | 毛织业务、仓管 | 保留列表批量入口，并在详情每条交出记录增加带 `handoverId` 的单条打印入口。 | 无 |

## 6. 最终结论

结论：通过

说明：

- 本次变更纠正毛织交出数量口径，并补齐交出单打印链路。
- 毛织打印链路只打印交出单，不恢复、不新增毛织菲票打印。
- 旧版包含独立款式图片区、伪条码和伪二维码的截图已判定作废；本轮只接受修正后的浏览器页面和新截图作为证据。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/fcs-route-links.ts`
- `src/data/fcs/wool-domain/mobile.ts`
- `src/data/fcs/wool-domain/mock-data.ts`
- `src/data/fcs/wool-domain/tech-pack-source.ts`
- `src/data/fcs/wool-domain/types.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/pages/process-factory/wool/handover-print.ts`
- `src/pages/process-factory/wool/work-order-detail.ts`
- `src/pages/process-factory/wool/work-orders.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`

### 页面路由

- `/fcs/craft/wool/work-orders`
- `/fcs/craft/wool/work-orders/:woolOrderId`
- `/fcs/craft/wool/work-orders/:woolOrderId/handover-print`
- `/fcs/craft/wool/work-orders/:woolOrderId/handover-print/:handoverId`

### 验证命令

- `npm run check:wool-fact-workflow`：通过
- `npm run build`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:list-page-governance`：通过
- `CUTTING_E2E_PORT=64232 PLAYWRIGHT_REUSE_EXISTING_SERVER=false npm run test:wool-fact-workflow:e2e`：通过
- Playwright 浏览器验收：批量打印页按交出记录分页，详情单条入口只展示指定 `handoverId`；每页一个 SPU 款式图、加工后 SKU、颜色+尺码件数、结构化接收方和一个标准 SVG 二维码，且不出现投入纱线板块。
- 新版实际截图必须覆盖 SPU 同区唯一款式图、加工后 SKU、颜色、尺码、件数、接收方和标准二维码；不得出现“本次交出对应物料”、投入纱线 SKU 或纱线图片。

### 例外

- 无
