#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const appShellConfigPath = path.join(repoRoot, 'src/data/app-shell-config.ts')
const routeSourcePaths = [
  path.join(repoRoot, 'src/router/routes.ts'),
  path.join(repoRoot, 'src/router/routes-fcs.ts'),
  path.join(repoRoot, 'src/router/routes-pcs.ts'),
  path.join(repoRoot, 'src/router/routes-pda.ts'),
]

const DEFAULT_SYSTEMS = ['fcs', 'pcs']

function parseArgs(argv) {
  const options = {
    systems: [...DEFAULT_SYSTEMS],
  }

  for (const arg of argv) {
    if (arg.startsWith('--systems=')) {
      const value = arg.slice('--systems='.length).trim()
      options.systems = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      continue
    }

    if (arg === '--all') {
      options.systems = []
    }
  }

  return options
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    console.error(`[check-menu-routes] 无法读取文件: ${filePath}`)
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

function getSystemIdFromPath(routePath) {
  const segments = routePath.split('/').filter(Boolean)
  return segments[0] ?? ''
}

function shouldIncludeRoute(routePath, systems) {
  if (systems.length === 0) return true
  const systemId = getSystemIdFromPath(routePath)
  return systems.includes(systemId)
}

function collectMenuHrefs(configSource, systems) {
  const hrefMatches = [...configSource.matchAll(/href:\s*'([^']+)'/g)]
  const hrefs = hrefMatches
    .map((match) => match[1])
    .filter((href) => shouldIncludeRoute(href, systems))

  const uniqueHrefs = [...new Set(hrefs)]
  return { hrefs, uniqueHrefs }
}

function collectRegisteredMenuPaths(routeSources) {
  const directMatches = routeSources.flatMap((source) => [...source.matchAll(/'([^']+)'\s*:\s*\(\)\s*=>/g)])
  const exactRouteBlockMatches = routeSources.flatMap((source) => {
    const blockMatch = source.match(/exactRoutes:\s*\{([\s\S]*?)\}\s*,\s*dynamicRoutes:/)
    if (!blockMatch) return []
    return [...blockMatch[1].matchAll(/'([^']+)'\s*:/g)]
  })

  return new Set([...directMatches, ...exactRouteBlockMatches].map((match) => match[1]))
}

function formatList(lines) {
  if (lines.length === 0) return '  (none)'
  return lines.map((line) => `  - ${line}`).join('\n')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const configSource = readFile(appShellConfigPath)
  const routeSources = routeSourcePaths
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => readFile(filePath))

  const { hrefs, uniqueHrefs } = collectMenuHrefs(configSource, options.systems)
  const registeredMenuPaths = collectRegisteredMenuPaths(routeSources)

  const duplicates = [...new Set(hrefs.filter((href, index) => hrefs.indexOf(href) !== index))].sort()
  const uncovered = uniqueHrefs.filter((href) => !registeredMenuPaths.has(href)).sort()

  const systemLabel = options.systems.length === 0 ? 'ALL' : options.systems.join(', ')

  console.log('[check-menu-routes] 菜单路由一致性检查')
  console.log(`  systems: ${systemLabel}`)
  console.log(`  menu href total: ${hrefs.length}`)
  console.log(`  menu href unique: ${uniqueHrefs.length}`)
  console.log(`  uncovered: ${uncovered.length}`)
  console.log(`  duplicates: ${duplicates.length}`)

  if (duplicates.length > 0) {
    console.log('\n[重复菜单 href]')
    console.log(formatList(duplicates))
  }

  if (uncovered.length > 0) {
    console.log('\n[菜单存在但无精确路由的 href]')
    console.log(formatList(uncovered))
    process.exit(1)
  }

  console.log('\n[check-menu-routes] PASS')
}

main()
