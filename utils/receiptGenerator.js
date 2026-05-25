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
 * e.g., "4 Years" -> ["FY", "SY", "TY", "4Y"]
 *       "5 Years" -> ["FY", "SY", "TY", "4Y", "5Y"]
 */
const CANONICAL_YEAR_LABELS = ["FY", "SY", "TY", "4Y", "5Y"];

const getYearCountFromDuration = (duration) => {
    if (typeof duration === "number" && Number.isFinite(duration)) {
        const normalized = Math.trunc(duration);
        return normalized > 0 ? normalized : 1;
    }

    const raw = String(duration ?? "").trim();
    if (!raw) return 1;

    const matched = raw.match(/^(\d{1,2})\s*(?:Y|YEAR|YEARS)?$/i);
    if (matched) {
        const normalized = Number.parseInt(matched[1], 10);
        return Number.isFinite(normalized) && normalized > 0 ? normalized : 1;
    }

    const yearCountMap = {
        "1 YEAR": 1,
        "2 YEARS": 2,
        "3 YEARS": 3,
        "4 YEARS": 4,
        "5 YEARS": 5
    };

    return yearCountMap[raw.toUpperCase()] || 1;
};

export const normalizeAcademicYearLabel = (label, duration = null) => {
    const normalized = String(label || "").trim().toUpperCase().replace(/\s+/g, " ");
    const finalYearLabel = CANONICAL_YEAR_LABELS[getYearCountFromDuration(duration) - 1] || "FY";
    const aliasMap = {
        "FY": "FY",
        "FIRST YEAR": "FY",
        "SY": "SY",
        "SECOND YEAR": "SY",
        "TY": "TY",
        "THIRD YEAR": "TY",
        "4Y": "4Y",
        "Y4": "4Y",
        "YEAR 4": "4Y",
        "4TH": "4Y",
        "FOURTH": "4Y",
        "4TH YEAR": "4Y",
        "FOURTH YEAR": "4Y",
        "5Y": "5Y",
        "Y5": "5Y",
        "YEAR 5": "5Y",
        "5TH": "5Y",
        "FIFTH": "5Y",
        "5TH YEAR": "5Y",
        "FIFTH YEAR": "5Y"
    };

    if (normalized === "FINAL YEAR") {
        return finalYearLabel;
    }

    return aliasMap[normalized] || label;
};

export const normalizeFeeComponentName = (componentName, duration = null) => {
    const [rawYearLabel, ...rest] = String(componentName || "").split(" - ");
    const normalizedYearLabel = normalizeAcademicYearLabel(rawYearLabel, duration);

    if (!rest.length) {
        return normalizedYearLabel;
    }

    return `${normalizedYearLabel} - ${rest.join(" - ")}`;
};

export const getAcademicYearLabels = (duration) => {
    const yearCount = getYearCountFromDuration(duration);
    return CANONICAL_YEAR_LABELS.slice(0, yearCount);
};
