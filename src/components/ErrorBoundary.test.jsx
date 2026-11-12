import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ErrorBoundary from './ErrorBoundary'

const captureException = vi.fn()
vi.mock('../analytics', () => ({
  captureException: (...args) => captureException(...args),
}))
vi.mock('react-i18next', () => ({
  withTranslation: () => Component => {
    const Wrapped = props => <Component {...props} t={key => key} />
    return Wrapped
  },
}))

const Boom = () => {
  throw new Error('render failed')
}

describe('ErrorBoundary', () => {
  let container
  let root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    root = createRoot(container)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    act(() => root.unmount())
    captureException.mockClear()
  })

  it('renders children when nothing throws', () => {
    act(() => root.render(<ErrorBoundary>fine</ErrorBoundary>))
    expect(container.textContent).toBe('fine')
  })

  it('shows a reload fallback and reports the error when a child throws', () => {
    act(() =>
      root.render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      ),
    )
    expect(container.querySelector('[role=alert]')).not.toBeNull()
    expect(container.textContent).toContain('appCrash.title')
    expect(container.querySelector('button').textContent).toBe(
      'appCrash.reload',
    )
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0][0].message).toBe('render failed')
  })
})
