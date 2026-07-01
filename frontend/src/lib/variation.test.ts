import { describe, expect, it } from 'vitest'
import { getPresetDisplayLabel, getVariationDifficulty, parseCustomVariation } from './variation'

describe('variation helpers', () => {
    it('parses comma-separated custom word lengths', () => {
        expect(parseCustomVariation('4, 7')).toEqual([4, 7])
        expect(parseCustomVariation(' 3,4,5 ')).toEqual([3, 4, 5])
    })

    it('rejects invalid custom variations', () => {
        expect(parseCustomVariation('4')).toBeNull()
        expect(parseCustomVariation('4, nope')).toBeNull()
        expect(parseCustomVariation('4, 0')).toBeNull()
    })

    it('maps presets to labels and difficulty tabs', () => {
        expect(getPresetDisplayLabel([3, 4, 5])).toBe('3, 4, 5 (Medium)')
        expect(getVariationDifficulty([3, 4, 5])).toBe('Medium')
        expect(getPresetDisplayLabel([4, 7])).toBe('4, 7 (Custom)')
        expect(getVariationDifficulty([4, 7])).toBe('Custom')
    })
})
