export const normalizeApplicationId = (value = "") =>
    String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .trim();

const normalizeOcrText = (value = "") =>
    String(value || "")
        .toUpperCase()
        .replace(/[|]/g, "I")
        .replace(/[“”"]/g, "")
        .replace(/[‘’']/g, "")
        .replace(/[—–_]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

const buildOcrFriendlyVariants = (value = "") => {
    const normalized = normalizeApplicationId(value);
    const variants = new Set([normalized]);

    if (!normalized) return [...variants];

    variants.add(normalized.replace(/0/g, "O"));
    variants.add(normalized.replace(/O/g, "0"));
    variants.add(normalized.replace(/1/g, "I"));
    variants.add(normalized.replace(/I/g, "1"));
    variants.add(normalized.replace(/5/g, "S"));
    variants.add(normalized.replace(/S/g, "5"));
    variants.add(normalized.replace(/8/g, "B"));
    variants.add(normalized.replace(/B/g, "8"));

    return [...variants];
};

export const getAcademicCycle = (date = new Date()) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startYear = month < 6 ? year - 1 : year;
    return `${startYear}-${startYear + 1}`;
};

export const extractApplicationIdFromPdfText = (text = "") => {
    if (!text || typeof text !== "string") return null;

    const normalizedText = normalizeOcrText(text);
    const compactText = normalizedText.replace(/\s+/g, "");

    const labelPatterns = [
        /application\s*(?:id|no|number)\s*[:\-]?\s*([A-Z]{2,}[0-9]{4,10})/i,
        /app(?:lication)?\s*(?:id|no|number)\s*[:\-]?\s*([A-Z]{2,}[0-9]{4,10})/i,
        /applicationid[:\-]?([A-Z]{2,}[0-9]{4,10})/i
    ];

    for (const pattern of labelPatterns) {
        const labelMatch = normalizedText.match(pattern) || compactText.match(pattern);
        if (labelMatch?.[1]) {
            const extracted = normalizeApplicationId(labelMatch[1]);
            if (extracted.length >= 6) {
                return extracted;
            }
        }
    }

    const genericTokens = normalizedText.match(/[A-Z]{2,}[A-Z0-9]{3,29}/g) || [];
    const candidate = genericTokens
        .map(normalizeApplicationId)
        .find((token) => /[A-Z]/.test(token) && /\d/.test(token) && token.length >= 6);

    return candidate || null;
};

export const textContainsApplicationId = (text = "", applicationId = "") => {
    if (!text || !applicationId) return false;
    
    const normalizedText = normalizeOcrText(text).replace(/\s+/g, "");
    const targetId = normalizeApplicationId(applicationId);
    
    const variants = buildOcrFriendlyVariants(targetId);
    return variants.some((variant) => variant && normalizedText.includes(variant));
};

export const getCategoryCandidates = (category = "") => {
    const raw = String(category || "").trim();
    const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const set = new Set();

    if (raw) set.add(raw);

    if (["VJA", "NTA", "NTA", "NTB", "NTC", "NTD", "SBC", "VJNT", "DT", "NT"].some((token) => normalized.includes(token))) {
        set.add("VJ / DT / NT / SBC");
        set.add("VJ/DT/NT/SBC");
        set.add("VJ DT NT SBC");
    }

    if (normalized.includes("SC") || normalized.includes("ST")) {
        set.add("SC / ST");
        set.add("SC/ST");
        set.add("SCST");
    }

    if (normalized.includes("OBC")) {
        set.add("OBC");
    }

    if (normalized.includes("EBC") || normalized.includes("EWS")) {
        set.add("Open (EBC)");
        set.add("EBC");
        set.add("EWS");
    }

    if (normalized.includes("OPEN") || normalized.includes("GENERAL") || normalized.includes("EBC")) {
        set.add("General");
        set.add("Open");
        set.add("OPEN");
    }

    return [...set];
};
