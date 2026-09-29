# Distributed Job Queue & Task Processing Platform

A distributed background job processing system built with **TypeScript, Node.js, Express, Redis, PostgreSQL, Prisma, and Docker**.

The project separates **job submission** from **job execution**. The API creates and persists jobs, Redis Streams acts as the queue, and multiple workers consume and process jobs asynchronously.

The goal of this project is to understand the core mechanics behind background job systems and distributed workers by implementing a small version from scratch.

---

## 1. Problem

Some backend operations should not block an HTTP request for their entire duration.

Examples include:

- Sending emails
- Processing files
- Generating reports
- Resizing images
- Sending notifications
- Calling slow external APIs
- Data processing

A synchronous approach looks like:

```text
Client
  ↓
API Server
  ↓
Perform expensive operation
  ↓
Response
```

This keeps the HTTP request open while the work is being performed and makes failures and scaling harder to manage.

A job queue separates the two responsibilities:

```text
Client
  ↓
API Server
  ↓
Create Job
  ↓
Queue
  ↓
Worker(s)
  ↓
Process Job
```

The API can return a job ID while the actual work happens in the background.

---

## 2. What This Project Implements

The current MVP implements the core job-processing pipeline:

- Asynchronous job submission
- PostgreSQL job persistence
- Redis Streams queue
- Redis consumer groups
- Multiple worker processes
- Per-worker concurrency
- Job acknowledgement
- Retryable/non-retryable failure classification
- Retry with exponential backoff and jitter
- Configurable maximum attempts
- Dead Letter Queue (DLQ)
- Docker Compose development environment

The project intentionally stops short of implementing every production feature found in mature job-processing systems.

---

## 3. Architecture

```text
                         Client
                           │
                           ▼
                    ┌─────────────┐
                    │ API Server  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ PostgreSQL  │
                    │ Job State   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Redis    │
                    │ Redis Stream│
                    └──────┬──────┘
                           │
                    Consumer Group
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          Worker 1     Worker 2     Worker 3
          concurrency  concurrency  concurrency
             ×3           ×3           ×3
              │            │            │
              └────────────┼────────────┘
                           ▼
                      Process Job
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          Completed     Retry          DLQ
                         │
                         ▼
                    Backoff + Retry
```

### Worker model

All workers consume from the same Redis Stream consumer group. A job is delivered to one consumer in the group rather than being broadcast to every worker.

Each worker process also runs multiple processing loops. The current configuration is:

```text
3 Docker worker containers
×
3 concurrent processing loops per worker
=
up to 9 active jobs
```

The exact throughput depends on the workload and available resources.

---

## 4. Job Lifecycle

A normal job follows this path:

```text
PENDING
   ↓
PROCESSING
   ↓
COMPLETED
```

A retryable failure follows:

```text
PENDING
   ↓
PROCESSING
   ↓
RETRYING
   ↓
Backoff
   ↓
PROCESSING
   ↓
COMPLETED
```

A job that reaches its maximum attempts is moved to the Dead Letter Queue:

```text
PROCESSING
   ↓
RETRYING
   ↓
...
   ↓
Maximum attempts reached
   ↓
DEAD_LETTER
   ↓
DLQ
```

---

## 5. Retry System

Not every failure should be retried.

The worker classifies errors as retryable or non-retryable.

### Retryable failures

Examples:

- Temporary network failures
- External service timeouts
- Temporary service failures

### Non-retryable failures

Examples:

- Invalid input
- Unsupported job type
- Permanent application errors

Retries use exponential backoff with jitter.

The current calculation is conceptually:

```text
delay = baseDelay × 2^(attempt - 1) + randomJitter
```

This prevents immediate repeated retries and reduces synchronized retry bursts.

---

## 6. Dead Letter Queue

A job that repeatedly fails should not retry indefinitely.

Example:

```text
Attempt 1  ❌
Attempt 2  ❌
Attempt 3  ❌
Attempt 4  ❌
Attempt 5  ❌
      │
      ▼
     DLQ
```

The worker stores the failure information and moves permanently failed jobs to a separate Redis Stream used as the Dead Letter Queue.

---

## 7. Distributed Workers

Multiple worker containers can consume jobs from the same Redis consumer group.

For example:

```text
Redis Stream
     │
     ▼
job_workers consumer group
     │
     ├──── Worker 1
     ├──── Worker 2
     └──── Worker 3
```

Redis assigns new stream entries to consumers in the group. This allows the same worker implementation to be replicated horizontally without creating a separate queue for every worker.

Each worker receives a unique runtime identifier:

```text
worker-<UUID>
```

This makes individual workers identifiable in logs.

---

## 8. Worker Concurrency

Each worker can process multiple I/O-bound jobs concurrently.

The current worker configuration is:

```ts
const CONCURRENCY = 3;
```

A worker starts three independent processing loops:

```text
Worker 1
├── Loop 1 → Job A
├── Loop 2 → Job B
└── Loop 3 → Job C
```

With three Docker workers, the system can have up to nine active jobs under the current configuration.

This demonstrates two different scaling dimensions:

```text
Horizontal scaling
= more worker processes

Concurrency
= more active jobs per worker
```

---

## 9. Persistence

PostgreSQL acts as the durable source of truth for job state.

The job model stores information such as:

- Job ID
- Job type
- Payload
- Status
- Result
- Error
- Attempt count
- Maximum attempts
- Created/updated timestamps

Redis is used for fast queue operations, while PostgreSQL stores the persistent job record.

---

## 10. Current API

### Create Job

```http
POST /api/jobs
```

Example request:

```json
{
  "type": "TEST_JOB",
  "payload": {
    "message": "Process this job"
  },
  "behavior": "success"
}
```

Example response:

```json
{
  "jobId": "...",
  "status": "PENDING"
}
```

The API persists the job and pushes it into the Redis Stream for asynchronous processing.

---

## 11. Testing the Distributed Workers

A small script can submit multiple jobs concurrently:

```text
POST /api/jobs × N
```

For example, submitting 20 jobs allows the worker logs to demonstrate that jobs are distributed across multiple worker containers.

Example:

```text
worker-1 → Job 1
worker-2 → Job 2
worker-3 → Job 3
worker-3 → Job 4
worker-2 → Job 5
worker-1 → Job 6
```

The same test can also demonstrate per-worker concurrency.

---

## 12. Failure Demonstration

The worker supports different test behaviors so the system can demonstrate success and failure paths.

### Successful job

```text
Create Job
    ↓
PROCESSING
    ↓
COMPLETED
```

### Retryable failure

```text
Create Job
    ↓
PROCESSING
    ↓
RETRYING
    ↓
Backoff
    ↓
Retry
```

### Permanent failure

```text
Create Job
    ↓
PROCESSING
    ↓
RETRYING
    ↓
Maximum attempts
    ↓
DEAD_LETTER
    ↓
DLQ
```

---

## 13. Why Build This Instead of Using BullMQ?

In a normal production Node.js application, using a mature job-processing library such as BullMQ can be the appropriate choice.

This project has a different purpose: **understanding the underlying mechanics**.

Instead of treating the queue as a black box, this implementation makes the core pieces explicit:

```text
Redis Stream
     ↓
Consumer Group
     ↓
Worker
     ↓
Job Processing
     ↓
Acknowledgement
     ↓
Retry / Backoff
     ↓
DLQ
```

The objective is not to build a replacement for BullMQ. The objective is to understand the problems that production job-processing libraries solve and the trade-offs behind them.

---

## 14. Tech Stack

### Backend

- Node.js
- TypeScript
- Express.js

### Database

- PostgreSQL
- Prisma

### Queue

- Redis Streams
- Redis Consumer Groups

### Infrastructure

- Docker
- Docker Compose

### Development

- Git
- GitHub
- Postman

---

## 15. Project Structure

```text
distributed-job-queue/
│
├── apps/
│   ├── api/
│   │   └── src/
│   └── worker/
│       └── src/
│
├── packages/
│   ├── database/
│   ├── queue/
│   └── redis/
│
├── prisma/
│   └── schema.prisma
│
├── scripts/
│   └── send-jobs.js
│
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

---

## 16. Running the Project

Start the development environment with Docker Compose:

```bash
docker compose up --build
```

To run multiple worker containers:

```bash
docker compose up --build --scale worker=3
```

Run to migrate DB
```bash
docker compose exec api npx prisma migrate deploy
```

View worker logs:

```bash
docker compose logs -f worker
```

Submit test jobs using the helper script:

```bash
node scripts/send-jobs.js
```

---

## 17. Current Scope

The project is intentionally focused on the core job-queue problem.

### Implemented

- [x] API can create jobs
- [x] Jobs are persisted in PostgreSQL
- [x] Jobs are pushed to Redis Streams
- [x] Redis consumer groups distribute jobs across workers
- [x] Multiple workers can run concurrently
- [x] Per-worker concurrency is configurable
- [x] Jobs are acknowledged after processing
- [x] Retryable and non-retryable failures are classified
- [x] Exponential backoff with jitter
- [x] Maximum retry attempts
- [x] Dead Letter Queue
- [x] Docker-based worker scaling

### Final planned addition

- [ ] Small web dashboard showing job status, results/errors, attempts, and the success/retry/failure flow

The dashboard is intentionally a presentation layer over the existing job state. It is not intended to become a full monitoring platform.

### Not implemented

The following were intentionally left out of the MVP:

- Worker leases and heartbeats
- Crash recovery / stale-job recovery
- Transactional Outbox
- Idempotency infrastructure
- Priority queues
- Authentication/authorization
- Advanced observability platforms
- Prometheus/Grafana-style monitoring
- Large-scale load-testing infrastructure

These are valid production concerns, but adding them is outside the scope of this MVP.

---

## 18. What This Project Demonstrates

The main engineering concepts demonstrated by the current implementation are:

```text
Asynchronous Processing
        ↓
Producer / Consumer
        ↓
Redis Streams
        ↓
Consumer Groups
        ↓
Worker Pools
        ↓
Concurrency
        ↓
Horizontal Scaling
        ↓
Retries
        ↓
Exponential Backoff
        ↓
Dead Letter Queues
        ↓
Durable Job State
```

The important part is being able to explain **why each component exists, how jobs move through the system, and what happens when processing fails**.

---

## 19. Next Step

The final step is a small dashboard that makes the system understandable without reading Docker logs.

The dashboard will show:

```text
┌──────────────────────────────────────────────┐
│ Distributed Job Queue                        │
│                                              │
│ [Success Job] [Retry Job] [Failing Job]      │
│                                              │
│ Total    Completed    Retrying    Failed     │
│                                              │
│ Recent Jobs                                  │
│ ──────────────────────────────────────────── │
│ ✓ Completed                                  │
│ ↻ Retrying                                   │
│ ✕ Dead Letter                                │
│ ⏳ Processing                                │
└──────────────────────────────────────────────┘
```

The dashboard will use the existing PostgreSQL job state rather than parsing worker logs.

---

## 20. Core Principle

The project is built around one practical question:

> **How can background work be submitted quickly, processed asynchronously by multiple workers, retried when appropriate, and prevented from retrying forever?**

The implementation is intentionally small enough that the entire system can be understood end-to-end.
