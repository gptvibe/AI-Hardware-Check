import { useEffect, useState } from 'react'
import { AppHeader, useAppController } from './components'
import { readReportFromHash } from './domain'
import { HardwareOverviewSection } from './features/hardware'
import { CompareTray, ModelCardsSection, ModelDetailPanel, ModelLibrarySection } from './features/model-library'
import { ReportView } from './features/reports'
import { GuidedSetupSection } from './features/recommendations'

function App() {
  const controller = useAppController()
  const showAdvancedLibrary = controller.experienceMode === 'advanced'
  const [sharedReport, setSharedReport] = useState(() =>
    typeof window === 'undefined' ? null : readReportFromHash(window.location.hash),
  )

  useEffect(() => {
    const syncFromHash = () => {
      setSharedReport(readReportFromHash(window.location.hash))
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)

    return () => {
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [])

  if (sharedReport) {
    return (
      <div className="app-shell">
        <div className="app-container mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
          <ReportView
            report={sharedReport}
            onBack={() => {
              window.location.hash = ''
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-container mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
        <AppHeader controller={controller} />

        <main className={`mt-10 ${showAdvancedLibrary ? 'grid gap-8' : 'space-y-8'}`}>
          <div className="space-y-8">
            <GuidedSetupSection controller={controller} />
            <CompareTray controller={controller} />
            {showAdvancedLibrary ? (
              <>
                <div className="top-dual reveal delay-1">
                  <ModelLibrarySection controller={controller} />
                </div>
                <ModelCardsSection controller={controller} />
              </>
            ) : null}
          </div>

          {showAdvancedLibrary ? <ModelDetailPanel controller={controller} /> : null}
        </main>

        <HardwareOverviewSection controller={controller} />
      </div>
    </div>
  )
}

export default App
