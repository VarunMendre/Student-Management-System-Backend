import scholarshipService from "../services/scholarshipService.js";
import asyncHandler from "../utils/asyncHandler.js";

const getConfig = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const config = await scholarshipService.getCourseScholarshipConfig(courseId);
    res.json({ success: true, data: config });
});

const updateConfig = asyncHandler(async (req, res) => {
    const { course_id, configs } = req.body;
    const result = await scholarshipService.updateCourseScholarshipConfig(course_id, configs);
    res.status(200).json({ success: true, ...result });
});

const disburse = asyncHandler(async (req, res) => {
    const { disbursements } = req.body;
    if (!Array.isArray(disbursements)) {
        return res.status(400).json({ success: false, message: "Invalid input" });
    }
    const results = await scholarshipService.disburseScholarshipBatch(disbursements);
    
    const summary = {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length
    };

    res.status(200).json({ success: true, summary, results });
});

const getSummary = asyncHandler(async (req, res) => {
    const summary = await scholarshipService.getScholarshipSummary();
    res.json({ success: true, data: summary });
});

const reverse = asyncHandler(async (req, res) => {
    const { txnId } = req.params;
    const result = await scholarshipService.reverseScholarship(txnId);
    res.json({ success: true, ...result });
});

export default {
    getConfig,
    updateConfig,
    disburse,
    getSummary,
    reverse
};
