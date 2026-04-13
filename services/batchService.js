import batchModel from "../models/batchModel.js";
import { withTransaction } from "../utils/dbUtils.js";

const createBatch = async (batchData) => {
    return await batchModel.create(batchData);
};

const updateBatchFees = async (batchId, components) => {
    return await withTransaction(async (client) => {
        await batchModel.deleteFeesByBatch(client, batchId);
        for (const comp of components) {
            await batchModel.insertFee(client, batchId, comp.component_name, comp.amount);
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
        components: components.map(({ total_fee, ...rest }) => rest),
        total_fee
    };
};

export default { createBatch, updateBatchFees, getBatchWithFees };