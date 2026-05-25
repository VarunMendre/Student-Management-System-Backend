export const logSecurityEvent = (eventType, req, metadata = {}) => {
    const payload = {
        eventType,
        timestamp: new Date().toISOString(),
        requestId: req?.requestId || null,
        method: req?.method || null,
        path: req?.originalUrl || req?.url || null,
        ip: req?.ip || req?.socket?.remoteAddress || null,
        userId: req?.user?.userId || null,
        userRole: req?.user?.role || null,
        ...metadata
    };

    console.warn("[SECURITY_EVENT]", JSON.stringify(payload));
};
