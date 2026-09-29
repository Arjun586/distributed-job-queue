const N = 20;

async function sendJob(i) {
    const response = await fetch("http://localhost:3000/api/jobs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            type: "TEST_JOB",
            payload: {
                message: `Phase 4 test job ${i + 1}`,
            },
            behavior: "success",
        }),
    });

    return response.json();
}

async function main() {
    const jobs = Array.from({ length: N }, (_, i) => sendJob(i));

    const results = await Promise.all(jobs);

    console.log(`Created ${results.length} jobs`);
    console.log(results);
}

main();