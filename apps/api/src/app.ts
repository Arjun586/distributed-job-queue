import express from "express";
import { randomUUID } from "crypto";
import { connectRedis } from "../../../packages/redis/src/client.js"
import { pushJob, ensureGroup } from "../../../packages/queue/src/index.js";

const app = express();
app.use(express.json());

app.post("/api/jobs", async (req, res) => {
    const job = { id: randomUUID(), 
        type: req.body.type, 
        payload: req.body.payload 
    };
    await pushJob(job);
    res.json({ 
        jobId: job.id, 
        status: "PENDING" 
    });
});

app.listen(3000, async () => {
    await connectRedis();
    await ensureGroup();
    console.log("API running on port 3000");
});