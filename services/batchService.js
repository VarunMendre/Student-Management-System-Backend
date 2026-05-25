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
        await Promise.all(
            components.map((component) => {
                const normalizedComponentName = normalizeFeeComponentName(component.component_name, batch?.duration);
                const normalizedYear = normalizeAcademicYearLabel(normalizedComponentName.split(" - ")[0], batch?.duration);

                if (!validYears.includes(normalizedYear)) {
                    throw new CustomError({
                        message: `Invalid academic year '${normalizedYear}' for course duration '${batch?.duration}'`,
                        statusCode: 400,
                        code: ErrorCodes.VALIDATION_ERROR
                    });
                }

                return batchModel.insertFee(
                    client,
                    batchId,
                    normalizedYear,
                    normalizedComponentName,
                    component.amount
                );
            })
        );

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
