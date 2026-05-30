export const STUDENT_CASTE_CATEGORIES = [
    "SC/ST",
    "VJNT",
    "OBC",
    "EBC",
    "OPEN"
];

export const STUDENT_GENDERS = ["Male", "Female", "Other"];

export const STUDENT_ENROLLMENT_STATUSES = ["Active", "Inactive", "Graduated", "Dropped"];

export const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
export const normalizePhone = (value = "") => String(value || "").replace(/\D/g, "");
export const normalizeText = (value = "") => String(value || "").trim().replace(/\s+/g, " ");

export const getStudentMetadataOptions = () => ({
    caste_categories: STUDENT_CASTE_CATEGORIES,
    genders: STUDENT_GENDERS,
    enrollment_statuses: STUDENT_ENROLLMENT_STATUSES
});
