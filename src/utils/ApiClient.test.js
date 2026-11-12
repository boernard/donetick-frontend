import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logout, RefreshToken } from './Fetcher'
import { isOAuthExchangeInProgress } from './OAuthExchangeState'
import { isRefreshTokenExpired } from './TokenStorage'

vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn().mockResolvedValue({ value: null }) },
}))
vi.mock('../Config', () => ({ API_URL: 'http://api.test' }))
vi.mock('../hooks/NetworkManager', () => ({
  networkManager: { setServerUnreachable: vi.fn() },
}))
vi.mock('../service/DiagnosticsSession', () => ({
  recordApiFailure: vi.fn(),
  recordServerVersionFromResponse: vi.fn(),
}))
vi.mock('./Fetcher', () => ({ logout: vi.fn(), RefreshToken: vi.fn() }))
vi.mock('./OAuthExchangeState', () => ({
  isOAuthExchangeInProgress: vi.fn(() => false),
}))
vi.mock('./OfflineDB', () => ({ offlineDB: { clearAll: vi.fn() } }))
vi.mock('./TokenStorage', () => ({
  clearAllTokens: vi.fn(),
  isRefreshTokenExpired: vi.fn(async () => false),
  // Mirror the real storage contract: the access token lives in localStorage.
  saveTokens: vi.fn(async ({ accessToken }) =>
    localStorage.setItem('token', accessToken),
  ),
}))

const { apiClient } = await import('./ApiClient')

const respond = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})
const refreshOk = (token = 'new-token') =>
  respond(200, { token, refresh_token: 'r2' })
const authHeader = call => call[1].headers.Authorization

describe('ApiClient 401 recovery', () => {
  let fetchMock

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', 'old-token')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    Object.assign(apiClient, {
      initialized: true,
      isRefreshing: false,
      failedQueue: [],
      lastRefreshTime: 0,
      logoutPromise: null,
    })
    isRefreshTokenExpired.mockResolvedValue(false)
    isOAuthExchangeInProgress.mockReturnValue(false)
    RefreshToken.mockReset()
    // Real logout reaches into Capacitor, IndexedDB and window.location.
    vi.spyOn(apiClient, 'performLogout').mockResolvedValue()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes once and retries the request with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(200, { ok: true }))
    RefreshToken.mockResolvedValue(refreshOk())

    const response = await apiClient.get('/chores')

    expect(response.status).toBe(200)
    expect(RefreshToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(authHeader(fetchMock.mock.calls[0])).toBe('Bearer old-token')
    expect(authHeader(fetchMock.mock.calls[1])).toBe('Bearer new-token')
    expect(apiClient.failedQueue).toEqual([])
  })

  it('shares one refresh between concurrent 401s and retries them all', async () => {
    let finishRefresh
    RefreshToken.mockReturnValue(
      new Promise(resolve => {
        finishRefresh = () => resolve(refreshOk())
      }),
    )
    fetchMock.mockImplementation(async (url, config) =>
      config.headers.Authorization === 'Bearer new-token'
        ? respond(200, { url })
        : respond(401),
    )

    const requests = [
      apiClient.get('/a'),
      apiClient.get('/b'),
      apiClient.get('/c'),
    ]
    // Let every request hit its 401 and park behind the in-flight refresh.
    await vi.waitFor(() => expect(RefreshToken).toHaveBeenCalled())
    await vi.waitFor(() => expect(apiClient.failedQueue).toHaveLength(3))
    finishRefresh()

    const responses = await Promise.all(requests)
    expect(responses.map(r => r.status)).toEqual([200, 200, 200])
    expect(RefreshToken).toHaveBeenCalledTimes(1)
  })

  it('retries with the current token while the refresh cooldown is active', async () => {
    apiClient.lastRefreshTime = Date.now()
    localStorage.setItem('token', 'fresh-token')
    fetchMock
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(200))

    const response = await apiClient.get('/chores')

    expect(response.status).toBe(200)
    expect(RefreshToken).not.toHaveBeenCalled()
    expect(apiClient.performLogout).not.toHaveBeenCalled()
  })

  it('logs out and resolves null when the refresh call fails', async () => {
    fetchMock.mockResolvedValue(respond(401))
    RefreshToken.mockResolvedValue(respond(500))

    await expect(apiClient.get('/chores')).resolves.toBeNull()

    expect(apiClient.performLogout).toHaveBeenCalledTimes(1)
    expect(apiClient.failedQueue).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('logs out once without refreshing when the refresh token has expired', async () => {
    isRefreshTokenExpired.mockResolvedValue(true)
    fetchMock.mockResolvedValue(respond(401))

    await expect(apiClient.get('/chores')).resolves.toBeNull()

    expect(RefreshToken).not.toHaveBeenCalled()
    expect(apiClient.performLogout).toHaveBeenCalledTimes(1)
  })

  it('returns a 401 untouched when skipAuthRecovery is set', async () => {
    fetchMock.mockResolvedValue(respond(401))

    const response = await apiClient.get('/logout', { skipAuthRecovery: true })

    expect(response.status).toBe(401)
    expect(RefreshToken).not.toHaveBeenCalled()
    expect(apiClient.performLogout).not.toHaveBeenCalled()
  })

  it('does not refresh or log out while an OAuth exchange is running', async () => {
    isOAuthExchangeInProgress.mockReturnValue(true)
    fetchMock.mockResolvedValue(respond(401))

    const response = await apiClient.get('/me')

    expect(response.status).toBe(401)
    expect(RefreshToken).not.toHaveBeenCalled()
    expect(apiClient.performLogout).not.toHaveBeenCalled()
    expect(logout).not.toHaveBeenCalled()
  })
})
