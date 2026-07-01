import { describe, expect, it } from 'vitest'
import { createRoomSchema, customVariationSchema, joinRoomSchema, turnDurationSchema } from './schemas'

describe('form schemas', () => {
    it('validates create room input', () => {
        expect(createRoomSchema.safeParse({ name: '' }).success).toBe(false)
        expect(createRoomSchema.parse({ name: ' Ada ' })).toEqual({ name: 'Ada' })
    })

    it('validates and normalizes join room input', () => {
        expect(joinRoomSchema.safeParse({ name: '', roomCode: '' }).success).toBe(false)
        expect(joinRoomSchema.parse({ name: 'Grace', roomCode: 'abcd' })).toEqual({
            name: 'Grace',
            roomCode: 'ABCD',
        })
    })

    it('validates custom variations and turn duration fields', () => {
        expect(customVariationSchema.safeParse({ customInput: '4, 7' }).success).toBe(true)
        expect(customVariationSchema.safeParse({ customInput: '4' }).success).toBe(false)
        expect(turnDurationSchema.parse({ minutes: '1', seconds: '30' })).toBe(90)
    })
})
