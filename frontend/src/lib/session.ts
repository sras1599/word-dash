const PLAYER_ID_KEY = 'wordit_playerId';
const ROOM_CODE_KEY = 'wordit_roomCode';

export const session = {
    setPlayerId: (id: string) => sessionStorage.setItem(PLAYER_ID_KEY, id),
    getPlayerId: () => sessionStorage.getItem(PLAYER_ID_KEY),
    setRoomCode: (code: string) => sessionStorage.setItem(ROOM_CODE_KEY, code),
    getRoomCode: () => sessionStorage.getItem(ROOM_CODE_KEY),
    clear: () => {
        sessionStorage.removeItem(PLAYER_ID_KEY);
        sessionStorage.removeItem(ROOM_CODE_KEY);
    },
};
