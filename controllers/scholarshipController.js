import scholarshipService from "../services/scholarshipService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";

const getConfig = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const config = await scholarshipService.getCourseScholarshipConfig(courseId);
    successResponse(res, { data: config }, "Scholarship config fetched successfully");
});

const updateConfig = asyncHandler(async (req, res) => {
    const { course_id, configs } = req.body;
    const result = await scholarshipService.updateCourseScholarshipConfig(course_id, configs);
    successResponse(res, result, "Scholarship config updated successfully");
});

const disburse = asyncHandler(async (req, res) => {
    const { disbursements } = req.body;
    if (!Array.isArray(disbursements)) {
        throw new CustomError({
            message: "Invalid input",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR,
            details: {
                field: "disbursements",
                issue: "Expected an array"
            }
        });
    }
    const results = await scholarshipService.disburseScholarshipBatch(disbursements, {
        actorUserId: req.user.userId,
        actorRole: req.user.role
    });
    
    const summary = {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length
    };

    successResponse(res, { summary, results }, "Scholarship disbursal processed successfully");
});

const getSummary = asyncHandler(async (req, res) => {
    const summary = await scholarshipService.getScholarshipSummary();
    successResponse(res, { data: summary }, "Scholarship summary fetched successfully");
});

const reverse = asyncHandler(async (req, res) => {
    const { txnId } = req.params;
    const result = await scholarshipService.reverseScholarship(txnId);
    successResponse(res, result, "Scholarship reversed successfully");
});

const submitApplication = asyncHandler(async (req, res) => {
    const { application_id } = req.body;
    const result = await scholarshipService.submitScholarshipApplication({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        manualApplicationId: application_id,
        file: req.file
    });
    successResponse(res, { data: result }, "Application uploaded successfully and queued for OCR verification", 201);
});

const getMyApplication = asyncHandler(async (req, res) => {
    const result = await scholarshipService.getMyScholarshipApplication({
        actorUserId: req.user.userId,
        requestOrigin: `${req.protocol}://${req.get("host")}`
    });
    successResponse(res, { data: result }, "Scholarship application fetched successfully");
});

const getApplicationFormUrl = asyncHandler(async (req, res) => {
    const result = await scholarshipService.getScholarshipApplicationFormAccessUrl({
        applicationId: req.params.id,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        requestOrigin: `${req.protocol}://${req.get("host")}`
    });
    successResponse(res, { data: result }, "Scholarship form access URL generated successfully");
});

const listApplications = asyncHandler(async (req, res) => {
    const data = await scholarshipService.listStudentApplications({
        requestOrigin: `${req.protocol}://${req.get("host")}`
    });
    successResponse(res, { data }, "Scholarship applications fetched successfully");
});

const reconcile = asyncHandler(async (req, res) => {
    const result = await scholarshipService.reconcileGovSheetRows({
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        rows: req.body?.rows || []
    });
    successResponse(res, { data: result }, "Government sheet reconciliation completed");
});

export default {
    getConfig,
    updateConfig,
    disburse,
    getSummary,
    reverse,
    submitApplication,
    getMyApplication,
    getApplicationFormUrl,
    listApplications,
    reconcile
};
