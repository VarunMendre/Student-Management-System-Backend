import scholarshipOcrService from "./services/scholarshipOcrService.js";

const POLL_INTERVAL_MS = Number(process.env.OCR_POLL_INTERVAL_MS || 5000);
const IDLE_LOG_EVERY = Number(process.env.OCR_IDLE_LOG_EVERY || 12);

let idleCycles = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
    console.log(`[OCR Worker] started with poll interval ${POLL_INTERVAL_MS}ms`);

    while (true) {
        try {
            const result = await scholarshipOcrService.processNextScholarshipOcrJob();
            if (result?.processed) {
                idleCycles = 0;
                console.log(`[OCR Worker] processed job ${result.jobId} with status ${result.status}`);
                continue;
            }

            idleCycles += 1;
            if (idleCycles % IDLE_LOG_EVERY === 0) {
                console.log("[OCR Worker] waiting for queued OCR jobs");
            }
        } catch (error) {
            console.error("[OCR Worker] unexpected error:", error?.message || error);
        }

        await sleep(POLL_INTERVAL_MS);
    }
};

run().catch((error) => {
    console.error("[OCR Worker] fatal error:", error);
    process.exit(1);
});
