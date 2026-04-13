export type ProjectManagementAcceptanceTask =
  | { kind: 'npm-script'; label: string; command: string }
  | { kind: 'node-spec'; label: string; file: string }

export const PCS_PROJECT_MANAGEMENT_READINESS_TASKS: ProjectManagementAcceptanceTask[] = [
  { kind: 'npm-script', label: '工作项库只读化检查', command: 'check:pcs-work-item-library-readonly' },
  { kind: 'npm-script', label: '工作项库元数据检查', command: 'check:pcs-work-item-library-meta' },
  { kind: 'npm-script', label: '商品项目领域契约检查', command: 'check:pcs-project-domain-contract' },
  { kind: 'npm-script', label: '模板与项目入口契约检查', command: 'check:pcs-template-project-entry-contract' },
  { kind: 'npm-script', label: '节点默认布局检查', command: 'check:pcs-project-node-default-layout' },
  { kind: 'npm-script', label: '技术包关系检查', command: 'check:pcs-technical-version-relations' },
  { kind: 'npm-script', label: '逐节点覆盖检查', command: 'check:pcs-project-node-instance-coverage' },
  { kind: 'npm-script', label: 'inline record 正式来源检查', command: 'check:pcs-project-inline-node-record-source' },
  { kind: 'npm-script', label: '默认业务视图可见性检查', command: 'check:pcs-project-node-record-visibility' },
  { kind: 'npm-script', label: '演示链路覆盖检查', command: 'check:pcs-project-demo-instance-coverage' },
  { kind: 'npm-script', label: '商品项目正式闭环检查', command: 'check:pcs-project-formal-closure' },
  { kind: 'npm-script', label: '测款分支检查', command: 'check:pcs-project-testing-branches' },
  {
    kind: 'node-spec',
    label: 'inline record 仓储 spec',
    file: 'tests/pcs-project-inline-node-record-repository.spec.ts',
  },
  {
    kind: 'node-spec',
    label: '早期 inline bootstrap spec',
    file: 'tests/pcs-project-inline-bootstrap-early-phase.spec.ts',
  },
  {
    kind: 'node-spec',
    label: '测款汇总与结论 bootstrap spec',
    file: 'tests/pcs-project-inline-bootstrap-testing-branches.spec.ts',
  },
  {
    kind: 'node-spec',
    label: '样衣收尾 bootstrap spec',
    file: 'tests/pcs-project-inline-bootstrap-sample-closeout.spec.ts',
  },
  {
    kind: 'node-spec',
    label: '逐节点覆盖计划 spec',
    file: 'tests/pcs-project-node-min-coverage-plan.spec.ts',
  },
]

export const PCS_PROJECT_MANAGEMENT_BROWSER_SMOKE_TASKS: ProjectManagementAcceptanceTask[] = [
  {
    kind: 'npm-script',
    label: '商品项目管理页面浏览器回归',
    command: 'test:pcs-project-management-regression:e2e',
  },
]

export const PCS_PROJECT_MANAGEMENT_FULL_ACCEPTANCE_TASKS: ProjectManagementAcceptanceTask[] = [
  ...PCS_PROJECT_MANAGEMENT_READINESS_TASKS,
  ...PCS_PROJECT_MANAGEMENT_BROWSER_SMOKE_TASKS,
]
