import {createClient} from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({url: redisUrl});
redisClient.on('error', err => console.log('Redis Client Error', err));

// Dedicated client for blocking reads (xReadGroup BLOCK 0).
// Blocking commands must not share a connection with writes — writes queue
// behind pending BLOCK 0 responses on the same socket, causing a deadlock
// when the worker tries to push a retry job via the same client.
export const redisReaderClient = createClient({url: redisUrl});
redisReaderClient.on('error', err => console.log('Redis Reader Client Error', err));

export async function connectRedis() {
    await redisClient.connect();
    await redisReaderClient.connect();
    console.log('Redis connected');
}
