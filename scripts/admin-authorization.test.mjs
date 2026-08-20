import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasAdminRole,
  resolveAdminRouteAccess,
} from '../src/features/auth/authorization.ts'

const activeOwner = {
  user_id: 'test-user-id',
  display_name: 'Test Owner',
  role: 'owner',
  is_active: true,
}

test('waits for session and profile loading before redirecting', () => {
  assert.equal(
    resolveAdminRouteAccess({
      isLoading: true,
      isAuthenticated: false,
      adminProfile: null,
    }),
    'loading',
  )
})

test('redirects an unauthenticated visitor', () => {
  assert.equal(
    resolveAdminRouteAccess({
      isLoading: false,
      isAuthenticated: false,
      adminProfile: null,
    }),
    'unauthenticated',
  )
})

test('denies an authenticated user without an admin profile', () => {
  assert.equal(
    resolveAdminRouteAccess({
      isLoading: false,
      isAuthenticated: true,
      adminProfile: null,
    }),
    'unauthorized',
  )
})

test('denies an inactive administrator', () => {
  assert.equal(
    resolveAdminRouteAccess({
      isLoading: false,
      isAuthenticated: true,
      adminProfile: { ...activeOwner, is_active: false },
    }),
    'inactive',
  )
})

test('allows active owner, manager, and staff profiles', () => {
  for (const role of ['owner', 'manager', 'staff']) {
    const profile = { ...activeOwner, role }
    assert.equal(
      resolveAdminRouteAccess({
        isLoading: false,
        isAuthenticated: true,
        adminProfile: profile,
      }),
      'authorized',
    )
  }
})

test('checks allowed roles without trusting an inactive profile', () => {
  assert.equal(hasAdminRole(activeOwner, ['owner']), true)
  assert.equal(
    hasAdminRole({ ...activeOwner, is_active: false }, ['owner']),
    false,
  )
})
