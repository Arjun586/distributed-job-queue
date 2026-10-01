import {redisClient, redisReaderClient} from "../../redis/src/client.js"

const STREAM_KEY = "job_stream";
const GROUP_NAME = "job_workers";
const DLQ_STREAM_KEY = "job_dlq";

// call once at startup — creates the consumer group
export async function ensureGroup() {
    try {
        await redisClient.xGroupCreate(STREAM_KEY, GROUP_NAME, "0", { MKSTREAM: true });
        console.log("Consumer group created");
    } catch (err: any) {
        if (!err.message.includes("BUSYGROUP")) {
            throw err;
        }
    }
}


export async function pushJob(job: any) {
    await redisClient.xAdd(STREAM_KEY, "*", { data: JSON.stringify(job) });
}

export async function pushToDLQ(
    job: any,
    error: string,
) {
    const streamId = await redisClient.xAdd(DLQ_STREAM_KEY, "*", {
        data: JSON.stringify({
            job,
            error,
            movedAt: new Date().toISOString(),
        }),
    });

    return streamId;
}


// blocking read of one new job for this consumer
export async function popJob(consumerName: string) {
    const result = await redisReaderClient.xReadGroup(
        GROUP_NAME,
        consumerName,
        [{ key: STREAM_KEY, id: ">" }],
        { COUNT: 1, BLOCK: 0 }
    );

    if (!result || result.length === 0) return null;

    const message = result[0].messages[0];

    if (!message) return null;

    return {
        streamId: message.id,
        job: JSON.parse(message.message.data),
    };
}


// call after successful processing
export async function ackJob(streamId: string) {
    await redisClient.xAck(STREAM_KEY, GROUP_NAME, streamId);
}