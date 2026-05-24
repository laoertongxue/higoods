import { parsePartTemplateFiles, resolveTemplateFilePair, suggestStandardPartName, } from '../../utils/pcs-part-template-parser.ts';
function normalizeText(value) {
    return String(value || '').trim();
}
function parsePositiveInteger(value) {
    const normalized = normalizeText(value);
    if (!normalized)
        return null;
    if (!/^\d+$/.test(normalized))
        return null;
    const numeric = Number.parseInt(normalized, 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}
function buildRowName(part) {
    const suggestedName = normalizeText(suggestStandardPartName(part));
    const sourcePartName = normalizeText(part.sourcePartName);
    const systemPieceName = normalizeText(part.systemPieceName);
    const resolvedName = suggestedName || sourcePartName || systemPieceName;
    return {
        name: resolvedName,
        missingName: !resolvedName,
    };
}
function buildRowNote(part) {
    return [normalizeText(part.annotation), normalizeText(part.category), normalizeText(part.parserStatus)]
        .filter(Boolean)
        .join('｜');
}
function mapPartToRow(part, index) {
    const { name, missingName } = buildRowName(part);
    const parsedCount = parsePositiveInteger(part.quantity);
    const missingCount = parsedCount === null;
    return {
        id: `parsed-piece-${index + 1}`,
        name,
        count: parsedCount ?? 0,
        note: buildRowNote(part),
        colorAllocations: [],
        specialCrafts: [],
        sourceType: 'PARSED_PATTERN',
        sourcePartName: normalizeText(part.sourcePartName) || undefined,
        systemPieceName: normalizeText(part.systemPieceName) || undefined,
        candidatePartNames: (part.candidatePartNames ?? []).map((item) => normalizeText(item)).filter(Boolean),
        sizeCode: normalizeText(part.sizeCode) || undefined,
        parsedQuantity: parsedCount ?? undefined,
        quantityText: normalizeText(part.quantity) || undefined,
        annotation: normalizeText(part.annotation) || undefined,
        category: normalizeText(part.category) || undefined,
        width: part.metrics?.width,
        height: part.metrics?.height,
        area: part.metrics?.area,
        perimeter: part.metrics?.perimeter,
        geometryHash: normalizeText(part.geometryHash) || undefined,
        previewSvg: normalizeText(part.previewSvg) || undefined,
        parserStatus: part.parserStatus,
        machineReadyStatus: part.machineReadyStatus,
        rawTextLabels: (part.rawTextLabels ?? []).map((item) => normalizeText(item)).filter(Boolean),
        missingName,
        missingCount,
    };
}
export function resolveFcsPatternFilePair(filesLike) {
    return resolveTemplateFilePair(filesLike);
}
export async function parseFcsPatternFilePair(params) {
    const parsed = await parsePartTemplateFiles({
        templateName: params.patternName,
        dxfFile: params.dxfFile,
        rulFile: params.rulFile,
    });
    return {
        patternName: parsed.templateName,
        dxfFileName: parsed.dxfFileName,
        rulFileName: parsed.rulFileName,
        parsedAt: parsed.parsedAt,
        dxfEncoding: parsed.dxfEncoding,
        rulEncoding: parsed.rulEncoding,
        sizeList: [...(parsed.rul.sizeList ?? [])],
        sampleSize: normalizeText(parsed.rul.sampleSize) || undefined,
        pieceRows: parsed.parts.map((part, index) => mapPartToRow(part, index)),
    };
}
