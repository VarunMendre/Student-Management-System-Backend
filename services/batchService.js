import batchModel from "../models/batchModel.js";
import { withTransaction } from "../utils/dbUtils.js";

const createBatch = async (batchData) => batchModel.create(batchData);

const updateBatchFees = async (batchId, components) => {
    return withTransaction(async (client) => {
        await batchModel.deleteFeesByBatch(client, batchId);
        await Promise.all(
            components.map((component) =>
                batchModel.insertFee(client, batchId, component.component_name, component.amount)
            )
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
        components: components.map(({ total_fee, ...rest }) => rest),
        total_fee
    };
};

const getAllBatches = async (courseId) => batchModel.findAllWithCourseDetails(courseId);

export default { createBatch, updateBatchFees, getBatchWithFees, getAllBatches };
