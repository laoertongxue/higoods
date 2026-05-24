const WHATSAPP_ERROR_MESSAGE = 'WhatsApp 格式不正确，请填写印尼手机号，例如 +6281234567890';
function sanitizeRawValue(value) {
    return value.trim();
}
function hasForbiddenCharacters(value) {
    return /[A-Za-z\u3400-\u9fff]/.test(value) || /[^0-9+\-\s()]/.test(value);
}
export function normalizeWhatsApp(value) {
    const raw = sanitizeRawValue(value);
    if (!raw || hasForbiddenCharacters(raw))
        return raw;
    const compact = raw.replace(/[\s\-()]/g, '');
    if (!compact)
        return '';
    let digits = compact;
    if (digits.startsWith('+')) {
        if (!digits.startsWith('+62'))
            return raw;
        digits = digits.slice(1);
    }
    if (digits.startsWith('0')) {
        digits = `62${digits.slice(1)}`;
    }
    if (!digits.startsWith('62'))
        return raw;
    const localDigits = digits.slice(2);
    if (localDigits.length < 9 || localDigits.length > 15)
        return raw;
    return `+${digits}`;
}
export function validateWhatsApp(value) {
    const raw = sanitizeRawValue(value);
    if (!raw) {
        return { isValid: false, normalized: '', errorMessage: WHATSAPP_ERROR_MESSAGE };
    }
    if (hasForbiddenCharacters(raw)) {
        return { isValid: false, normalized: raw, errorMessage: WHATSAPP_ERROR_MESSAGE };
    }
    const normalized = normalizeWhatsApp(raw);
    if (!normalized.startsWith('+62')) {
        return { isValid: false, normalized: raw, errorMessage: WHATSAPP_ERROR_MESSAGE };
    }
    const digits = normalized.slice(1);
    const localDigits = digits.slice(2);
    if (localDigits.length < 9 || localDigits.length > 15) {
        return { isValid: false, normalized, errorMessage: WHATSAPP_ERROR_MESSAGE };
    }
    return { isValid: true, normalized, errorMessage: '' };
}
export function formatWhatsAppForDisplay(value) {
    const result = validateWhatsApp(value);
    return result.isValid ? result.normalized : sanitizeRawValue(value);
}
export function getWhatsAppErrorMessage() {
    return WHATSAPP_ERROR_MESSAGE;
}
