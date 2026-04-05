"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTripleAWebhookController = handleTripleAWebhookController;
const node_crypto_1 = require("node:crypto");
const TripleAService_1 = require("../services/TripleAService");
async function handleTripleAWebhookController(request, response) {
    const signature = request.get("Triplea-Signature");
    const rawBody = request.rawBody;
    if (!rawBody) {
        response.status(400).json({
            message: "Raw request body is required for signature verification.",
        });
        return;
    }
    if (!signature) {
        response.status(401).json({
            message: "Missing Triplea-Signature header.",
        });
        return;
    }
    try {
        const notifySecret = getNotifySecret();
        if (!isValidSignature(rawBody, signature, notifySecret)) {
            response.status(401).json({
                message: "Invalid Triple-A webhook signature.",
            });
            return;
        }
        const result = await TripleAService_1.tripleAService.handleWebhook(request.body);
        response.status(200).json({
            received: true,
            processed: result.processed,
            transactionId: result.transactionId,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Webhook processing failed.";
        const statusCode = getErrorStatusCode(message);
        response.status(statusCode).json({ message });
    }
}
function getErrorStatusCode(message) {
    if (message.includes("not configured")) {
        return 500;
    }
    if (message.includes("was not found")) {
        return 404;
    }
    if (message.includes("cannot be completed")) {
        return 409;
    }
    return 400;
}
function getNotifySecret() {
    const notifySecret = process.env.TRIPLEA_NOTIFY_SECRET ??
        process.env.NOTIFY_SECRET ??
        process.env.notify_secret;
    if (!notifySecret?.trim()) {
        throw new Error("TRIPLEA_NOTIFY_SECRET is not configured.");
    }
    return notifySecret.trim();
}
function isValidSignature(rawBody, signatureHeader, notifySecret) {
    const normalizedSignature = signatureHeader.trim().replace(/^sha256=/i, "");
    const hexDigest = (0, node_crypto_1.createHmac)("sha256", notifySecret)
        .update(rawBody, "utf8")
        .digest("hex");
    const base64Digest = (0, node_crypto_1.createHmac)("sha256", notifySecret)
        .update(rawBody, "utf8")
        .digest("base64");
    return (safeCompare(normalizedSignature, hexDigest) ||
        safeCompare(normalizedSignature, base64Digest));
}
function safeCompare(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
}
