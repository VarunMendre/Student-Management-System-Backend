import scholarshipModel from "../models/scholarshipModel.js";
import { generateReceiptNumber } from "../utils/receiptGenerator.js";
import { withTransaction, withTransactionSilent } from "../utils/dbUtils.js";

const getCourseScholarshipConfig = async (courseId) => {
    return await scholarshipModel.getConfigByCourse(courseId);
};

const updateCourseScholarshipConfig = async (courseId, configs) => {
    return await withTransaction(async (client) => {
        for (const { caste_category, gender, max_amount } of configs) {
            await scholarshipModel.upsertConfig(client, courseId, caste_category, gender, max_amount);
        }
        return { message: `Scholarship configuration updated` };
    });
};

const disburseScholarshipBatch = async (disbursements) => {
    const results = [];

    for (const record of disbursements) {
        const { student_id, amount, installment_no, application_id, academic_year_num } = record;
        
        const res = await withTransactionSilent(async (client) => {
            const student = await scholarshipModel.getStudentAndLedgerForUpdate(client, student_id, academic_year_num);
            if (!student) throw new Error("Student or academic year ledger not found");

            if (await scholarshipModel.checkDuplicateDisbursal(client, student_id, application_id, installment_no)) {
                throw new Error("Duplicate disbursal detected");
            }

            const config = await scholarshipModel.getScholarshipConfig(client, student.course_id, student.caste_category, student.gender);
            if (!config) throw new Error(`No limit configured for ${student.caste_category} ${student.gender}`);
            
            const maxAmount = parseFloat(config.max_amount);
            const totalReceived = await scholarshipModel.getTotalReceived(client, student.ledger_id);
            if (totalReceived >= maxAmount) throw new Error(`Limit reached (₹${maxAmount})`);

            let appliedAmount = Math.min(parseFloat(amount), maxAmount - totalReceived, parseFloat(student.pending_fee));
            if (appliedAmount <= 0) throw new Error("No amount applicable (Balance is 0 or limit reached)");

            const receiptNumber = await generateReceiptNumber();
            const txn = await scholarshipModel.createTransaction(client, {
                student_id, ledger_id: student.ledger_id, amount: appliedAmount,
                mode: 'Scholarship', reference: `APP-${application_id}-INST-${installment_no}`,
                receiptNumber, remarks: `Scholarship Inst ${installment_no}`,
                appId: application_id, instNo: installment_no
            });

            const newTotalPaid = parseFloat(student.total_paid) + appliedAmount;
            const totalYearlyFee = parseFloat(student.total_yearly_fee);
            let status = newTotalPaid >= totalYearlyFee ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

            await scholarshipModel.updateLedgerStatus(client, student.ledger_id, newTotalPaid, status);
            return { student_name: student.full_name, amount_applied: appliedAmount, receipt_number: txn.receipt_number };
        });

        if (res.success) {
            results.push({ student_id, status: 'success', ...res.result });
        } else {
            results.push({ student_id, status: 'failed', amount_requested: amount, error: res.error.message });
        }
    }
    return results;
};

const getScholarshipSummary = async () => {
    return await scholarshipModel.getSummary();
};

const reverseScholarship = async (txnId) => {
    return await withTransaction(async (client) => {
        const txn = await scholarshipModel.getTransactionWithLedger(client, txnId);
        if (!txn || txn.status === 'Reversed') throw new Error(!txn ? "Not found" : "Already reversed");

        const newTotalPaid = parseFloat(txn.total_paid) - parseFloat(txn.amount_paid);
        const totalYearlyFee = parseFloat(txn.total_yearly_fee);
        let status = newTotalPaid >= totalYearlyFee ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

        await scholarshipModel.updateLedgerStatus(client, txn.ledger_id, newTotalPaid, status);
        await scholarshipModel.markAsReversed(client, txnId);
        return { message: "Reversed successfully" };
    });
};

export default { 
    getCourseScholarshipConfig, updateCourseScholarshipConfig, 
    disburseScholarshipBatch, getScholarshipSummary, reverseScholarship 
};
