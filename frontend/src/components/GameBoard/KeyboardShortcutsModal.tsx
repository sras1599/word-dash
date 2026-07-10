import { useEffect, useRef, useState } from 'react'
import { BookOpen, Keyboard, MousePointer2, Sparkles, X, type LucideIcon } from 'lucide-react'
import { createPortal } from 'react-dom'

type ShortcutCategory = {
    title: string
    icon: LucideIcon
    items: ShortcutItem[]
}

type ShortcutItem = {
    label: string
    keys: string[]
    hint?: string
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
    {
        title: 'Turn Actions',
        icon: Sparkles,
        items: [
            { label: 'Draw from deck', keys: ['Shift', 'D'] },
            { label: 'Draw from discard', keys: ['Shift', 'Alt', 'D'] },
            { label: 'Discard selected card', keys: ['Shift', 'D'], hint: 'Arrange phase only' },
            { label: 'Clear whole board', keys: ['Shift', 'Alt', 'Delete'] },
        ],
    },
    {
        title: 'Selection',
        icon: MousePointer2,
        items: [
            { label: 'Select hand', keys: ['Shift', 'H'] },
            { label: 'Select board', keys: ['Shift', 'B'] },
            { label: 'Select word row', keys: ['1-9'] },
            { label: 'Clear selection', keys: ['Esc'] },
        ],
    },
    {
        title: 'Board Editing',
        icon: BookOpen,
        items: [
            { label: 'Move between slots', keys: ['Arrow keys'] },
            { label: 'Place typed letter', keys: ['A-Z'] },
            { label: 'Move placed card', keys: ['Shift', 'Arrow Left/Right'] },
            { label: 'Remove card from slot', keys: ['Backspace'] },
            { label: 'Clear selected word', keys: ['Shift', 'Backspace'] },
        ],
    },
]

type KeyboardShortcutsModalProps = {
    titleId: string
    onClose: () => void
}

export function KeyboardShortcutsModal({ titleId, onClose }: KeyboardShortcutsModalProps) {
    const scrollBodyRef = useRef<HTMLDivElement>(null)
    const [scrollThumb, setScrollThumb] = useState({ height: 100, top: 0, isVisible: false })

    useEffect(() => {
        const scrollBody = scrollBodyRef.current
        if (!scrollBody) return

        const updateScrollThumb = () => {
            const { clientHeight, scrollHeight, scrollTop } = scrollBody
            const isVisible = scrollHeight > clientHeight + 1
            if (!isVisible) {
                setScrollThumb({ height: 100, top: 0, isVisible: false })
                return
            }

            const height = Math.max(16, (clientHeight / scrollHeight) * 100)
            const top = (scrollTop / (scrollHeight - clientHeight)) * (100 - height)
            setScrollThumb({ height, top, isVisible: true })
        }

        updateScrollThumb()
        scrollBody.addEventListener('scroll', updateScrollThumb, { passive: true })

        const resizeObserver = new ResizeObserver(updateScrollThumb)
        resizeObserver.observe(scrollBody)

        return () => {
            scrollBody.removeEventListener('scroll', updateScrollThumb)
            resizeObserver.disconnect()
        }
    }, [])

    return createPortal(
        <div className="game-board__shortcuts-backdrop" onMouseDown={onClose}>
            <div
                className="game-board__shortcuts-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="game-board__shortcuts-header">
                    <div className="game-board__shortcuts-header-copy">
                        <span className="game-board__shortcuts-icon" aria-hidden="true">
                            <Keyboard />
                        </span>
                        <div>
                            <p className="game-board__shortcuts-eyebrow">Game shortcuts</p>
                            <h2 id={titleId}>Keyboard shortcuts</h2>
                        </div>
                    </div>

                    <button
                        className="game-board__shortcuts-close"
                        type="button"
                        onClick={onClose}
                        aria-label="Close keyboard shortcuts"
                    >
                        <X aria-hidden="true" />
                    </button>
                </header>

                <div className="game-board__shortcuts-scroll-shell">
                    <div className="game-board__shortcuts-scroll-body" ref={scrollBodyRef}>
                        <div className="game-board__shortcuts-category-list">
                            {SHORTCUT_CATEGORIES.map((category) => (
                                <section className="game-board__shortcuts-category" key={category.title}>
                                    <div className="game-board__shortcuts-category-heading">
                                        <category.icon aria-hidden="true" />
                                        <h3>{category.title}</h3>
                                    </div>

                                    <div className="game-board__shortcuts-items">
                                        {category.items.map((item) => (
                                            <article className="game-board__shortcuts-row" key={`${category.title}-${item.label}`}>
                                                <div className="game-board__shortcuts-row-copy">
                                                    <p>{item.label}</p>
                                                    {item.hint && <small>{item.hint}</small>}
                                                </div>
                                                <KeySequence keys={item.keys} />
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </div>

                    {scrollThumb.isVisible && (
                        <div className="game-board__shortcuts-scrollbar" aria-hidden="true">
                            <div
                                className="game-board__shortcuts-scrollbar-thumb"
                                style={{
                                    height: `${scrollThumb.height}%`,
                                    top: `${scrollThumb.top}%`,
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    )
}

function KeySequence({ keys }: { keys: string[] }) {
    return (
        <span className="game-board__shortcut-keys" aria-label={keys.join(' plus ')}>
            {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
            ))}
        </span>
    )
}
