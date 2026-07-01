import { z } from 'zod'
import { parseCustomVariation } from './variation'
import { parseTurnDurationFields } from './turnTimer'

export const createRoomSchema = z.object({
    name: z.string().trim().min(1, 'Name is required.'),
})

export const joinRoomSchema = z.object({
    name: z.string().trim().min(1, 'Name is required.'),
    roomCode: z.string().trim().min(1, 'Room code is required.').transform((value) => value.toUpperCase()),
})

export const customVariationSchema = z.object({
    customInput: z.string().refine((value) => parseCustomVariation(value) !== null, {
        message: 'Enter at least 2 comma-separated numbers, e.g. 4,7',
    }),
})

export const turnDurationSchema = z.object({
    minutes: z.string(),
    seconds: z.string(),
}).transform(({ minutes, seconds }) => parseTurnDurationFields(minutes, seconds))

export type CreateRoomFormValues = z.input<typeof createRoomSchema>
export type JoinRoomFormValues = z.input<typeof joinRoomSchema>
export type CustomVariationFormValues = z.input<typeof customVariationSchema>
export type TurnDurationFormValues = z.input<typeof turnDurationSchema>
