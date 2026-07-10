import { useEffect } from 'react'

const APP_TITLE = 'Word Dash'

export function formatDocumentTitle(title?: string | null) {
    return title ? `${title} | ${APP_TITLE}` : APP_TITLE
}

export function useDocumentTitle(title?: string | null) {
    useEffect(() => {
        document.title = formatDocumentTitle(title)
    }, [title])
}
