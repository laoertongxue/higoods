import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const STAGE_OPTIONS = new Set(['--stage-trace', '--required-skills', '--require-two-stage-review'])

function methodPolicyLines(source: string): string[] {
  // A quoted example or commented-out policy is not active project permission.
  const lines = source.replace(/<!--[\s\S]*?(?:-->|$)/g, '').split(/\r?\n/)
  const policies: string[] = []
  let fence: { character: string; length: number } | undefined
  for (const line of lines) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker) {
      if (!fence) fence = { character: marker[0], length: marker.length }
      else if (marker[0] === fence.character && marker.length >= fence.length) fence = undefined
      continue
    }
    if (!fence && /^ {0,3}\*\*METHOD-01\b/.test(line)) policies.push(line)
  }
  return policies
}

/** A CLI guard only. Historical trace/receipt parsers remain available. */
export function assertWorkflowPolicyAllows(
  workspace: string,
  args: readonly string[],
  writesStageTrace = false,
): void {
  const requested = args.filter((arg) => STAGE_OPTIONS.has(arg.split('=')[0]))
  if (!writesStageTrace && requested.length === 0) return

  let descriptor: number | undefined
  let source: string
  try {
    descriptor = openSync(resolve(workspace, 'AGENTS.md'), constants.O_RDONLY | constants.O_NOFOLLOW)
    if (!fstatSync(descriptor).isFile()) throw new Error('AGENTS.md 不是常规文件')
    source = readFileSync(descriptor, 'utf8')
  } catch (cause) {
    throw new Error('无法确认根 AGENTS.md 的工作流策略；未执行阶段工作流或写入轨迹。', { cause })
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }

  const policy = methodPolicyLines(source)
  if (policy.length === 0) throw new Error('根 AGENTS.md 的 METHOD-01 缺失，未执行阶段工作流；历史 JSON 可独立只读解析。')
  if (policy.length > 1) throw new Error('根 AGENTS.md 的 METHOD-01 重复，未执行阶段工作流。')
  const heading = /^ {0,3}\*\*METHOD-01[：:][ \t]*(.*?)\*\*(?:[ \t].*)?$/.exec(policy[0])?.[1]
    ?.trim().replace(/[。.]$/, '')
  if (!heading) throw new Error('根 AGENTS.md 的 METHOD-01 格式无效，未执行阶段工作流。')
  if (/^Superpowers (?:项目级)?(?:默认禁用|已禁用|禁用)$/.test(heading)) {
    const operation = writesStageTrace ? 'record-workflow-stage 阶段轨迹写入' : requested.join('、')
    throw new Error(`AGENTS.md METHOD-01：本项目已禁用 Superpowers 阶段工作流，不允许 ${operation}。两轮实质审查使用任务审查记录；历史轨迹仍可只读解析。`)
  }
  if (!/^Superpowers (?:项目级)?(?:明确启用|已启用)$/.test(heading)) {
    throw new Error('根 AGENTS.md 的 METHOD-01 未声明唯一明确的启用策略，未执行阶段工作流。')
  }
}
