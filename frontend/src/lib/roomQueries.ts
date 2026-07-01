import { useMutation, useQuery } from '@tanstack/react-query'
import { createRoom, joinRoom, validateRoom } from './api'

export const roomKeys = {
    all: ['rooms'] as const,
    detail: (roomCode: string) => [...roomKeys.all, roomCode] as const,
}

export function useCreateRoomMutation() {
    return useMutation({
        mutationFn: ({ name }: { name: string }) => createRoom(name),
    })
}

export function useJoinRoomMutation() {
    return useMutation({
        mutationFn: ({ roomCode, name }: { roomCode: string; name: string }) => joinRoom(roomCode, name),
    })
}

export function useValidateRoomQuery(roomCode: string | undefined, enabled = true) {
    return useQuery({
        queryKey: roomKeys.detail(roomCode ?? ''),
        queryFn: () => validateRoom(roomCode ?? ''),
        enabled: enabled && !!roomCode,
        retry: false,
        refetchOnWindowFocus: false,
    })
}
