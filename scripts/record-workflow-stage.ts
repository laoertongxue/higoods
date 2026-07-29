import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  appendStageEvent,
  providerEventTimestamp,
  type WorkflowStage,
  type WorkflowStageEvent,
} from './workflow-governance/stage-trace.ts'

function argument(args: string[], name: string, required = true): string {
  const index = args.indexOf(name)
  const value = index >= 0 ? args[index + 1] : ''
  if (required) assert(value, `${name} 不能为空`)
  return value
}

const args = process.argv.slice(2)
const path = resolve(argument(args, '--trace'))
const current = existsSync(path)
  ? JSON.parse(readFileSync(path, 'utf8')) as WorkflowStageEvent[]
  : []
const event: WorkflowStageEvent = {
  stage: argument(args, '--stage') as WorkflowStage,
  timestamp: new Date().toISOString(),
  summary: argument(args, '--summary'),
  evidenceRef: argument(args, '--evidence-ref'),
}
const skill = argument(args, '--skill', false)
const skillSource = argument(args, '--skill-source', false)
const artifact = argument(args, '--artifact', false)
if (skill) event.skill = skill
if (skillSource) event.skillSource = skillSource
if (skill) event.timestamp = providerEventTimestamp(event.evidenceRef)
if (artifact) event.artifact = artifact
const expectedRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const next = appendStageEvent(current, event, { expectedRevision })
mkdirSync(dirname(path), { recursive: true })
writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`)
console.log(JSON.stringify({ status: 'recorded', trace: path, eventCount: next.length }))
