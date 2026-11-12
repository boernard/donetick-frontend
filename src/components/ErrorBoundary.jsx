import { Component } from 'react'
import { withTranslation } from 'react-i18next'

import { captureException } from '../analytics'

// Last-resort boundary around the whole app. Router-level render errors are
// handled by src/views/Error.jsx; this catches what escapes it (providers,
// the app shell, lazy chunk failures). It must not depend on Joy, the theme or
// any context, since any of those may be what crashed. Styles reuse the
// startup screen's CSS variables from index.html.
class ErrorBoundaryView extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info?.componentStack)
    try {
      captureException(error)
    } catch {
      // Reporting must never throw inside the boundary itself.
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    const { t } = this.props
    return (
      <div className='startup-screen' role='alert'>
        <div className='startup-screen__content'>
          <div className='startup-screen__name'>{t('appCrash.title')}</div>
          <div className='startup-screen__caption'>
            {t('appCrash.description')}
          </div>
          <button
            type='button'
            onClick={() => window.location.reload()}
            style={{
              marginBlockStart: 24,
              minBlockSize: 44,
              minInlineSize: 44,
              paddingInline: 24,
              border: 0,
              borderRadius: 12,
              background: 'var(--startup-accent)',
              color: 'var(--startup-bg)',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('appCrash.reload')}
          </button>
        </div>
      </div>
    )
  }
}

const ErrorBoundary = withTranslation('common', { useSuspense: false })(
  ErrorBoundaryView,
)

export default ErrorBoundary
