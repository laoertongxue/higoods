#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const repoRoot = process.cwd()
const appShellConfigPath = path.join(repoRoot, 'src/data/app-shell-config.ts')
const routeModulePaths = [
  path.join(repoRoot, 'src/router/routes-fcs.ts'),
  path.join(repoRoot, 'src/router/routes-pcs.ts'),
  path.join(repoRoot, 'src/router/routes-pda.ts'),
]

const DEFAULT_SYSTEMS = ['fcs', 'pfos', 'pcs']
const EXACT_ROUTE_SYSTEMS = new Set(['fcs', 'pfos', 'pcs'])
const PFOS_ROUTE_PREFIXES = ['/fcs/craft', '/fcs/process-factory/special-craft']

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

async function loadModule(filePath) {
  try {
    return await import(pathToFileURL(filePath).href)
  } catch (error) {
    console.error(`[check-menu-routes] 无法加载模块: ${filePath}`)
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

function getSystemIdFromPath(routePath) {
  if (PFOS_ROUTE_PREFIXES.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`))) {
    return 'pfos'
  }
  const segments = routePath.split('/').filter(Boolean)
  return segments[0] ?? ''
}

function shouldIncludeRoute(routePath, systems) {
  if (systems.length === 0) return true
  const systemId = getSystemIdFromPath(routePath)
  return systems.includes(systemId)
}

function requiresExactRouteCoverage(routePath) {
  return EXACT_ROUTE_SYSTEMS.has(getSystemIdFromPath(routePath))
}

function flattenMenuItems(groups) {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => [item, ...(item.children ?? [])]),
  )
}

function collectMenuHrefs(menusBySystem, systems) {
  const hrefs = Object.values(menusBySystem)
    .flatMap((groups) => flattenMenuItems(groups))
    .map((item) => item.href)
    .filter((href) => typeof href === 'string' && shouldIncludeRoute(href, systems))

  const uniqueHrefs = [...new Set(hrefs)]
  return { hrefs, uniqueHrefs }
}

function collectRegisteredMenuPaths(routeModules) {
  return new Set(
    routeModules
      .flatMap((module) => {
        const registry = module.routes
        if (!registry?.exactRoutes) return []
        return Object.keys(registry.exactRoutes)
      }),
  )
}

function formatList(lines) {
  if (lines.length === 0) return '  (none)'
  return lines.map((line) => `  - ${line}`).join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!fs.existsSync(appShellConfigPath)) {
    console.error('[check-menu-routes] 未找到菜单配置文件')
    process.exit(1)
  }

  const [{ menusBySystem }, ...routeModules] = await Promise.all([
    loadModule(appShellConfigPath),
    ...routeModulePaths.filter((filePath) => fs.existsSync(filePath)).map((filePath) => loadModule(filePath)),
  ])

  const { hrefs, uniqueHrefs } = collectMenuHrefs(menusBySystem, options.systems)
  const registeredMenuPaths = collectRegisteredMenuPaths(routeModules)

  const duplicates = [...new Set(hrefs.filter((href, index) => hrefs.indexOf(href) !== index))].sort()
  const uncovered = uniqueHrefs
    .filter((href) => requiresExactRouteCoverage(href) && !registeredMenuPaths.has(href))
    .sort()

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

await main()
