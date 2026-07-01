import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../lib/api'
import { useCreateRoomMutation, useJoinRoomMutation } from '../../../lib/roomQueries'
import { type CreateRoomFormValues, createRoomSchema, type JoinRoomFormValues, joinRoomSchema } from '../../../lib/schemas'
import { session } from '../../../lib/session'

export type HomePanel = 'create' | 'join' | null

export function useHomeActions() {
    const navigate = useNavigate()
    const createRoomMutation = useCreateRoomMutation()
    const joinRoomMutation = useJoinRoomMutation()
    const [panel, setPanel] = useState<HomePanel>(null)

    const createForm = useForm<CreateRoomFormValues>({
        resolver: zodResolver(createRoomSchema),
        defaultValues: { name: '' },
    })

    const joinForm = useForm<JoinRoomFormValues>({
        resolver: zodResolver(joinRoomSchema),
        defaultValues: { name: '', roomCode: '' },
    })

    function openPanel(next: HomePanel) {
        setPanel(next)
        createRoomMutation.reset()
        joinRoomMutation.reset()
        createForm.reset()
        joinForm.reset()
    }

    const handleCreateSubmit = createForm.handleSubmit(async ({ name }) => {
        createRoomMutation.reset()
        try {
            const { roomCode, playerId } = await createRoomMutation.mutateAsync({ name: name.trim() })
            session.setPlayerId(playerId)
            session.setRoomCode(roomCode)
            navigate(`/lobby/${roomCode}`)
        } catch {
            createForm.setError('root', {
                message: 'Unable to create room. Please try again',
            })
        }
    })

    const handleJoinSubmit = joinForm.handleSubmit(async ({ name, roomCode }) => {
        joinRoomMutation.reset()
        try {
            const { roomCode: rc, playerId } = await joinRoomMutation.mutateAsync({
                roomCode: roomCode.trim().toUpperCase(),
                name: name.trim(),
            })
            session.setPlayerId(playerId)
            session.setRoomCode(rc)
            navigate(`/lobby/${rc}`)
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                joinForm.setError('name', { message: 'That name is already taken in this room.' })
            } else {
                joinForm.setError('roomCode', { message: 'Invalid room code. Please try again.' })
            }
        }
    })

    const joinRoomCodeInputProps = joinForm.register('roomCode', {
        onChange: (event) => {
            const target = event.target as HTMLInputElement
            target.value = target.value.toUpperCase()
        },
    })

    return {
        panel,
        createForm: {
            nameInputProps: createForm.register('name'),
            nameError: createForm.formState.errors.name?.message ?? '',
            submitError: createForm.formState.errors.root?.message ?? '',
            isLoading: createRoomMutation.isPending,
        },
        joinForm: {
            nameInputProps: joinForm.register('name'),
            roomCodeInputProps: joinRoomCodeInputProps,
            nameError: joinForm.formState.errors.name?.message ?? '',
            roomCodeError: joinForm.formState.errors.roomCode?.message ?? '',
            isLoading: joinRoomMutation.isPending,
        },
        openPanel,
        handleCreateSubmit,
        handleJoinSubmit,
    }
}
