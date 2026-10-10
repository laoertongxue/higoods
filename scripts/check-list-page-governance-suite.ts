import { resolveGovernanceScope, reportGovernanceScope } from './workflow-governance/governance-scope.ts'
import { checkPrototypeGovernance } from './check-prototype-design-governance.ts'
import { checkListPageGovernanceScope } from './check-list-page-governance.ts'

const args = process.argv.slice(2)
const scope = resolveGovernanceScope(args)
reportGovernanceScope(scope)
checkListPageGovernanceScope(scope)
checkPrototypeGovernance(scope)
