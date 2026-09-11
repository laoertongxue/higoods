# 实施计划

基线与边界见同日 quantity-reconciliation-design。按依赖顺序执行，原有工作区差异不归入本次。

| 工作包 | 业务目标 | 负责文件/修改 | 验证证据与完成条件 |
|---|---|---|---|
| W1 | 实收扣减、备料关联与分批投入 | factory-receiving*、dyeing-task-domain、process-action-writeback-service、开工输入 | 专项脚本：同SKU分配、超用阻断、刷新守恒 |
| W2 | 交出与实收对应 | dyeing-task-domain、旧交出动作、reports/events、work-order-detail、pda-handover-detail、pda-handover-events | 专项脚本：逐卷单/实际回执、0少超收、旧入口阻断 |
| W3 | 仓库和统计共用事实 | dyeing-quantity-facts、dyeing-warehouse-view、warehouse、process-statistics-domain、reports | MJS/历史库存可见，单位分组、数量相等、图片和追溯 |
| W4 | 两轮验收与交付证据 | 本次专项脚本/浏览器检查、审查记录、矩阵 | 最终改动后重跑专项、命名页面、构建、治理、CodeGraph；任务收据只在可限定本次边界时执行 |

两轮结束后进行正向需求覆盖与反向代码范围审查。无真实后端或生产库存改动；GitHub发布不是本次范围。

实施回执：W1—W4 已完成本地验证，原子证据见同日矩阵与审查记录。旧收发数量捷径的历史脚本已按确认后的实际数量规则调整；不再使用伪造包装动作参数建仓记录。
