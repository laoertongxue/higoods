# 花边生产单全功能展示原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-10 |
| 相关需求 / 任务 | 去掉页面顶部角色切换，直接展示各角色在当前业务状态下可执行的全部功能 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS |
| 涉及页面路径 | 花边采购需求、花边生产单列表、花边生产单详情 |
| 端类型 | 管理端 |
| 主要角色与任务 | 花边厂业务员执行接收、投入维护、加工填报、完成和交出；花边厂主管执行撤销完成和取消；平台主管恢复误取消。页面不再要求用户切换角色后才能看见动作。 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：删除花边采购需求、花边生产单列表和详情页右上角的角色选择器及切换反馈；生产单按当前状态同时展示业务员、主管和平台可执行动作。数量、状态门禁、采购变更、图片、交出及收货事实不变。各动作提交时仍按对应业务角色写入操作记录。

当前审查采用：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端直接呈现当前状态下全部业务动作，不再由演示角色切换决定数据和按钮；动作日志仍保留业务员、主管、平台主管的责任区分。 |
| 文案、状态、数量与单位 | 通过 | 删除“当前操作身份”“当前查看身份”和切换提示；原有生产、交出、收货状态及 Yard、KG 等单位口径不变。 |
| 扫码、真实图片与对象识别 | 通过 | 本次未改变对象识别规则；采购需求、生产单列表和详情仍沿用款式、加工投入及加工产出的真实对应图片、加载态、失败态和大图查看。 |
| 防错、危险确认与主管兜底 | 通过 | 取消、撤销完成、恢复误取消仍受生产状态和下游事实门禁约束；取消和撤销等危险动作的二次确认不变。 |
| 交接、跨端事实与异常追溯 | 通过 | 交出与中央辅料仓收货链路未改；业务动作仍使用对应角色记录操作事实，未把全部日志伪装成平台主管。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 本次为桌面管理端调整；1024×768 详情页和 1280×720 列表页可完成主要操作，未新增上传或弱网流程。PDA 不适用。 |
| 命名路由、交互、图片大图与打印 | 通过 | 三个命名路由完成 Chromium 验收；列表和详情无角色选择器，状态允许的业务员及主管动作同时可见。打印不适用。 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 演示人员必须切换角色才能查看不同动作，容易误以为页面能力不完整 | 选不对 | 产品、研发、测试及演示人员 | 删除角色切换控件，读取完整数据并按生产单状态展示动作并集；提交时按动作归属角色记录日志 | 否 |

## 6. 最终结论

结论：通过

说明：

- 页面已经按确认口径改为全功能展示，同时保留业务状态门禁和动作责任留痕。
- 不在错误状态强行展示不可执行按钮：例如“恢复误取消”只在已取消且满足恢复条件的生产单出现。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/accessory/lace/purchase-demands.ts`
- `src/pages/process-factory/accessory/lace/work-orders.ts`
- `src/pages/process-factory/accessory/lace/work-order-detail.ts`

### 页面路由

- `/fcs/craft/accessory/lace/purchase-demands`
- `/fcs/craft/accessory/lace/work-orders`
- `/fcs/craft/accessory/lace/work-orders/LWO-RJ-260808-001`

### 验证命令

- `npm run check:lace-factory-management`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=49481 npx playwright test tests/lace-factory-input-v15.spec.ts --workers=1 --reporter=line`：通过，4 个 Chromium 场景全部通过
- `npm run build`：通过
- `npm run check:list-page-governance`：失败，检查在本任务范围外的既有页面 `src/pages/wls-fabric-demand-board.ts` 停止；本次未修改该页面，也未修改治理基线绕过检查
- `npm run check:prototype-design-governance -- --all`：通过（补齐本记录中的明确结果后重新执行）
- `codegraph sync` 与 CodeGraph 状态检查：通过，索引已是最新状态，1479 个文件已索引
- `npm run workflow:verify -- --output /private/tmp/lace-all-functions-task-receipt.json --task-boundary "花边采购需求、生产单列表及详情去掉角色切换并展示当前状态下全部角色动作"`：失败，收据状态为 `implemented`；唯一阻塞项是上述范围外列表治理问题，原型治理与构建在收据内通过

### 页面证据

- `/private/tmp/lace-v15-purchase-demands.png`
- `/private/tmp/lace-v15-work-orders-1280.png`
- `/private/tmp/lace-v15-work-order-detail-1024.png`

### 真实图片验证

- 图片来源和对象关系沿用花边采购投影及加工投入物料档案；本次未替换素材。
- 列表中的款式、投入物料和产出物料仍与名称／编码在同一信息块展示。
- 专项检查继续覆盖加载失败重试、`Esc` 关闭和大图预览；Chromium 场景覆盖实际页面渲染。

### 例外

- 无
