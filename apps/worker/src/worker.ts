import {connectRedis} from "../../../packages/redis/src/client.js"
import { ensureGroup, popJob, ackJob } from "../../../packages/queue/src/index.js";
import { randomUUID } from "crypto";
import { prisma, connectDatabase } from "../../../packages/database/src/client.js";

const consumerName = `worker-${randomUUID()}`;


async function processJob(job: any) {
    console.log("Processing job:", job);
    await new Promise((r) => setTimeout(r, 5000));
    return { handledBy: consumerName };
}


async function startWorker(){
    await connectRedis();
    await connectDatabase();
    await ensureGroup();

    console.log(`Worker started as ${consumerName}, waiting for jobs...`);

    while (true) {
        const result = await popJob(consumerName);

        if (!result) continue;

        const { job, streamId } = result;

        await prisma.job.update({
            where: { id: job.id },
            data: { status: "PROCESSING" },
        });
        

        try {
            const output = await processJob(job);
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "COMPLETED", result: output },
            });
        } catch (err: any) {
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "FAILED", error: err.message },
            });
        }
        
        await ackJob(streamId);
    }
}

startWorker();