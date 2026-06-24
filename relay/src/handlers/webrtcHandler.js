export const webrtcHandler = (io, socket) => {

    socket.on('webrtc:offer', ({ roomId, offer, fromUserId }) => {
        console.log(`📞 WebRTC offer from ${socket.userEmail} in room ${roomId}`);
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        console.log(`Room ${roomId} has ${roomSockets?.size || 0} sockets`);
        socket.to(roomId).emit('webrtc:offer', {
            offer,
            fromUserId: socket.userId,
        });
    });

    socket.on('webrtc:answer', ({ roomId, answer, targetUserId }) => {
        console.log(`✅ WebRTC answer from ${socket.userEmail}`);
        socket.to(roomId).emit('webrtc:answer', { answer });
    });

    socket.on('webrtc:ice_candidate', ({ roomId, candidate }) => {
        socket.to(roomId).emit('webrtc:ice_candidate', { candidate });
    });

    socket.on('webrtc:call_end', ({ roomId }) => {
        console.log(`📵 Call ended by ${socket.userEmail}`);
        socket.to(roomId).emit('webrtc:call_end');
    });
};