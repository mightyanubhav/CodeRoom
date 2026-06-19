import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL, {
    tls: {},
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
    }
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

// ─── Room State ───────────────────────────────────────────────────────────────

export const setRoomState = async (roomId, state) => {
    await redis.set(
        `room:${roomId}`,
        JSON.stringify(state),
        'EX', 3600
    );
};

export const getRoomState = async (roomId) => {
    const data = await redis.get(`room:${roomId}`);
    return data ? JSON.parse(data) : null;
};

export const deleteRoomState = async (roomId) => {
    await redis.del(`room:${roomId}`);
};

// ─── Participant Tracking ─────────────────────────────────────────────────────

export const addParticipant = async (roomId, userId, socketId) => {
    await redis.hset(`participants:${roomId}`, userId, socketId);
    await redis.expire(`participants:${roomId}`, 3600);
};

export const removeParticipant = async (roomId, userId) => {
    await redis.hdel(`participants:${roomId}`, userId);
};

export const getParticipants = async (roomId) => {
    return await redis.hgetall(`participants:${roomId}`) || {};
};

export const getParticipantCount = async (roomId) => {
    const participants = await getParticipants(roomId);
    return Object.keys(participants).length;
};

// ─── Pub/Sub ──────────────────────────────────────────────────────────────────

const publisher = new Redis(process.env.REDIS_URL, { tls: {} });
const subscriber = new Redis(process.env.REDIS_URL, { tls: {} });

export const publishToRoom = async (roomId, event, data) => {
    await publisher.publish(
        `room:${roomId}`,
        JSON.stringify({ event, data })
    );
};

export const subscribeToRoom = async (roomId, callback) => {
    await subscriber.subscribe(`room:${roomId}`);
    subscriber.on('message', (channel, message) => {
        if (channel === `room:${roomId}`) {
            const { event, data } = JSON.parse(message);
            callback(event, data);
        }
    });
};

export const unsubscribeFromRoom = async (roomId) => {
    await subscriber.unsubscribe(`room:${roomId}`);
};

export default redis;