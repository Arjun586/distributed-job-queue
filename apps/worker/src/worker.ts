import {connectRedis} from "../../../packages/redis/src/client.js"
import { ensureGroup, popJob, ackJob } from "../../../packages/queue/src/index.js";
import { randomUUID } from "crypto";

const consumerName = `worker-${randomUUID()}`;


async function processJob(job: any) {
    console.log("Processing job:", job);
    await new Promise((r) => setTimeout(r, 1000));
    console.log("Done:", job.id);
}


async function startWorker(){
    await connectRedis();
    await ensureGroup();

    console.log(`Worker started as ${consumerName}, waiting for jobs...`);

    while (true) {
        const result = await popJob(consumerName);
        if(result) {
            await processJob(result.job);
            await ackJob(result.streamId);
        }
    }
}

startWorker();