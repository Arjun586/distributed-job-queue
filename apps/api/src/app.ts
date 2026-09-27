import express from "express";
import { randomUUID } from "crypto";
import { connectRedis } from "../../../packages/redis/src/client.js"
import { pushJob, ensureGroup } from "../../../packages/queue/src/index.js";
import { prisma, connectDatabase } from "../../../packages/database/src/client.js";
import "dotenv/config";

const app = express();
app.use(express.json());

app.post("/api/jobs", async (req, res) => {
    const job = { id: randomUUID(), 
        type: req.body.type, 
        payload: req.body.payload 
    };

    await prisma.job.create({
        data: { id: job.id, type: job.type, payload: job.payload },
    });

    await pushJob(job);
    res.json({ 
        jobId: job.id, 
        status: "PENDING" 
    });
});

app.get("/api/jobs/:id", async (req, res) => {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
});

app.listen(3000, async () => {
    await connectRedis();
    await connectDatabase();
    await ensureGroup();
    console.log("API running on port 3000");
});