# Distributed Job Queue & Task Processing Platform

A distributed background job processing system built to handle asynchronous tasks using a Redis-backed queue, PostgreSQL persistence, and horizontally scalable workers.

---

## 1. What We Are Building

A system where clients can submit background jobs without waiting for the task to finish.

```text
Client
  │
  ▼
API Server
  │
  ▼
PostgreSQL
  │
  ▼
Redis Queue
  │
  ├──────────┬──────────┐
  ▼          ▼          ▼
Worker 1   Worker 2   Worker 3
  │          │          │
  └──────────┼──────────┘
             ▼
        Job Processing
```

Example jobs:

* Send emails
* Process documents
* Generate reports
* Resize images
* Send notifications
* Call external APIs

The system must support multiple workers, retries, failure recovery, idempotency, job priorities, Dead Letter Queues, and reliable job delivery.

---

## 2. Requirements

### Functional Requirements

* Create jobs
* Retrieve job status
* List jobs
* Cancel jobs
* Retry failed jobs
* View job attempts
* Process jobs asynchronously
* Support multiple job types
* Support job priorities
* Support configurable retry limits
* Store job results
* Store job errors
* Move permanently failed jobs to a Dead Letter Queue
* Recover jobs from crashed workers
* Prevent unsafe duplicate execution
* Support multiple concurrent workers
* Support worker health monitoring

### Non-Functional Requirements

* Durable job persistence
* Horizontal scalability
* Fault tolerance
* Concurrent processing
* Reliable job delivery
* Idempotent processing
* Rate limiting
* Input validation
* Structured logging
* Health checks
* Basic metrics
* Docker-based deployment
* Load-testable architecture

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
                  ┌────────┴────────┐
                  │                 │
                  ▼                 ▼
           ┌────────────┐    ┌──────────────┐
           │ PostgreSQL │    │ Rate Limiter │
           └─────┬──────┘    │    Redis     │
                 │           └──────────────┘
                 │
                 ▼
          ┌───────────────┐
          │ Outbox Events │
          └───────┬───────┘
                  │
                  ▼
          ┌────────────────┐
          │ Outbox Worker  │
          └───────┬────────┘
                  │
                  ▼
             ┌─────────┐
             │  Redis  │
             │  Queue  │
             └────┬────┘
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
   Worker 1   Worker 2   Worker 3
       │          │          │
       └──────────┼──────────┘
                  │
                  ▼
            Job Handlers
                  │
          ┌───────┼────────┐
          ▼       ▼        ▼
       Success  Retry     Failure
                   │        │
                   ▼        ▼
                Backoff     DLQ
```

---

## 4. Features

### Job Management

* Job creation
* Job status tracking
* Job result storage
* Job error storage
* Job cancellation
* Job retry
* Job history
* Job attempt tracking

### Queue

* Redis-backed queue
* Priority queues
* Multiple workers
* Worker concurrency
* Job acknowledgement
* Queue depth tracking

### Reliability

* Automatic retries
* Exponential backoff
* Retry jitter
* Maximum retry attempts
* Dead Letter Queue
* Idempotency
* Job leases
* Visibility timeout
* Worker heartbeats
* Worker crash recovery
* Transactional Outbox

### Security & API Protection

* Authentication
* Authorization
* Request validation
* Rate limiting
* Secure configuration

### Operations

* Structured logging
* Health checks
* Worker health
* Queue metrics
* Processing metrics
* Load testing
* Docker-based scaling

---

## 5. Components

### API Server

Responsibilities:

* Authentication
* Request validation
* Rate limiting
* Job creation
* Job status APIs
* Job management APIs

### PostgreSQL

Stores:

* Jobs
* Job attempts
* Job results
* Job errors
* Worker information
* Outbox events

### Redis

Handles:

* Job queues
* Retry queues
* Dead Letter Queue
* Rate limiting
* Job leases
* Worker heartbeat state
* Temporary coordination state

### Worker

Responsibilities:

* Consume jobs
* Claim jobs
* Execute jobs
* Update job status
* Handle retries
* Maintain job leases
* Send heartbeats
* Recover from failures

### Outbox Publisher

Responsibilities:

* Read pending outbox events
* Publish events to Redis
* Mark events as published
* Retry failed publishing

### Job Handlers

Examples:

```text
SEND_EMAIL
PROCESS_DOCUMENT
PROCESS_IMAGE
GENERATE_REPORT
SEND_NOTIFICATION
CALL_EXTERNAL_API
```

---

## 6. APIs

### Create Job

```http
POST /api/jobs
```

Request:

```json
{
  "type": "SEND_EMAIL",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome"
  },
  "priority": "HIGH",
  "maxAttempts": 3
}
```

Response:

```json
{
  "jobId": "job_123",
  "status": "PENDING"
}
```

### Get Job

```http
GET /api/jobs/:id
```

### List Jobs

```http
GET /api/jobs
```

Supported filters:

```text
status
type
priority
createdAt
```

### Cancel Job

```http
POST /api/jobs/:id/cancel
```

### Retry Job

```http
POST /api/jobs/:id/retry
```

### Get Job Attempts

```http
GET /api/jobs/:id/attempts
```

### Get Queue Statistics

```http
GET /api/queue/stats
```

### Get Worker Statistics

```http
GET /api/workers
```

### Health Check

```http
GET /health
```

### Readiness Check

```http
GET /ready
```

---

## 7. Database Schema

### `jobs`

| Column       | Type      |
| ------------ | --------- |
| id           | UUID      |
| type         | VARCHAR   |
| status       | ENUM      |
| priority     | ENUM      |
| payload      | JSONB     |
| result       | JSONB     |
| error        | TEXT      |
| attempts     | INTEGER   |
| max_attempts | INTEGER   |
| lease_until  | TIMESTAMP |
| created_at   | TIMESTAMP |
| started_at   | TIMESTAMP |
| completed_at | TIMESTAMP |
| failed_at    | TIMESTAMP |
| created_by   | UUID      |

### `job_attempts`

| Column         | Type      |
| -------------- | --------- |
| id             | UUID      |
| job_id         | UUID      |
| attempt_number | INTEGER   |
| worker_id      | VARCHAR   |
| status         | ENUM      |
| error          | TEXT      |
| started_at     | TIMESTAMP |
| finished_at    | TIMESTAMP |

### `outbox_events`

| Column       | Type      |
| ------------ | --------- |
| id           | UUID      |
| event_type   | VARCHAR   |
| aggregate_id | UUID      |
| payload      | JSONB     |
| published    | BOOLEAN   |
| created_at   | TIMESTAMP |
| published_at | TIMESTAMP |

### `workers`

| Column         | Type      |
| -------------- | --------- |
| id             | UUID      |
| worker_id      | VARCHAR   |
| status         | ENUM      |
| last_heartbeat | TIMESTAMP |
| started_at     | TIMESTAMP |
| updated_at     | TIMESTAMP |

### `processed_jobs`

| Column       | Type      |
| ------------ | --------- |
| id           | UUID      |
| job_id       | UUID      |
| processed_at | TIMESTAMP |
| result       | JSONB     |

---

## 8. Job Lifecycle

```text
                 ┌───────────┐
                 │  PENDING  │
                 └─────┬─────┘
                       │
                       ▼
                 ┌────────────┐
                 │ PROCESSING │
                 └──────┬─────┘
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
        COMPLETED    RETRYING    FAILED
                       │
                       ▼
                    BACKOFF
                       │
                       ▼
                  PROCESSING
                       │
                  max attempts
                       │
                       ▼
                      DLQ
```

### States

```text
PENDING
PROCESSING
COMPLETED
FAILED
RETRYING
CANCELLED
DEAD_LETTER
```

---

## 9. Failure Cases

### Worker Crash

```text
Worker
  │
  ▼
Processing
  │
  X
Crash
  │
  ▼
Lease Expires
  │
  ▼
Job Recovered
  │
  ▼
Another Worker
```

### Redis Failure

```text
API
 │
 ▼
PostgreSQL ✓
 │
 ▼
Redis ✗
```

Pending outbox events remain available for later publishing.

### PostgreSQL Failure

```text
API
 │
 ▼
PostgreSQL ✗
 │
 ▼
Request fails safely
```

No job should be reported as successfully created without durable persistence.

### External Service Failure

```text
Worker
  │
  ▼
External API
  │
  X
Timeout / 5xx
  │
  ▼
Retry
  │
  ▼
Exponential Backoff
```

### Non-Retryable Failure

```text
Invalid Job
    │
    ▼
FAILED
```

No unnecessary retries.

### Maximum Retries Exceeded

```text
Job
 │
 ├── Attempt 1 ✗
 ├── Attempt 2 ✗
 ├── Attempt 3 ✗
 └── Attempt 4 ✗
        │
        ▼
       DLQ
```

### Duplicate Execution

```text
Worker 1
   │
   ▼
Process Job
   │
   X
Crash before acknowledgement
   │
   ▼
Worker 2
   │
   ▼
Same Job
```

Idempotency must prevent unsafe duplicate side effects.

### Worker Becomes Unresponsive

```text
Worker
  │
  ├── Heartbeat
  ├── Heartbeat
  X
No heartbeat
  │
  ▼
Lease expires
  │
  ▼
Job becomes recoverable
```

### Queue Overload

```text
Incoming Jobs
      │
      ▼
Redis Queue
      │
      ▼
Queue Depth ↑
      │
      ▼
Scale Workers
```

---

## 10. Tech Stack

### Backend

* Node.js
* TypeScript
* Express.js

### Database

* PostgreSQL
* Prisma ORM

### Queue & Distributed State

* Redis

### Infrastructure

* Docker
* Docker Compose

### Validation

* Zod

### Authentication

* JWT
* HTTP-only cookies

### Testing

* Vitest
* Integration tests
* Failure tests
* Load testing

### Development Tools

* Git
* GitHub
* Postman

### Observability

* Structured logging
* Health checks
* Queue metrics
* Worker metrics
* Processing latency
* Error/retry metrics


# Development Phases

## Phase 1 — Basic Queue

Build:

```text
API
 ↓
Redis
 ↓
Worker
```

Support:

* Creating jobs
* Consuming jobs
* Processing jobs
* Basic job status

---

## Phase 2 — Persistence

Add:

```text
PostgreSQL
 +
Prisma
```

Store:

* Job metadata
* Status
* Results
* Errors

---

## Phase 3 — Reliability

Add:

* Acknowledgement
* Retries
* Exponential backoff
* DLQ
* Failure classification

---

## Phase 4 — Distributed Workers

Add:

* Multiple workers
* Worker concurrency
* Job claiming
* Race-condition protection
* Worker IDs

---

## Phase 5 — Failure Recovery

Add:

* Job leases
* Visibility timeout
* Worker heartbeat
* Crash recovery
* Stale-job detection

---

## Phase 6 — Idempotency

Add:

* Idempotency keys
* Duplicate execution protection
* Processed-job tracking
* Safe retry behavior

---

## Phase 7 — Transactional Outbox

Add:

```text
PostgreSQL
   │
   ├── Job
   └── Outbox Event
          │
          ▼
   Outbox Publisher
          │
          ▼
        Redis
```

---

## Phase 8 — Production Features

Add:

* Authentication
* Rate limiting
* Priority queues
* Structured logging
* Metrics
* Health checks
* Docker scaling
* Load testing
