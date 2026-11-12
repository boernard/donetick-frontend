import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { transformSync } from '@swc/core'

// Compile a file under src/ to CommonJS and run it in a vm with an explicit
// import table, so source-level tests never pull in the real app graph.
export function loadSource(srcPath, modules) {
  const source = readFileSync(
    new URL(`../../src/${srcPath}`, import.meta.url),
    'utf8',
  )
  const { code } = transformSync(source, {
    jsc: {
      parser: { syntax: 'ecmascript', jsx: true },
      transform: { react: { runtime: 'automatic' } },
      target: 'es2022',
    },
    module: { type: 'commonjs' },
  })
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    require: name => {
      assert.ok(modules[name], `Unexpected import: ${name}`)
      return modules[name]
    },
  })
  return exports
}

// The real useChorePermissions hook (and the access rules behind it), wired to
// the caller's user/member/impersonation stubs.
export function loadChorePermissions({ impersonation, members, user }) {
  const projectAccess = loadSource('utils/ProjectAccess.js', {})
  const choreAccess = loadSource('utils/ChoreAccess.js', {
    './ProjectAccess': projectAccess,
  })
  return loadSource('hooks/useChorePermissions.js', {
    '../contexts/ImpersonateUserContext': { useImpersonateUser: impersonation },
    '../queries/UserQueries': {
      useUserProfile: user,
      useCircleMembers: members,
    },
    '../utils/ChoreAccess': choreAccess,
  })
}
