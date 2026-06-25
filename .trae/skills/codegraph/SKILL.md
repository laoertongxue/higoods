---
name: codegraph
description: 语义级代码图谱——在执行代码核查、方案设计、代码修改、实现确认前，优先使用 CodeGraph 辅助定位上下文、符号关系、调用链和影响面
---

# CodeGraph

CodeGraph 为项目构建语义级代码图谱，索引所有函数、常量、类型、接口等符号及其调用关系。通过 `SearchCodebase` 工具（Trae 内置）或 CLI 命令，快速理解模块边界、符号关系和影响面。

## 核心原则

**在执行任何代码核查、方案设计、代码修改前，必须优先使用 CodeGraph 辅助定位上下文。** 中文文案、按钮、路由、状态展示仍需结合 `rg`（Grep）精查。

## 可用工具

### Trae 内置（优先使用）

| 方式 | 说明 |
|------|------|
| `SearchCodebase` | 语义搜索：输入自然语言描述，返回相关代码片段、调用关系。用于理解模块职责、查找相关符号 |

### CLI 命令（辅助使用）

| 命令 | 用途 |
|------|------|
| `codegraph status` | 查看索引状态（文件数、节点数、边数、是否最新） |
| `codegraph sync` | 手动同步索引（自动监听已默认开启） |
| `codegraph context` | 获取指定文件/符号的上下文信息 |
| `codegraph explore` | 探索代码结构，了解模块全貌 |
| `codegraph callers` | 查找指定符号的所有调用者 |
| `codegraph callees` | 查找指定符号调用的所有目标 |
| `codegraph impact` | 分析修改某个符号的影响范围 |

## 使用流程

1. **开始前**：
   - 运行 `codegraph status` 确认索引是最新状态
   - 如果状态显示有未同步文件，运行 `codegraph sync`

2. **核查或修改模块前**：
   - 用 `SearchCodebase` 查找相关模块、函数、类型
   - 用 `codegraph callers` / `codegraph callees` 理解调用关系
   - 用 `codegraph impact` 评估修改影响面

3. **完成代码修改后**：
   - 运行 `codegraph sync` 更新索引
   - 运行 `codegraph status` 确认同步完成
   - 在最终回复中说明索引同步状态

## 适用场景

| 场景 | 用什么 |
|------|--------|
| 理解某个模块不熟悉的业务逻辑 | `SearchCodebase` + `codegraph explore` |
| 修改函数前评估影响范围 | `codegraph impact` + `codegraph callers` |
| 查找某个功能实现在哪里 | `SearchCodebase` |
| 理解函数间的调用链 | `codegraph callers` / `codegraph callees` |
| 新接手一个模块需要快速了解 | `codegraph explore` + `codegraph context` |
| 重构前确认所有引用点 | `codegraph callers` + `codegraph impact` |

## 注意事项

- CodeGraph 擅长**代码结构、符号关系、调用链**，不擅长中文文案、UI 布局、路由页面内容
- 查询中文业务概念、页面文案、按钮文字、状态展示等，使用 `Grep`（rg）而非 CodeGraph
- 两者配合使用：CodeGraph 定位代码位置和关系 → Grep 精查页面文案和交互
- 索引自动监听文件变更，通常不需要手动 `codegraph sync`
