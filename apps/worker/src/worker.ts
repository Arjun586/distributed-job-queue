import {connectRedis} from "../../../packages/redis/src/client.js"
import { ensureGroup, popJob, ackJob, pushJob, pushToDLQ } from "../../../packages/queue/src/index.js";
import { randomUUID } from "crypto";
import { prisma, connectDatabase } from "../../../packages/database/src/client.js";
import {isRetryableError, RetryableError,} from "./errors.js";
import { runHandler } from "./handler.js";

const consumerName = `worker-${randomUUID()}`;


const sleep = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));


function getRetryDelay(attempt: number) {
    const baseDelay = 1000;
    const exponentialDelay = baseDelay * 2 ** (attempt - 1);
    const jitter = Math.random() * 500;

    return exponentialDelay + jitter;
}

async function startWorker(){
    await connectRedis();
    await connectDatabase();
    await ensureGroup();

    console.log(`Worker started as ${consumerName}, waiting for jobs...`);

    while (true) {
        const result = await popJob(consumerName);
        console.log(`Worker ${consumerName} received job:`, result);

        if (!result) continue;

        const { job, streamId } = result;

        await prisma.job.update({
            where: { id: job.id },
            data: { 
                status: "PROCESSING",
                attempts: { increment: 1 },
            },
        });
        

        try {
            const output = await runHandler(job);
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "COMPLETED", result: output },
            });
        } catch (err: any) {

            const retryable = isRetryableError(err);
            const nextAttempt = job.attempts + 1;

            const shouldRetry = retryable && nextAttempt < job.maxAttempts;

            console.log(
                `Job ${job.id} ${shouldRetry ? "will retry" : "has reached max attempts and FAILED"}`
            );
            await prisma.job.update({
                where: { id: job.id },
                data: {
                    status: shouldRetry ? "RETRYING" : "DEAD_LETTER",
                    error: err.message,
                },
            });

            if (!shouldRetry) {
                const dlqId = await pushToDLQ(job, err.message);

                console.log(
                    `Job ${job.id} moved to DLQ | streamId=${dlqId} | attempts=${nextAttempt}`
                );
            }

            await ackJob(streamId);

            if (shouldRetry) {
                const delay = getRetryDelay(nextAttempt);

                console.log(`Retrying job ${job.id} in ${Math.round(delay)}ms`);

                await sleep(delay);

                await pushJob({
                    ...job,
                    attempts: nextAttempt,
                });
            }

            continue;
        }
        
        await ackJob(streamId);
    }
}

startWorker();