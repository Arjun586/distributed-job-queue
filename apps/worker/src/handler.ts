import { RetryableError } from "./errors.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function testJobHandler(job: any) {
    const behavior = job.behavior ?? "success";

    await sleep(500);

    switch (behavior) {
        case "success":
            return { message: "done" };

        case "retryable": // always fails, may be retried
            throw new RetryableError("Simulated temporary failure");

        case "fatal": // always fails, never retried
            throw new Error("Simulated permanent failure");

        case "flaky": // fails twice, then succeeds
            if (job.attempts < 2) {
                throw new RetryableError(`Flaky failure #${job.attempts + 1}`);
            }
            return { message: `succeeded after ${job.attempts} failures` };

        default:
            throw new Error(`Unknown behavior: ${behavior}`);
    }
}
// job type -> handler
const handlers: Record<string, (job: any) => Promise<any>> = {
    TEST_JOB: testJobHandler,
};

export async function runHandler(job: any) {
    const handler = handlers[job.type];
    if (!handler) throw new Error(`Unsupported job type: ${job.type}`); // non-retryable
    return handler(job);
}