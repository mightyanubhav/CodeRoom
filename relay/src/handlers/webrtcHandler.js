export const webrtcHandler = (io, socket) => {

    // Helper — find socket ID for a userId in a room
    const findSocketId = (roomId, targetUserId) => {
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (!roomSockets) return null;
        for (const socketId of roomSockets) {
            const s = io.sockets.sockets.get(socketId);
            if (s?.userId === targetUserId) return socketId;
        }
        return null;
    };

    socket.on("webrtc:start_call", ({ roomId }) => {
        console.log(`📞 ${socket.userEmail} started call in room ${roomId}`);

        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (roomSockets) {
            roomSockets.forEach((socketId) => {
                if (socketId !== socket.id) {
                    const targetSocket = io.sockets.sockets.get(socketId);
                    if (targetSocket) {
                        socket.emit("webrtc:peer_in_room", {
                            userId: targetSocket.userId,
                            email: targetSocket.userEmail,
                        });
                    }
                }
            });
        }

        socket.to(roomId).emit("webrtc:user_joined_call", {
            userId: socket.userId,
            email: socket.userEmail,
        });
    });

    socket.on("webrtc:offer", ({ roomId, offer, targetUserId }) => {
        console.log(`📞 Offer from ${socket.userEmail} → ${targetUserId}`);

        // Route offer to specific target socket
        const targetSocketId = findSocketId(roomId, targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:offer", {
                offer,
                fromUserId: socket.userId,
                fromEmail: socket.userEmail,
                targetUserId,
            });
        } else {
            // Fallback broadcast
            socket.to(roomId).emit("webrtc:offer", {
                offer,
                fromUserId: socket.userId,
                fromEmail: socket.userEmail,
                targetUserId,
            });
        }
    });

    socket.on("webrtc:answer", ({ roomId, answer, targetUserId }) => {
        console.log(`✅ Answer from ${socket.userEmail} → ${targetUserId}`);

        // Route answer to specific target ONLY — not broadcast
        const targetSocketId = findSocketId(roomId, targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:answer", {
                answer,
                fromUserId: socket.userId,
                targetUserId,
            });
        }
    });

    socket.on("webrtc:ice_candidate", ({ roomId, candidate, targetUserId }) => {
        // Route ICE to specific target ONLY
        const targetSocketId = findSocketId(roomId, targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtc:ice_candidate", {
                candidate,
                fromUserId: socket.userId,
                targetUserId,
            });
        } else {
            socket.to(roomId).emit("webrtc:ice_candidate", {
                candidate,
                fromUserId: socket.userId,
                targetUserId,
            });
        }
    });

    socket.on("webrtc:call_end", ({ roomId }) => {
        console.log(`📵 Call ended by ${socket.userEmail}`);
        socket.to(roomId).emit("webrtc:call_end", {
            fromUserId: socket.userId,
        });
    });
};