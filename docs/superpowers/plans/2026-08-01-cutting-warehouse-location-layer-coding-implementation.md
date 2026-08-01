# 裁床仓库库位层级编码与维护实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复仓库既有依赖漏洞，并把裁床待加工仓、待交出仓改造成可按“库区—货架—层—层内位置”维护和选位的演示原型，完整支持系统编码、分层可视化、无限制跨区域多选和 Web/PDA 写回。

**架构：** 保持 Vite、TypeScript、Tailwind CSS 与 Vanilla TypeScript 字符串模板架构。共享仓库类型只增加兼容字段，裁床层位 Mock、布局快照、投影模型和维护动作分别收口；“层”由库位的 `levelNo` 分组产生，不新增独立主数据。浏览器本地布局直接升级为完整快照并使旧缓存失效，不做迁移兼容层。

**技术栈：** Vite 6、TypeScript、Tailwind CSS、Vanilla TypeScript、localStorage Mock、tsx 检查脚本、Playwright。

---

## 执行约束

- [ ] 全程在分支 `codex/cutting-warehouse-location-layer-design` 和工作树 `/Users/laoer/Documents/higoods/.worktrees/cutting-warehouse-location-layer-design` 内执行。
- [ ] 开始实现前运行 `codegraph sync` 与 `codegraph status`；每次发现待同步文件时，以待同步文件的实际内容为准。
- [ ] 每个任务先补失败检查，再写最小实现，再运行该任务列出的专项检查。
- [ ] 不改真实后端、权限、路由总结构、无关仓库模块和列表页公共基线。
- [ ] 页面或 Mock 变更必须更新原型审查记录，并在最终提交前通过设计治理检查。
- [ ] 禁止 `npm audit fix --force`，禁止降低审计等级或增加忽略规则。
- [ ] 任一阶段发现与规格冲突时停止该阶段，先更新规格和计划并重新取得确认，不以兼容分支掩盖冲突。

## 任务 1：建立依赖安全前置门禁

**文件：**

- 修改：`package.json`
- 修改：`package-lock.json`
- 验证：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] **步骤 1：记录修复前审计与实际依赖树**

运行：

```bash
npm audit --json > /tmp/higoods-cutting-location-audit-before.json
npm ls vite postcss tsx esbuild picomatch --all
```

预期：审计非零退出，报告现有 1 项低危、3 项高危；依赖树包含 `vite@6.4.1`、`postcss@8.5.8`、`tsx@4.21.0`、`esbuild@0.27.7`、`picomatch@4.0.3`。若实际结果变化，先把新增漏洞和兼容修复版本补进规格与本计划。

- [ ] **步骤 2：在当前主版本内升级直接依赖并刷新锁文件**

运行：

```bash
npm install --save-dev vite@^6.4.3 postcss@^8.5.25 tsx@^4.23.1
```

预期：只修改 `package.json`、`package-lock.json` 和本地安装树；不新增 `esbuild`、`picomatch` 直接依赖，不跨入 Vite 7。

- [ ] **步骤 3：验证漏洞与实际解析版本**

运行：

```bash
npm audit --audit-level=low
npm ls vite postcss tsx esbuild picomatch --all
```

预期：审计为 0；`vite >= 6.4.3`、`postcss >= 8.5.25`、`tsx >= 4.23.1`、`esbuild >= 0.28.1`，并且 `picomatch >= 4.0.5`。

- [ ] **步骤 4：验证工具链没有被安全升级破坏**

运行：

```bash
npm run build
npm run check:cutting-warehouse-location-map
```

预期：构建和既有库位图专项检查均通过。

- [ ] **步骤 5：提交依赖安全修复**

```bash
git add package.json package-lock.json
git commit -m "fix(依赖): 修复现有构建工具安全漏洞"
```

## 任务 2：定义裁床层级库位结构和编号生成器

**文件：**

- 修改：`src/data/fcs/factory-internal-warehouse.ts`
- 新增：`src/data/fcs/cutting/warehouse-location-mock.ts`
- 修改：`scripts/check-factory-internal-warehouse-model.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] **步骤 1：先写结构与编号失败检查**

在两个检查脚本中增加以下断言：

```ts
assert.equal(buildCuttingWarehouseLocationNo('A', 2, 3, 2), 'A-R02-L03-P02')
assert.throws(() => buildCuttingWarehouseLocationNo('AA', 2, 3, 2))
assert.throws(() => buildCuttingWarehouseLocationNo('A', 0, 3, 2))
assert.equal(new Set(locationList.map((item) => item.no)).size, locationList.length)
assert(locationList.some((item) => item.levelNo === 1 && item.positionNo === 1))
```

并断言中央裁床的 `WAIT_PROCESS`、`WAIT_HANDOVER` 都含多个库区、多个货架、一层单库位、一层多库位和不同层数量不一致的演示数据。

运行：

```bash
npm run check:factory-internal-warehouse-model
npm run check:cutting-warehouse-location-map
```

预期：因结构字段和生成器尚不存在而失败。

- [ ] **步骤 2：兼容扩展共享仓库类型**

在 `factory-internal-warehouse.ts` 中给共享类型增加可选字段，避免要求其他工厂立刻迁移：

```ts
export interface FactoryWarehouseLocation {
  id: string
  no: string
  name: string
  levelNo?: number
  positionNo?: number
  status: FactoryWarehouseNodeStatus
  remark?: string
}

export interface FactoryWarehouseShelf {
  id: string
  no: string
  name: string
  shelfSequence?: number
  locationList: FactoryWarehouseLocation[]
  status: FactoryWarehouseNodeStatus
  remark?: string
}

export interface FactoryWarehouseArea {
  id: string
  code?: string
  name: string
  shelfList: FactoryWarehouseShelf[]
  status: FactoryWarehouseNodeStatus
  remark?: string
}
```

- [ ] **步骤 3：新增裁床专属纯函数和 Mock 构造器**

在新文件导出固定契约：

```ts
export function buildCuttingWarehouseLocationNo(
  areaCode: string,
  shelfSequence: number,
  levelNo: number,
  positionNo: number,
): string

export function buildCuttingWarehouseAreaList(
  kind: 'WAIT_PROCESS' | 'WAIT_HANDOVER',
): FactoryWarehouseArea[]
```

生成器必须校验：库区为单个大写字母；货架、层、位置为 1–99；统一补两位。Mock 使用稳定 ID，并按规格第 6 节生成两类仓库且相互隔离。

- [ ] **步骤 4：只把中央裁床切换到新 Mock**

在 `buildDefaultFactoryInternalWarehouses()` 的中央裁床映射中，令待加工仓和待交出仓调用 `buildCuttingWarehouseAreaList()`；其他工厂继续走原通用构造器。同步改写演示占用记录，使其引用新稳定库位 ID，不保留旧编号别名或迁移表。

- [ ] **步骤 5：运行数据专项检查**

```bash
npm run check:factory-internal-warehouse-model
npm run check:cutting-warehouse-location-map
```

预期：全部通过；待加工仓和待交出仓完整编号各自唯一。

- [ ] **步骤 6：提交结构与 Mock**

```bash
git add src/data/fcs/factory-internal-warehouse.ts src/data/fcs/cutting/warehouse-location-mock.ts scripts/check-factory-internal-warehouse-model.ts scripts/check-cutting-warehouse-location-map.ts
git commit -m "feat(裁床仓库): 建立层级库位编码与演示数据"
```

## 任务 3：重写库位布局快照和维护领域动作

**文件：**

- 重写：`src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] **步骤 1：补完整快照和维护动作失败检查**

检查脚本覆盖：创建库区不会隐式创建货架；同仓库库区编码唯一；同库区货架序号唯一；新增货架一次生成全部层位；调整单层只从最右端增减；占用库位不能减少、停用或改编号；编码变化保持稳定 ID；旧 schema 缓存被丢弃并恢复默认 Mock。

运行：

```bash
npm run check:cutting-warehouse-location-map
```

预期：旧 patch/override 存储模型不能满足断言而失败。

- [ ] **步骤 2：把本地存储改成 schema v3 完整快照**

使用以下核心结构：

```ts
export interface FactoryWarehouseLayoutSnapshot {
  schemaVersion: 3
  factoryId: string
  warehouseKind: CuttingWarehouseKind
  warehouseId: string
  layoutVersion: number
  areaList: FactoryWarehouseArea[]
  updatedAt: string
  updatedBy: string
}
```

读取到非 v3 数据时不迁移、不展示迁移提示，直接以当前仓库 Mock 建立 v3 快照。保留版本冲突检测和历史版本查看；删除 `areaOrder`、`shelfOrder`、`locationOrder`、`unassigned`、`overrides`、`addedAreaList`、`addedLocationListByShelfId` 的叠加逻辑。

- [ ] **步骤 3：实现不可变维护动作**

导出并统一使用以下纯函数：

```ts
createWarehouseArea(snapshot, input)
updateWarehouseArea(snapshot, input, occupiedLocationIds)
createWarehouseShelf(snapshot, input)
updateWarehouseShelf(snapshot, input, occupiedLocationIds)
updateWarehouseLocation(snapshot, input, occupiedLocationIds)
adjustWarehouseLevelPositionCount(snapshot, input, occupiedLocationIds)
setWarehouseLocationEnabled(snapshot, input, occupiedLocationIds)
revokeNewWarehouseNode(snapshot, input, referencedLocationIds)
```

所有返回值生成新快照并将 `layoutVersion + 1`。错误结果必须携带可直接展示的中文冲突原因和具体完整库位编号。

- [ ] **步骤 4：验证结构防错**

```bash
npm run check:cutting-warehouse-location-map
```

预期：重复、越界、断层、占用保护、稳定 ID、旧缓存失效断言全部通过。

- [ ] **步骤 5：提交布局存储重写**

```bash
git add src/pages/process-factory/cutting/warehouse-location-layout-store.ts scripts/check-cutting-warehouse-location-map.ts
git commit -m "refactor(裁床仓库): 重写层级库位布局快照"
```

## 任务 4：将投影模型改为分层展示和自由多选

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] **步骤 1：替换旧相邻选择断言**

删除“同一货架”“连续相邻”“只能从两端取消”“固定选位范围”的测试，新增：跨库区、跨货架、跨层可选；任意顺序取消；选取数量不设上限；停用、占用、外部仓库库位拒绝；提交前重新投影时自动剔除刚被占用的库位并返回冲突编号。

- [ ] **步骤 2：补充分层投影契约**

```ts
export interface StableWarehouseLocationRef {
  warehouseId: string
  warehouseKind: CuttingWarehouseKind
  areaId: string
  areaCode: string
  shelfId: string
  shelfSequence: number
  locationId: string
  locationNo: string
  levelNo: number
  positionNo: number
}

export interface WarehouseLocationMapLevel {
  levelNo: number
  locations: WarehouseLocationMapCell[]
}
```

`WarehouseLocationMapShelf` 改为持有 `levels`；层按降序、位置按升序输出。投影业务状态仍只有空闲、占用，节点启停仅决定是否可选。

- [ ] **步骤 3：简化选择规则**

`validateWarehouseLocationSelection()` 只校验：引用存在、属于当前仓库、节点启用、当前空闲。`toggleWarehouseLocationSelection()` 对任何已选项都允许直接取消，对合法空闲项追加，保持点击顺序，不再计算连续范围。

- [ ] **步骤 4：保护多库位占用数量口径**

同一占用对象可以产生多个格子的占用投影，但汇总数据按业务对象稳定 ID 去重；断言一个对象占三个库位仍只累计一次数量。

- [ ] **步骤 5：运行模型检查并提交**

```bash
npm run check:cutting-warehouse-location-map
git add src/pages/process-factory/cutting/warehouse-location-map-model.ts scripts/check-cutting-warehouse-location-map.ts
git commit -m "feat(裁床仓库): 支持分层投影与自由多选"
```

## 任务 5：重构共享库位图为货架分层矩阵

**文件：**

- 修改：`src/components/ui/warehouse-location-map.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] **步骤 1：先写 HTML 输出失败检查**

断言：`L04` 出现在 `L01` 前；同层 `P01` 在 `P02` 前；每格直接含完整编号；存在空闲/占用中文状态；不出现“连续”“相邻”“起止范围”；选中区逐项显示全部完整编号和已选数量；组件选项不再暴露 `selectionLimit`。

- [ ] **步骤 2：按层渲染货架**

将每个货架渲染为固定层标识列和可横向滚动的位置区。单格第一行输出 `Pxx · 空闲/占用`，第二行输出 `A-R02-L03-P02`。颜色不是唯一状态来源；占用格保留详情入口，停用格显示不可选原因但不新增业务占用状态。

- [ ] **步骤 3：重写选中摘要**

摘要只显示“已选 N 个库位”、逐项完整编号、“清空已选”；不显示连续范围。点击任一已选编号可取消该项，任何数量均不触发前端固定上限。

- [ ] **步骤 4：限制局部渲染范围**

库位点击、清空和占用详情只更新库位图容器或抽屉；图标 hydration 只扫描新插入节点，不调用整页 `root.innerHTML`。

- [ ] **步骤 5：验证并提交**

```bash
npm run check:cutting-warehouse-location-map
git add src/components/ui/warehouse-location-map.ts scripts/check-cutting-warehouse-location-map.ts
git commit -m "feat(裁床仓库): 展示货架分层库位矩阵"
```

## 任务 6：合并 PFOS 库位图维护入口与正式表单

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-location-map.ts`
- 复用：`src/components/ui/dialog.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`
- 修改：`tests/cutting-warehouse-location-map.spec.ts`

- [ ] **步骤 1：增加维护流程失败检查和 E2E 场景**

覆盖：普通视图只有“维护库位图”；进入维护后可新增空库区；在库区内新增货架；弹窗预览完整生成清单；各层可设置不同位置数；编辑库区/货架/库位显示原编号到新编号；占用节点相关结构控件禁用并说明原因；保存后只刷新当前库位图且页面滚动位置不丢失。

- [ ] **步骤 2：删除分散入口和浏览器原生输入框**

删除独立“新增库区”“新增库位”“编排库位图”和 `prompt()` 编辑路径，统一进入“维护库位图”。维护按钮只在 PFOS Web 出现。

- [ ] **步骤 3：使用 `renderFormDialog()` 实现维护弹窗**

分别实现清晰的局部函数：

```ts
renderCreateAreaDialog()
renderCreateShelfDialog()
renderEditAreaDialog()
renderEditShelfDialog()
renderEditLocationDialog()
renderLevelPositionEditor()
renderLocationNumberChangePreview()
```

新增库区只保存编码、名称、备注。新增货架填写货架序号、层数、默认每层数量，并允许在确认前逐层改数量；预览区列出所有将生成的完整编号。

- [ ] **步骤 4：实现局部事件处理和防错反馈**

表单输入不触发整页渲染；预览只更新弹窗预览容器。成功后重建当前仓库投影并局部替换维护区域；失败时保留输入值并显示具体冲突编号。使用 `performance.now()` 在 E2E 中测量正常 Mock 下按钮到 DOM 反馈小于 200 ms。

- [ ] **步骤 5：验证两种仓库维护**

```bash
npm run check:cutting-warehouse-location-map
npm run check:cutting-warehouse-location-map-e2e
```

预期：待加工仓、待交出仓均通过新增、预览、逐层调整、编辑、占用保护和局部刷新场景。

- [ ] **步骤 6：提交 PFOS 维护界面**

```bash
git add src/pages/process-factory/cutting/warehouse-location-map.ts scripts/check-cutting-warehouse-location-map.ts tests/cutting-warehouse-location-map.spec.ts
git commit -m "feat(裁床仓库): 统一库位图维护与批量生成"
```

## 任务 7：改造 Web 入仓选择和待交出运行时写回

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
- 修改：`scripts/check-web-cutting-transfer-bag-actions.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] **步骤 1：补 Web 多库位写回失败检查**

待加工仓和待交出仓都要断言可跨区、跨架、跨层选择多个库位；提交事件保存全部稳定 ID 和编号快照；运行时将全部位置投影为占用；同一物料或中转袋数量只累计一次；任何库位在提交前被占用时整次提交失败并列出冲突编号。

- [ ] **步骤 2：统一 Web 页面选择状态为数组**

把待加工仓已有数组状态保留并去除相邻文案；把待交出仓单个 `selectedLocationId` 改为 `selectedLocationIds: string[]`，删除 `selectionLimit: 1`。提交载荷统一保存：

```ts
warehouseLocations: StableWarehouseLocationRef[]
```

如旧页面摘要仍读取单个区位字段，只允许从数组第一项派生只读展示，不作为事实源。

- [ ] **步骤 3：改造待交出运行时事实**

`wait-handover-runtime.ts` 接收并保存完整 `warehouseLocations`。占用投影为每个位置各生成一个格子占用，但业务汇总使用中转袋/菲票稳定 ID 去重。出库或交出时一次释放该对象的全部位置。

- [ ] **步骤 4：运行 Web 和运行时检查**

```bash
npm run check:cutting-warehouse-location-map
npm run check:cutting-wait-handover-transfer-bag-flow
npm run check:web-cutting-transfer-bag-actions
```

- [ ] **步骤 5：提交 Web 选位链路**

```bash
git add src/pages/process-factory/cutting/warehouse-hub.ts src/pages/process-factory/cutting/wait-handover-runtime.ts scripts/check-cutting-wait-handover-transfer-bag-flow.ts scripts/check-web-cutting-transfer-bag-actions.ts scripts/check-cutting-warehouse-location-map.ts
git commit -m "feat(裁床仓库): 写回 Web 多库位入仓结果"
```

## 任务 8：改造 PDA 多库位选位与现场文案

**文件：**

- 修改：`src/pages/pda-warehouse-wait-process.ts`
- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`src/pages/pda-cutting-inbound-projection.ts`
- 修改：`src/pages/pda-cutting-handover-projection.ts`
- 修改：`scripts/check-pda-cutting-inbound-workflow.ts`
- 修改：`scripts/check-pda-cutting-transfer-bag-handover.ts`
- 修改：`scripts/check-cutting-special-craft-dispatch-return.ts`

- [ ] **步骤 1：先写 PDA 端失败检查**

覆盖：PDA 页面无维护按钮；待加工、待交出、特殊工艺回仓均可选多个空闲库位；选中区显示全部完整编号；无相邻/连续/上限文案；确认前二次校验；成功后全部库位占用；取消/出库释放全部位置。

- [ ] **步骤 2：统一 PDA 状态和事件载荷**

将单选状态统一为 `selectedLocationIds: string[]`，通过共享投影模型生成 `warehouseLocations: StableWarehouseLocationRef[]`。现场首屏只保留当前任务、对象、数量、已选库位和“确认入仓”主按钮，不展示结构字段、稳定 ID、投影等技术词。

- [ ] **步骤 3：保持 PDA 动作优先和局部响应**

点选格子只更新格子与已选摘要；再次点击任意已选格即可取消；扫码若命中启用空闲库位则追加，若命中占用/停用/其他仓库则给短中文提示；不触发整页重绘。

- [ ] **步骤 4：运行 PDA 与特殊工艺检查**

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npm run check:cutting-special-craft-dispatch-return
npm run check:cutting-warehouse-location-map
```

- [ ] **步骤 5：提交 PDA 选位链路**

```bash
git add src/pages/pda-warehouse-wait-process.ts src/pages/pda-cutting-inbound.ts src/pages/pda-cutting-handover.ts src/pages/pda-cutting-inbound-projection.ts src/pages/pda-cutting-handover-projection.ts scripts/check-pda-cutting-inbound-workflow.ts scripts/check-pda-cutting-transfer-bag-handover.ts scripts/check-cutting-special-craft-dispatch-return.ts
git commit -m "feat(裁床仓库): 支持 PDA 自由多库位入仓"
```

## 任务 9：更新治理记录并完成浏览器验收

**文件：**

- 修改：`docs/prototype-review-records/2026-07-30-cutting-warehouse-location-map.md`
- 修改：`docs/prototype-review-records/2026-07-31-cutting-warehouse-location-map-enhancement.md`
- 修改：`tests/cutting-warehouse-location-map.spec.ts`

- [ ] **步骤 1：删除审查记录中的过时结论**

把“旧库位迁移”“同货架连续选择”“待交出单库位上限”等结论改为 2026-08-01 已确认规则。记录必须明确：角色为 PFOS 主管/文员和 PDA 仓管；Web 可维护、PDA 只执行；状态只有空闲/占用；停用属于主数据可用性；Mock 直接重写；待加工和待交出数据隔离；依赖漏洞已修复。

- [ ] **步骤 2：补齐双分辨率浏览器验收**

Playwright 至少覆盖：

1. 1366×768 下待加工仓层位顺序、完整编号、占用详情、维护新增和跨区域多选。
2. 1366×768 下待交出仓多选入仓、全部占用和一次数量汇总。
3. 1280×720 下页面主体无横向溢出，宽货架只在自身容器滚动，主要按钮可见。
4. PDA 下无维护入口，可扫码/点选多个库位并逐项取消。
5. 正常 Mock 下弹窗、选位、保存反馈均小于 200 ms，且滚动位置不因轻交互复位。

- [ ] **步骤 3：运行专项 E2E 和设计治理**

```bash
npm run check:cutting-warehouse-location-map-e2e
npm run check:prototype-design-governance -- --all
npm run check:list-page-governance
```

预期：全部通过；审查记录不存在未说明例外。

- [ ] **步骤 4：提交治理和浏览器验收**

```bash
git add docs/prototype-review-records/2026-07-30-cutting-warehouse-location-map.md docs/prototype-review-records/2026-07-31-cutting-warehouse-location-map-enhancement.md tests/cutting-warehouse-location-map.spec.ts
git commit -m "test(裁床仓库): 完成层级库位浏览器验收"
```

## 任务 10：逐条对照规格并生成最终验证收据

**文件：**

- 核查：`docs/superpowers/specs/2026-08-01-cutting-warehouse-location-layer-coding-design.md`
- 核查：本计划列出的全部代码、脚本、测试与审查记录
- 生成：临时目录中的 `task-receipt.json`

- [ ] **步骤 1：逐条建立“规格条款—代码—测试”核查表**

逐项检查规格第 3–14 节，不接受“由构建间接覆盖”。至少确认：四层业务关系、完整编码、底层到高层编号/高层在上展示、逐层不同数量、维护动作、占用保护、自由无限多选、当前仓库校验、Web/PDA 边界、双仓隔离、多格占用一次汇总、局部刷新、双分辨率和依赖安全。

- [ ] **步骤 2：运行完整相关验证**

```bash
npm audit --audit-level=low
npm ls vite postcss tsx esbuild picomatch --all
npm run build
npm run check:factory-internal-warehouse-model
npm run check:cutting-warehouse-location-map
npm run check:cutting-warehouse-location-map-e2e
npm run check:cutting:all
npm run test:cutting:all:e2e
npm run check:prototype-design-governance -- --all
npm run check:list-page-governance
git diff --check
```

预期：全部为零退出；审计 0 漏洞；不存在未提交的意外文件或无关模块改动。

- [ ] **步骤 3：同步 CodeGraph 并确认无待同步文件**

```bash
codegraph sync
codegraph status
```

预期：索引健康，当前改动全部已同步。

- [ ] **步骤 4：在最后一次实质改动后生成机器可读收据**

```bash
receipt_dir="$(mktemp -d)"
npm run workflow:verify -- \
  --output "$receipt_dir/task-receipt.json" \
  --task-boundary "修复既有依赖漏洞，并实现裁床待加工仓与待交出仓的层级库位编码、维护、自由多选、Web/PDA 写回和浏览器验收"
```

预期：收据状态为 `verified`，绑定当前 Git HEAD、工作区差异指纹、相关检查结果和 CodeGraph 前后状态。若最后又修改任何实质文件，必须重新运行本步骤。

- [ ] **步骤 5：确认交付状态边界**

本地检查只能宣称 `verified`。只有用户另行授权推送且 GitHub API 确认提交存在、目标分支指向该版本后才可宣称 `delivered`；只有授权接受人明确接受该 SHA 后才可宣称 `accepted`。

## 规格覆盖索引

| 规格主题 | 实现任务 | 专项证据 |
| --- | --- | --- |
| 依赖安全与实际依赖树 | 任务 1、10 | `npm audit`、`npm ls`、构建 |
| 库区/货架/层位结构与编号 | 任务 2、3 | 工厂仓库模型检查、库位图检查 |
| Mock 重写与双仓隔离 | 任务 2 | 工厂仓库模型检查、投影断言 |
| 高层在上、位置从左到右 | 任务 4、5 | HTML 结构断言、Playwright |
| 新增库区/货架/批量预览/逐层调整 | 任务 3、6 | 维护动作单测、PFOS E2E |
| 正式编辑、停用与占用保护 | 任务 3、6 | 冲突断言、PFOS E2E |
| 无相邻规则、无固定上限、跨层级多选 | 任务 4、5、7、8 | 模型、Web、PDA 专项检查 |
| 全部位置写回与一次数量汇总 | 任务 4、7、8 | 运行时投影和流程检查 |
| Web 维护/PDA 执行边界 | 任务 6、8、9 | 页面检查、Playwright、审查记录 |
| 局部刷新、200 ms、分辨率适配 | 任务 5、6、8、9 | DOM/E2E 性能与视口断言 |
| 治理、完整回归、CodeGraph、收据 | 任务 9、10 | 治理检查、完整 E2E、workflow 收据 |
