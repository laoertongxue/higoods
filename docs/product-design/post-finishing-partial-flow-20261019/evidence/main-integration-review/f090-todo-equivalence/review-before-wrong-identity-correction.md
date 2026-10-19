# F090顶栏计数首读与染色初始化等价控制

2026-10-20，20个全新隔离Node进程，固定时钟2026-10-20 08:00+08。10角色（undefined、8个已有ROLE角色、未知ROLE_UNKNOWN）分别执行count-first和whole-todos；每个组合独立进程，不先读fullTodos再冒称冷count。explicit listDyeWorkOrders只在before之后动态导入并调用。

实际全部相等，无新增/变化任务，dye22张。**边界：本次Node静态输入F090计数与todos两边均0，不是持久D10已填充header的运行证据，也不是性能证据；不能单独据此声称任意F090正待办场景可删染色初始化。** 完整actual、before/after、源码SHA与执行脚本/日志保留。
