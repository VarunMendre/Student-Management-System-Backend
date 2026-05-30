import batchModel from "../models/batchModel.js";
import { withTransaction } from "../utils/dbUtils.js";
import { getAcademicYearLabels, normalizeAcademicYearLabel, normalizeFeeComponentName } from "../utils/receiptGenerator.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";

const createBatch = async (batchData) => batchModel.create(batchData);

const updateBatchFees = async (batchId, components) => {
    return withTransaction(async (client) => {
        const batch = await batchModel.findBatchById(batchId);

        await batchModel.deleteFeesByBatch(client, batchId);
        const validYears = getAcademicYearLabels(batch?.duration);

        // Filter out duplicates (same normalized_year and component_name)
        const uniqueComponents = [];
        const seen = new Set();

        for (const component of components) {
            const normalizedComponentName = normalizeFeeComponentName(component.component_name, batch?.duration);
            const normalizedYear = normalizeAcademicYearLabel(normalizedComponentName.split(" - ")[0], batch?.duration);
            
            const key = `${normalizedYear}|${normalizedComponentName}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueComponents.push({
                    normalizedComponentName,
                    normalizedYear,
                    amount: component.amount
                });
            }
        }

        // Sequential insert to avoid gap lock / deadlocks in transaction
        for (const component of uniqueComponents) {
            if (!validYears.includes(component.normalizedYear)) {
                throw new CustomError({
                    message: `Invalid academic year '${component.normalizedYear}' for course duration '${batch?.duration}'`,
                    statusCode: 400,
                    code: ErrorCodes.VALIDATION_ERROR
                });
            }

            await batchModel.insertFee(
                client,
                batchId,
                component.normalizedYear,
                component.normalizedComponentName,
                component.amount
            );
        }

        return { success: true };
    });
};

const getBatchWithFees = async (batchId) => {
    const batch = await batchModel.findBatchById(batchId);
    if (!batch) return null;

    const components = await batchModel.findFeesByBatchWithTotal(batchId);
    const total_fee = components.length > 0 ? parseFloat(components[0].total_fee) : 0;
    
    return {
        ...batch,
        components: components.map(({ total_fee, ...rest }) => ({
            ...rest,
            component_name: normalizeFeeComponentName(rest.component_name, batch.duration)
        })),
        total_fee
    };
};

const getAllBatches = async (courseId) => batchModel.findAllWithCourseDetails(courseId);

export default { createBatch, updateBatchFees, getBatchWithFees, getAllBatches };
