export const webrtcHandler = (io, socket) => {

    // ─── Forward offer to room ────────────────────────────────────────────────
    socket.on('webrtc:offer', ({ roomId, offer, fromUserId }) => {
        console.log(`📞 WebRTC offer from ${socket.userEmail} in room ${roomId}`);
        socket.to(roomId).emit('webrtc:offer', {
            offer,
            fromUserId: socket.userId,
        });
    });

    // ─── Forward answer to room ───────────────────────────────────────────────
    socket.on('webrtc:answer', ({ roomId, answer, targetUserId }) => {
        console.log(`✅ WebRTC answer from ${socket.userEmail}`);
        socket.to(roomId).emit('webrtc:answer', { answer });
    });

    // ─── Forward ICE candidate to room ───────────────────────────────────────
    socket.on('webrtc:ice_candidate', ({ roomId, candidate }) => {
        socket.to(roomId).emit('webrtc:ice_candidate', { candidate });
    });

    // ─── Forward call end to room ─────────────────────────────────────────────
    socket.on('webrtc:call_end', ({ roomId }) => {
        console.log(`📵 Call ended by ${socket.userEmail}`);
        socket.to(roomId).emit('webrtc:call_end');
    });
};