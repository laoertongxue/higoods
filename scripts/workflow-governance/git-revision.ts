import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  lstatSync,
  readFileSync,
  readlinkSync,
} from 'node:fs'
import { resolve } from 'node:path'
import type { GitRevision } from './task-receipt.ts'

export function revisionForPaths(
  paths: string[],
  options: { cwd?: string; head?: string } = {},
): GitRevision {
  const cwd = options.cwd ?? process.cwd()
  const head = options.head
    ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  const changedPaths = [...paths].sort()
  const hash = createHash('sha256')
  hash.update(head)
  for (const path of changedPaths) {
    const absolutePath = resolve(cwd, path)
    hash.update(`\0${path}\0`)
    let stat
    try {
      stat = lstatSync(absolutePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      hash.update('<deleted>')
      continue
    }
    hash.update(`mode:${stat.mode & 0o7777}\0`)
    if (stat.isSymbolicLink()) {
      hash.update(`symlink:${readlinkSync(absolutePath)}\0`)
    } else if (stat.isFile()) {
      hash.update('file:')
      hash.update(readFileSync(absolutePath))
    } else {
      hash.update(`kind:${stat.isDirectory() ? 'directory' : 'other'}`)
    }
  }
  return { head, diffHash: hash.digest('hex'), changedPaths }
}
