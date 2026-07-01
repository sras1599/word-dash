import type { Variation } from './gameTypes'

export type VariationPresetGroup = {
    difficulty: 'Easy' | 'Medium' | 'Hard'
    presets: { label: string; wordLengths: number[] }[]
}

export type VariationTab = VariationPresetGroup['difficulty'] | 'Custom'

export const VARIATION_PRESET_GROUPS: VariationPresetGroup[] = [
    {
        difficulty: 'Easy',
        presets: [
            { label: '4, 4, 4', wordLengths: [4, 4, 4] },
            { label: '4, 5', wordLengths: [4, 5] },
        ],
    },
    {
        difficulty: 'Medium',
        presets: [
            { label: '3, 4, 5', wordLengths: [3, 4, 5] },
            { label: '5, 6', wordLengths: [5, 6] },
        ],
    },
    {
        difficulty: 'Hard',
        presets: [{ label: '5, 6, 7, 8', wordLengths: [5, 6, 7, 8] }],
    },
]

export const VARIATION_TABS: VariationTab[] = ['Easy', 'Medium', 'Hard', 'Custom']

function getVariationKey(wordLengths: number[]): string {
    return JSON.stringify(wordLengths)
}

export function parseCustomVariation(input: string): number[] | null {
    const parts = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

    if (parts.length < 2) return null

    const lengths = parts.map((p) => parseInt(p, 10))
    if (lengths.some((n) => Number.isNaN(n) || n < 1)) return null

    return lengths
}

export function sanitizeCustomVariationInput(input: string): string {
    return input.replace(/[^0-9,\s]/g, '')
}

export function getPresetDisplayLabel(wordLengths: number[]): string {
    const key = getVariationKey(wordLengths)

    for (const group of VARIATION_PRESET_GROUPS) {
        for (const preset of group.presets) {
            if (getVariationKey(preset.wordLengths) === key) {
                return `${preset.label} (${group.difficulty})`
            }
        }
    }

    return `${wordLengths.join(', ')} (Custom)`
}

export function getVariationDifficulty(wordLengths: number[]): VariationTab {
    const key = getVariationKey(wordLengths)

    for (const group of VARIATION_PRESET_GROUPS) {
        for (const preset of group.presets) {
            if (getVariationKey(preset.wordLengths) === key) {
                return group.difficulty
            }
        }
    }

    return 'Custom'
}

export function areWordLengthsEqual(a: number[], b: number[]): boolean {
    return getVariationKey(a) === getVariationKey(b)
}

export function toVariation(wordLengths: number[]): Variation {
    return { wordLengths }
}
