const COURSE_DURATION_REGEX = /^(\d{1,2})\s*(?:Y|YEAR|YEARS)?$/i;

export const parseCourseDurationYears = (value, fallback = null) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        const normalized = Math.trunc(value);
        return normalized > 0 ? normalized : fallback;
    }

    const raw = String(value ?? "").trim();
    if (!raw) return fallback;

    const matched = raw.match(COURSE_DURATION_REGEX);
    if (!matched) return fallback;

    const normalized = Number.parseInt(matched[1], 10);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
};

export const formatCourseDuration = (value, fallback = "3 Years") => {
    const years = parseCourseDurationYears(value, null);
    if (!years) return fallback;
    return `${years} ${years === 1 ? "Year" : "Years"}`;
};
