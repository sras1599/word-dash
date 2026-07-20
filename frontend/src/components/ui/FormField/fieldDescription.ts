export function getFormFieldDescription(id: string, hasHint?: boolean, hasError?: boolean) {
    if (hasError) {
        return `${id}-error`
    }

    if (hasHint) {
        return `${id}-hint`
    }

    return undefined
}
