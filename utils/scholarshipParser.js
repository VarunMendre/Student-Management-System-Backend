export const normalizeApplicationId = (value = "") =>
    String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .trim();

export const getAcademicCycle = (date = new Date()) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startYear = month < 6 ? year - 1 : year;
    return `${startYear}-${startYear + 1}`;
};

export const extractApplicationIdFromPdfText = (text = "") => {
    if (!text || typeof text !== "string") return null;

    const labelPattern = /application\s*(?:id|no|number)\s*[:\-]?\s*([A-Z0-9]{6,30})/i;
    const labelMatch = text.match(labelPattern);
    if (labelMatch?.[1]) {
        return normalizeApplicationId(labelMatch[1]);
    }

    const genericTokens = text.match(/[A-Z]{2,}[A-Z0-9]{3,29}/g) || [];
    const candidate = genericTokens
        .map(normalizeApplicationId)
        .find((token) => /[A-Z]/.test(token) && /\d/.test(token) && token.length >= 6);

    return candidate || null;
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

    if (normalized.includes("OPEN") || normalized.includes("GENERAL")) {
        set.add("OPEN");
        set.add("Open");
        set.add("General");
        set.add("General / Open");
    }

    return [...set];
};
