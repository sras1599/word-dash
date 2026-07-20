import { describe, expect, it } from 'vitest'
import { createClientActionId } from './useGameRoom'

describe('createClientActionId', () => {
    it('generates unique opaque ids for rapid board mutations', () => {
        const ids = Array.from({ length: 1_000 }, createClientActionId)
        expect(new Set(ids)).toHaveLength(ids.length)
        expect(ids.every((id) => id.length >= 32)).toBe(true)
    })
})
