import { getWorkingTreeChangedPaths } from './workflow-governance/changed-paths.ts'
import { routeAffectedChecks } from './workflow-governance/affected-checks.ts'

function readPathsArgument(args: string[]): string[] | null {
  const index = args.indexOf('--paths')
  if (index < 0) return null
  const value = args[index + 1]
  if (!value) throw new Error('--paths 需要逗号分隔的文件路径')
  return value.split(',').map((path) => path.trim()).filter(Boolean)
}

const args = process.argv.slice(2)
const paths = readPathsArgument(args) ?? getWorkingTreeChangedPaths()
console.log(JSON.stringify(routeAffectedChecks(paths), null, 2))
