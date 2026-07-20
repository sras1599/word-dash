import { BrandLogo } from '../../components/BrandLogo/BrandLogo'
import { PageShell, type FloatingLetter } from '../../components/PageShell/PageShell'
import { Button } from '../../components/ui'
import { cx } from '../../lib/cx'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { CreateGamePanel } from './components/CreateGamePanel'
import { JoinGamePanel } from './components/JoinGamePanel'
import { useHomeActions } from './hooks/useHomeActions'
import './Home.css'

const FLOATING_LETTERS: FloatingLetter[] = [
    { key: 'w', letter: 'W', className: 'page-home__floating-letter--w' },
    { key: 'a', letter: 'A', className: 'page-home__floating-letter--a' },
    { key: 'd', letter: 'D', className: 'page-home__floating-letter--d' },
    { key: 's', letter: 'S', className: 'page-home__floating-letter--s' },
    { key: 'h', letter: 'H', className: 'page-home__floating-letter--h' },
    { key: 'o', letter: 'O', className: 'page-home__floating-letter--o' },
    { key: 'r', letter: 'R', className: 'page-home__floating-letter--r' },
    { key: 'd2', letter: 'D', className: 'page-home__floating-letter--d2' },
    { key: 'a2', letter: 'A', className: 'page-home__floating-letter--a2' },
    { key: 's2', letter: 'S', className: 'page-home__floating-letter--s2' },
    { key: 'h2', letter: 'H', className: 'page-home__floating-letter--h2' },
]

export function Home() {
    useDocumentTitle('Home')

    const {
        panel,
        createForm,
        joinForm,
        openPanel,
        handleCreateSubmit,
        handleJoinSubmit,
    } = useHomeActions()

    return (
        <PageShell
            pageClassName="page-home"
            floatingBgClassName="page-home__floating-bg"
            floatingLetterClassName="page-home__floating-letter"
            floatingLetters={FLOATING_LETTERS}
            tileLetters
            animatedLetters
            renderLetter={(letter) => <span className="page-home__floating-letter-text">{letter}</span>}
        >
            <main className="wd-content-layer page-home__main">
                <section className="page-home__hero" aria-labelledby="page-home-title">
                    <div className="page-home__hero-title-wrap">
                        <span className="page-home__hero-orb page-home__hero-orb--primary" aria-hidden="true" />
                        <span className="page-home__hero-orb page-home__hero-orb--secondary" aria-hidden="true" />
                        <h1 className="page-home__hero-title" id="page-home-title">
                            <BrandLogo className="page-home__hero-logo" />
                        </h1>
                    </div>

                    <p className="page-home__hero-tagline">
                        Test your speed and vocabulary at the same time by building words as quickly as possible!
                    </p>

                    <div className="page-home__cta" role="group" aria-label="Game actions">
                        <Button
                            variant="primary"
                            size="lg"
                            className={cx(
                                'page-home__cta-btn',
                                'page-home__cta-btn--primary',
                                panel === 'create' && 'page-home__cta-btn--active',
                            )}
                            type="button"
                            onClick={() => openPanel(panel === 'create' ? null : 'create')}
                            aria-expanded={panel === 'create'}
                            aria-controls="page-home-create-panel"
                        >
                            Create Game
                        </Button>

                        <Button
                            variant="ghost"
                            size="lg"
                            className={cx(
                                'page-home__cta-btn',
                                'page-home__cta-btn--secondary',
                                panel === 'join' && 'page-home__cta-btn--active',
                            )}
                            type="button"
                            onClick={() => openPanel(panel === 'join' ? null : 'join')}
                            aria-expanded={panel === 'join'}
                            aria-controls="page-home-join-panel"
                        >
                            Join Game
                        </Button>
                    </div>

                    {panel === 'create' && (
                        <CreateGamePanel
                            nameError={createForm.nameError}
                            submitError={createForm.submitError}
                            isLoading={createForm.isLoading}
                            nameInputProps={createForm.nameInputProps}
                            onSubmit={handleCreateSubmit}
                        />
                    )}

                    {panel === 'join' && (
                        <JoinGamePanel
                            nameError={joinForm.nameError}
                            roomCodeError={joinForm.roomCodeError}
                            isLoading={joinForm.isLoading}
                            nameInputProps={joinForm.nameInputProps}
                            roomCodeInputProps={joinForm.roomCodeInputProps}
                            onSubmit={handleJoinSubmit}
                        />
                    )}
                </section>
            </main>
        </PageShell>
    )
}
