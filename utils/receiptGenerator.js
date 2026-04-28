import { pool } from "../config/db.js";

/**
 * Generate a unique receipt number in format: RCP-YYYYMMDD-XXXX
 * The XXXX part is a daily sequential counter, derived from existing receipts for today.
 */
export const generateReceiptNumber = async () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

    const prefix = `RCP-${dateStr}-`;

    // Count existing receipts for today to determine next sequence
    const [rows] = await pool.query(
        "SELECT COUNT(*) as count FROM fee_transactions WHERE receipt_number LIKE ?",
        [`${prefix}%`]
    );

    const nextSeq = parseInt(rows[0].count) + 1;
    const seqStr = String(nextSeq).padStart(4, "0");

    return `${prefix}${seqStr}`;
};

/**
 * Convert a number to words (Indian currency format)
 * e.g., 10500 → "Ten Thousand Five Hundred Rupees Only"
 */
export const amountToWords = (amount) => {
    if (amount === 0) return "Zero Rupees Only";

    const ones = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"
    ];
    const tens = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    const numToWords = (n) => {
        if (n === 0) return "";

        if (n < 20) return ones[n];

        if (n < 100) {
            return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
        }

        if (n < 1000) {
            return ones[Math.floor(n / 100)] + " Hundred" +
                (n % 100 !== 0 ? " " + numToWords(n % 100) : "");
        }

        if (n < 100000) {
            return numToWords(Math.floor(n / 1000)) + " Thousand" +
                (n % 1000 !== 0 ? " " + numToWords(n % 1000) : "");
        }

        if (n < 10000000) {
            return numToWords(Math.floor(n / 100000)) + " Lakh" +
                (n % 100000 !== 0 ? " " + numToWords(n % 100000) : "");
        }

        return numToWords(Math.floor(n / 10000000)) + " Crore" +
            (n % 10000000 !== 0 ? " " + numToWords(n % 10000000) : "");
    };

    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);

    let result = numToWords(rupees) + " Rupees";
    if (paise > 0) {
        result += " and " + numToWords(paise) + " Paise";
    }

    return result + " Only";
};

/**
 * Generate academic year labels based on course duration.
 * e.g., "4 Years" → ["FY", "SY", "TY", "Final Year"]
 *         "2 Years" → ["FY", "Final Year"]
 */
export const getAcademicYearLabels = (duration) => {
    const durationMap = {
        "1 Year": ["FY"],
        "2 Years": ["FY", "Final Year"],
        "3 Years": ["FY", "SY", "TY"],
        "4 Years": ["FY", "SY", "TY", "Final Year"],
        "5 Years": ["FY", "SY", "TY", "Fourth Year", "Final Year"]
    };

    return durationMap[duration] || ["FY"];
};
