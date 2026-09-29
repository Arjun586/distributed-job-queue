import { useEffect, useState } from "react";
import "./index.css";

type Job = {
    id: string;
    type: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    error: string | null;
    createdAt: string;
};

type Filter = "ALL" | "COMPLETED" | "RETRYING" | "PROCESSING" | "FAILED";

async function createJob(behavior: string) {
    const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            type: "TEST_JOB",
            payload: {},
            behavior,
            maxAttempts: 5,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to create job");
    }
}

async function createMultipleJobs(count: number) {
    await Promise.all(
        Array.from({ length: count }, () =>
            createJob("success")
        )
    );
}

async function fetchJobs(): Promise<Job[]> {
    const response = await fetch("/api/jobs");

    if (!response.ok) {
        throw new Error("Failed to fetch jobs");
    }

    return response.json();
}

function getStatusText(status: string) {
    switch (status) {
        case "COMPLETED":
            return "Completed";

        case "PROCESSING":
            return "Processing";

        case "RETRYING":
            return "Retrying";

        case "DEAD_LETTER":
            return "Failed";

        case "PENDING":
            return "Pending";

        default:
            return status;
    }
}

function getJobTitle(job: Job) {
    if (job.error?.includes("Flaky")) {
        return "Retry Job";
    }

    if (job.error?.includes("permanent")) {
        return "Failing Job";
    }

    return "Successful Job";
}

function getJobDescription(job: Job) {
    switch (job.status) {
        case "COMPLETED":
            return `Completed successfully after ${job.attempts} attempt${
                job.attempts === 1 ? "" : "s"
            }.`;

        case "RETRYING":
            return `Attempt ${job.attempts} of ${job.maxAttempts}. Retrying automatically.`;

        case "PROCESSING":
            return "A worker is currently processing this job.";

        case "DEAD_LETTER":
            return "The job failed and was moved to the dead-letter queue.";

        case "PENDING":
            return "Waiting for a worker.";

        default:
            return "";
    }
}

function App() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [creating, setCreating] = useState(false);
    const [filter, setFilter] = useState<Filter>("ALL");

    async function refreshJobs() {
        try {
            const data = await fetchJobs();
            setJobs(data);
        } catch (error) {
            console.error(error);
        }
    }

    async function handleCreateJob(behavior: string) {
        try {
            setCreating(true);
            await createJob(behavior);
            await refreshJobs();
        } catch (error) {
            console.error(error);
        } finally {
            setCreating(false);
        }
    }

    async function handleConcurrentJobs() {
        try {
            setCreating(true);

            await createMultipleJobs(20);

            await refreshJobs();
        } catch (error) {
            console.error(error);
        } finally {
            setCreating(false);
        }
    }

    useEffect(() => {
        refreshJobs();

        const interval = setInterval(refreshJobs, 1500);

        return () => clearInterval(interval);
    }, []);

    const completed = jobs.filter(
        (job) => job.status === "COMPLETED"
    ).length;

    const retrying = jobs.filter(
        (job) => job.status === "RETRYING"
    ).length;

    const processing = jobs.filter(
        (job) => job.status === "PROCESSING"
    ).length;

    const failed = jobs.filter(
        (job) => job.status === "DEAD_LETTER"
    ).length;

    const filteredJobs = jobs.filter((job) => {
        if (filter === "ALL") {
            return true;
        }

        if (filter === "FAILED") {
            return job.status === "DEAD_LETTER";
        }

        return job.status === filter;
    });

    return (
        <main className="dashboard">
            <header>
                <h1>Distributed Job Queue</h1>

                <p>
                    Submit jobs and watch workers process them in real time.
                </p>
            </header>

            <section className="actions">
                <button
                    onClick={() => handleCreateJob("success")}
                    disabled={creating}
                >
                    Run Successful Job
                </button>

                <button
                    onClick={() => handleCreateJob("flaky")}
                    disabled={creating}
                >
                    Run Retry Job
                </button>

                <button
                    onClick={() => handleCreateJob("fatal")}
                    disabled={creating}
                >
                    Run Failing Job
                </button>

                <button
                    onClick={handleConcurrentJobs}
                    disabled={creating}
                >
                    Run 20 Concurrent Jobs
                </button>
            </section>

            <section className="stats">
                <div className="stat">
                    <span>Total</span>
                    <strong>{jobs.length}</strong>
                </div>

                <div className="stat">
                    <span>Completed</span>
                    <strong>{completed}</strong>
                </div>

                <div className="stat">
                    <span>Processing</span>
                    <strong>{processing}</strong>
                </div>

                <div className="stat">
                    <span>Retrying</span>
                    <strong>{retrying}</strong>
                </div>

                <div className="stat">
                    <span>Failed</span>
                    <strong>{failed}</strong>
                </div>
            </section>

            <section>
                <div className="jobs-header">
                    <h2>Recent Jobs</h2>

                    <div className="filters">
                        <button
                            className={filter === "ALL" ? "selected" : ""}
                            onClick={() => setFilter("ALL")}
                        >
                            All
                        </button>

                        <button
                            className={
                                filter === "COMPLETED"
                                    ? "selected"
                                    : ""
                            }
                            onClick={() => setFilter("COMPLETED")}
                        >
                            Completed
                        </button>

                        <button
                            className={
                                filter === "PROCESSING"
                                    ? "selected"
                                    : ""
                            }
                            onClick={() => setFilter("PROCESSING")}
                        >
                            Processing
                        </button>

                        <button
                            className={
                                filter === "RETRYING"
                                    ? "selected"
                                    : ""
                            }
                            onClick={() => setFilter("RETRYING")}
                        >
                            Retrying
                        </button>

                        <button
                            className={
                                filter === "FAILED"
                                    ? "selected"
                                    : ""
                            }
                            onClick={() => setFilter("FAILED")}
                        >
                            Failed
                        </button>
                    </div>
                </div>

                <div className="jobs">
                    {filteredJobs.map((job) => (
                        <article className="job" key={job.id}>
                            <div className="job-main">
                                <strong>{getJobTitle(job)}</strong>

                                <span
                                    className={`status ${job.status.toLowerCase()}`}
                                >
                                    {getStatusText(job.status)}
                                </span>
                            </div>

                            <p>{getJobDescription(job)}</p>
                            <small>
                                Created: {new Date(job.createdAt).toLocaleString()}
                            </small>
                        </article>
                    ))}

                    {filteredJobs.length === 0 && (
                        <p className="empty">
                            No jobs match this filter.
                        </p>
                    )}
                </div>
            </section>
        </main>
    );
}

export default App;