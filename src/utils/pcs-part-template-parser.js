import { buildGeometryHashFromSignature, buildPartGeometryAnalysis, } from './pcs-part-template-geometry';
import { buildPartShapeDescription, } from './pcs-part-template-shape-description';
const SUPPORTED_ENCODINGS = ['utf-8', 'gb18030', 'gbk'];
const DXF_MARKERS = ['SECTION', 'BLOCKS', 'BLOCK', 'ENDBLK', 'POLYLINE', 'VERTEX'];
const RUL_MARKERS = ['AUTHOR', 'UNITS', 'SIZE LIST', 'SAMPLE SIZE', 'RULE: DELTA'];
const SYSTEM_TEXT_PREFIXES = [
    'piece name:',
    'size:',
    'annotation:',
    'quantity:',
    'category:',
];
export const PART_TEMPLATE_STANDARD_NAME_OPTIONS = [
    '领子',
    '上领',
    '下领',
    '立领',
    '袖口',
    '前片',
    '后片',
    '袖片',
    '门襟',
    '袋布',
    '口袋',
    '领座',
    '下摆',
    '肩片',
    '裤前片',
    '裤后片',
];
function roundMetric(value, digits = 1) {
    if (!Number.isFinite(value))
        return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
function normalizeWhitespace(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function normalizeComparisonText(value) {
    return value
        .toLowerCase()
        .replace(/[\s_\-./\\()[\]{}，。:：;；、]+/g, '')
        .trim();
}
function countMatches(text, pattern) {
    return text.match(pattern)?.length ?? 0;
}
function scoreDecodedText(text, kind) {
    const normalized = text.toUpperCase();
    const markers = kind === 'dxf' ? DXF_MARKERS : RUL_MARKERS;
    const markerHitCount = markers.filter((marker) => normalized.includes(marker)).length;
    const replacementCount = countMatches(text, /\uFFFD/g);
    const controlCount = countMatches(text, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
    const garbleCount = countMatches(text, /[ÃÂÕÐÊÆ]{1,3}/g);
    const cjkCount = countMatches(text, /[\u4E00-\u9FFF]/g);
    let score = 0;
    score += replacementCount * 24;
    score += controlCount * 10;
    score += garbleCount * 6;
    score -= markerHitCount * 14;
    score -= Math.min(cjkCount, 60);
    if (kind === 'dxf' && markerHitCount < 4)
        score += 240;
    if (kind === 'rul' && markerHitCount < 3)
        score += 140;
    return score;
}
async function decodeTemplateFile(file, kind) {
    const buffer = await file.arrayBuffer();
    let bestResult = null;
    for (const encoding of SUPPORTED_ENCODINGS) {
        try {
            const text = new TextDecoder(encoding).decode(buffer);
            const score = scoreDecodedText(text, kind);
            if (!bestResult || score < bestResult.score) {
                bestResult = { text, encoding, score };
            }
        }
        catch {
            // Ignore unsupported decoders and continue with the next fallback.
        }
    }
    if (!bestResult) {
        throw new Error(`无法读取${kind.toUpperCase()}文件编码，请重新选择文件。`);
    }
    return {
        text: bestResult.text.replace(/\u0000/g, ''),
        encoding: bestResult.encoding,
    };
}
function getFileExtension(fileName) {
    const match = /\.([^.]+)$/.exec(fileName);
    return match ? match[1].toLowerCase() : '';
}
export function resolveTemplateFilePair(filesLike) {
    const files = Array.from(filesLike ?? []);
    if (files.length === 0) {
        return null;
    }
    if (files.length !== 2) {
        throw new Error('必须同时上传 1 个 DXF 和 1 个 RUL 文件');
    }
    const dxfFiles = files.filter((file) => getFileExtension(file.name) === 'dxf');
    const rulFiles = files.filter((file) => getFileExtension(file.name) === 'rul');
    if (dxfFiles.length === 1 && rulFiles.length === 1) {
        return {
            dxfFile: dxfFiles[0],
            rulFile: rulFiles[0],
        };
    }
    if (dxfFiles.length === 2 || rulFiles.length === 2) {
        throw new Error('文件类型不正确，必须是 1 个 .dxf + 1 个 .rul 文件');
    }
    throw new Error('文件类型不正确，必须是 1 个 .dxf + 1 个 .rul 文件');
}
function extractFieldValue(line) {
    const matched = /^[^:]+:\s*(.*)$/.exec(line);
    return normalizeWhitespace(matched?.[1] ?? '');
}
function splitSizeList(value) {
    return value
        .split(/[,/|，\s]+/)
        .map((item) => normalizeWhitespace(item.replace(/^[\[\]()]+|[\[\]()]+$/g, '')))
        .filter(Boolean);
}
function isRulHeader(line) {
    const normalized = line.toUpperCase();
    return (normalized.startsWith('AUTHOR') ||
        normalized.startsWith('CREATION DATE') ||
        normalized.startsWith('UNITS') ||
        normalized.startsWith('GRADING RULE TABLE') ||
        normalized.startsWith('NUMBER OF SIZES') ||
        normalized.startsWith('SIZE LIST') ||
        normalized.startsWith('SAMPLE SIZE') ||
        normalized.startsWith('RULE: DELTA'));
}
export function parseRulText(text) {
    const lines = text
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean);
    const result = {
        sizeList: [],
        deltaRules: [],
        rawText: text,
    };
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const upper = line.toUpperCase();
        if (upper.startsWith('AUTHOR')) {
            result.author = extractFieldValue(line);
            continue;
        }
        if (upper.startsWith('CREATION DATE')) {
            result.creationDate = extractFieldValue(line);
            continue;
        }
        if (upper.startsWith('UNITS')) {
            result.units = extractFieldValue(line);
            continue;
        }
        if (upper.startsWith('GRADING RULE TABLE')) {
            const value = extractFieldValue(line) || lines[index + 1] || '';
            result.gradingRuleTable = normalizeWhitespace(value);
            continue;
        }
        if (upper.startsWith('NUMBER OF SIZES')) {
            const value = Number.parseInt(extractFieldValue(line), 10);
            result.numberOfSizes = Number.isNaN(value) ? undefined : value;
            continue;
        }
        if (upper.startsWith('SIZE LIST')) {
            result.sizeList = splitSizeList(extractFieldValue(line));
            continue;
        }
        if (upper.startsWith('SAMPLE SIZE')) {
            result.sampleSize = extractFieldValue(line);
            continue;
        }
        const deltaMatch = /^RULE:\s*DELTA\s+(\d+)/i.exec(line);
        if (deltaMatch) {
            const rawLines = [line];
            const deltaIndex = Number.parseInt(deltaMatch[1], 10);
            let cursor = index + 1;
            while (cursor < lines.length && !isRulHeader(lines[cursor])) {
                rawLines.push(lines[cursor]);
                cursor += 1;
            }
            result.deltaRules.push({
                index: Number.isNaN(deltaIndex) ? result.deltaRules.length + 1 : deltaIndex,
                title: `RULE: DELTA ${deltaMatch[1]}`,
                rawLines,
            });
            index = cursor - 1;
        }
    }
    if (result.sizeList.length === 0 && result.sampleSize) {
        result.sizeList = [result.sampleSize];
    }
    return result;
}
function parseNumeric(value) {
    const normalized = value.trim();
    if (!normalized)
        return undefined;
    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) ? numeric : undefined;
}
function buildDxfPairs(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    if (lines.length < 4) {
        throw new Error('当前仅支持 ET 样本所使用的文本型 DXF，暂不支持该文件格式');
    }
    if (lines.length % 2 !== 0) {
        lines.push('');
    }
    const pairs = [];
    let invalidCodeCount = 0;
    for (let index = 0; index < lines.length; index += 2) {
        const codeLine = (index === 0 ? lines[index].replace(/^\uFEFF/, '') : lines[index]).trim();
        const code = Number.parseInt(codeLine, 10);
        if (Number.isNaN(code)) {
            invalidCodeCount += 1;
            continue;
        }
        pairs.push({
            code,
            value: normalizeWhitespace(lines[index + 1] ?? ''),
        });
    }
    if (pairs.length === 0 || invalidCodeCount > pairs.length / 2) {
        throw new Error('当前仅支持 ET 样本所使用的文本型 DXF，暂不支持该文件格式');
    }
    const normalized = pairs.map((pair) => `${pair.code}:${pair.value.toUpperCase()}`);
    const hasSections = normalized.some((item) => item === '0:SECTION');
    const hasBlocks = normalized.some((item) => item === '2:BLOCKS') || normalized.some((item) => item === '0:BLOCK');
    const hasPolyline = normalized.some((item) => item === '0:POLYLINE');
    if (!hasSections || !hasBlocks || !hasPolyline) {
        throw new Error('当前仅支持 ET 样本所使用的文本型 DXF，暂不支持该文件格式');
    }
    return pairs;
}
function getLayer(value) {
    return normalizeWhitespace(value ?? '') || '0';
}
function parseSimpleEntityPairs(pairs, startIndex, handler) {
    const entity = {};
    let index = startIndex + 1;
    while (index < pairs.length) {
        const pair = pairs[index];
        if (pair.code === 0)
            break;
        handler(pair, entity);
        index += 1;
    }
    return { entity, nextIndex: index };
}
function parseTextEntity(pairs, startIndex) {
    const parsed = parseSimpleEntityPairs(pairs, startIndex, (pair, entity) => {
        entity[String(pair.code)] = pair.value;
    });
    const text = normalizeWhitespace([parsed.entity['1'], parsed.entity['3']]
        .filter(Boolean)
        .join(' ')
        .trim());
    return {
        entity: {
            type: 'TEXT',
            layer: getLayer(parsed.entity['8']),
            text,
            position: parseNumeric(parsed.entity['10']) !== undefined && parseNumeric(parsed.entity['20']) !== undefined
                ? {
                    x: parseNumeric(parsed.entity['10']) ?? 0,
                    y: parseNumeric(parsed.entity['20']) ?? 0,
                }
                : undefined,
        },
        nextIndex: parsed.nextIndex,
    };
}
function parseLineEntity(pairs, startIndex) {
    const parsed = parseSimpleEntityPairs(pairs, startIndex, (pair, entity) => {
        entity[String(pair.code)] = pair.value;
    });
    return {
        entity: {
            type: 'LINE',
            layer: getLayer(parsed.entity['8']),
            start: {
                x: parseNumeric(parsed.entity['10']) ?? 0,
                y: parseNumeric(parsed.entity['20']) ?? 0,
            },
            end: {
                x: parseNumeric(parsed.entity['11']) ?? 0,
                y: parseNumeric(parsed.entity['21']) ?? 0,
            },
        },
        nextIndex: parsed.nextIndex,
    };
}
function parsePointEntity(pairs, startIndex) {
    const parsed = parseSimpleEntityPairs(pairs, startIndex, (pair, entity) => {
        entity[String(pair.code)] = pair.value;
    });
    return {
        entity: {
            type: 'POINT',
            layer: getLayer(parsed.entity['8']),
            point: {
                x: parseNumeric(parsed.entity['10']) ?? 0,
                y: parseNumeric(parsed.entity['20']) ?? 0,
            },
        },
        nextIndex: parsed.nextIndex,
    };
}
function parseInsertEntity(pairs, startIndex) {
    const parsed = parseSimpleEntityPairs(pairs, startIndex, (pair, entity) => {
        entity[String(pair.code)] = pair.value;
    });
    return {
        entity: {
            type: 'INSERT',
            layer: getLayer(parsed.entity['8']),
            name: normalizeWhitespace(parsed.entity['2'] ?? ''),
        },
        nextIndex: parsed.nextIndex,
    };
}
function isSamePoint(a, b) {
    return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}
function dedupeClosedPoints(points) {
    if (points.length < 2)
        return points;
    if (!isSamePoint(points[0], points[points.length - 1]))
        return points;
    return points.slice(0, -1);
}
function isClosedByDistance(points) {
    if (points.length < 3)
        return false;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const maxDimension = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
    return Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) <= maxDimension * 0.005;
}
function computePerimeter(points, closed = true) {
    if (points.length < 2)
        return 0;
    let total = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        total += Math.hypot(next.x - current.x, next.y - current.y);
    }
    if (closed) {
        const first = points[0];
        const last = points[points.length - 1];
        total += Math.hypot(first.x - last.x, first.y - last.y);
    }
    return total;
}
function computeArea(points) {
    if (points.length < 3)
        return 0;
    let sum = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        sum += current.x * next.y - next.x * current.y;
    }
    return Math.abs(sum / 2);
}
function computeBoundaryMetrics(points) {
    if (points.length === 0) {
        return { width: 0, height: 0, area: 0, perimeter: 0 };
    }
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    return {
        width: roundMetric(width),
        height: roundMetric(height),
        area: roundMetric(computeArea(points), 2),
        perimeter: roundMetric(computePerimeter(points), 2),
    };
}
function parseVertexPoint(pairs, startIndex) {
    const parsed = parseSimpleEntityPairs(pairs, startIndex, (pair, entity) => {
        entity[String(pair.code)] = pair.value;
    });
    return {
        point: {
            x: parseNumeric(parsed.entity['10']) ?? 0,
            y: parseNumeric(parsed.entity['20']) ?? 0,
        },
        nextIndex: parsed.nextIndex,
    };
}
function parsePolylineEntity(pairs, startIndex) {
    const header = {};
    let index = startIndex + 1;
    while (index < pairs.length) {
        const pair = pairs[index];
        if (pair.code === 0)
            break;
        header[String(pair.code)] = pair.value;
        index += 1;
    }
    const layer = getLayer(header['8']);
    const flags = Number.parseInt(header['70'] ?? '0', 10) || 0;
    const points = [];
    while (index < pairs.length) {
        const pair = pairs[index];
        if (pair.code !== 0) {
            index += 1;
            continue;
        }
        if (pair.value === 'VERTEX') {
            const vertex = parseVertexPoint(pairs, index);
            points.push(vertex.point);
            index = vertex.nextIndex;
            continue;
        }
        if (pair.value === 'SEQEND') {
            index += 1;
            break;
        }
        break;
    }
    const cleanedPoints = dedupeClosedPoints(points);
    const closed = Boolean(flags & 1) ||
        (cleanedPoints.length > 2 &&
            (isSamePoint(points[0], points[points.length - 1]) || isClosedByDistance(points)));
    return {
        entity: {
            type: 'POLYLINE',
            layer,
            closed,
            points: cleanedPoints,
        },
        nextIndex: index,
    };
}
function parseBlock(pairs, startIndex, blockIndex) {
    let index = startIndex + 1;
    let blockName = '';
    while (index < pairs.length) {
        const pair = pairs[index];
        if (pair.code === 0)
            break;
        if (pair.code === 2 && !blockName)
            blockName = normalizeWhitespace(pair.value);
        index += 1;
    }
    const entities = [];
    while (index < pairs.length) {
        const pair = pairs[index];
        if (pair.code !== 0) {
            index += 1;
            continue;
        }
        if (pair.value === 'ENDBLK') {
            index += 1;
            break;
        }
        if (pair.value === 'POLYLINE') {
            const parsed = parsePolylineEntity(pairs, index);
            entities.push(parsed.entity);
            index = parsed.nextIndex;
            continue;
        }
        if (pair.value === 'LINE') {
            const parsed = parseLineEntity(pairs, index);
            entities.push(parsed.entity);
            index = parsed.nextIndex;
            continue;
        }
        if (pair.value === 'POINT') {
            const parsed = parsePointEntity(pairs, index);
            entities.push(parsed.entity);
            index = parsed.nextIndex;
            continue;
        }
        if (pair.value === 'TEXT') {
            const parsed = parseTextEntity(pairs, index);
            entities.push(parsed.entity);
            index = parsed.nextIndex;
            continue;
        }
        if (pair.value === 'INSERT') {
            const parsed = parseInsertEntity(pairs, index);
            entities.push(parsed.entity);
            index = parsed.nextIndex;
            continue;
        }
        index += 1;
    }
    return {
        block: {
            index: blockIndex,
            name: blockName || `BLOCK-${blockIndex}`,
            entities,
        },
        nextIndex: index,
    };
}
function bboxFromPoints(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
    };
}
function toBoundary(polyline) {
    if (!polyline.closed || polyline.points.length < 3)
        return undefined;
    const metrics = computeBoundaryMetrics(polyline.points);
    if (metrics.area <= 0)
        return undefined;
    return {
        layer: polyline.layer,
        closed: true,
        points: polyline.points,
        metrics,
    };
}
function isPointInsideBoundary(point, boundary) {
    let inside = false;
    for (let index = 0, previousIndex = boundary.points.length - 1; index < boundary.points.length; previousIndex = index, index += 1) {
        const current = boundary.points[index];
        const previous = boundary.points[previousIndex];
        const intersects = current.y > point.y !== previous.y > point.y &&
            point.x <
                ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || Number.MIN_VALUE) + current.x;
        if (intersects)
            inside = !inside;
    }
    return inside;
}
function selectOuterBoundary(boundaries) {
    if (boundaries.length === 0)
        return undefined;
    const preferred = boundaries
        .filter((boundary) => boundary.layer === '1')
        .sort((left, right) => right.metrics.area - left.metrics.area);
    if (preferred.length > 0)
        return preferred[0];
    return [...boundaries].sort((left, right) => right.metrics.area - left.metrics.area)[0];
}
function selectInnerBoundaries(boundaries, outerBoundary) {
    if (!outerBoundary)
        return [];
    const layerPreferred = boundaries
        .filter((boundary) => boundary !== outerBoundary &&
        boundary.layer === '14' &&
        boundary.metrics.area < outerBoundary.metrics.area &&
        isPointInsideBoundary(boundary.points[0], outerBoundary))
        .sort((left, right) => right.metrics.area - left.metrics.area);
    if (layerPreferred.length > 0) {
        return layerPreferred;
    }
    return boundaries
        .filter((boundary) => boundary !== outerBoundary &&
        boundary.metrics.area < outerBoundary.metrics.area &&
        isPointInsideBoundary(boundary.points[0], outerBoundary))
        .sort((left, right) => right.metrics.area - left.metrics.area);
}
function renderBoundaryPath(points, transform) {
    if (points.length === 0)
        return '';
    const transformed = points.map(transform);
    return [
        `M ${roundMetric(transformed[0].x, 2)} ${roundMetric(transformed[0].y, 2)}`,
        ...transformed.slice(1).map((point) => `L ${roundMetric(point.x, 2)} ${roundMetric(point.y, 2)}`),
        'Z',
    ].join(' ');
}
export function buildPartPreviewSvg(outerBoundary, innerBoundary, grainLines = [], visualGuides, markerIdSeed = 'part-template') {
    const pointCloud = [
        ...(outerBoundary?.points ?? []),
        ...(innerBoundary?.points ?? []),
        ...grainLines.flatMap((line) => [line.start, line.end]),
    ];
    if (pointCloud.length === 0)
        return undefined;
    const bbox = bboxFromPoints(pointCloud);
    const svgWidth = 220;
    const svgHeight = 160;
    const padding = 12;
    const width = Math.max(bbox.maxX - bbox.minX, 1);
    const height = Math.max(bbox.maxY - bbox.minY, 1);
    const scale = Math.min((svgWidth - padding * 2) / width, (svgHeight - padding * 2) / height);
    const transform = (point) => ({
        x: padding + (point.x - bbox.minX) * scale,
        y: svgHeight - padding - (point.y - bbox.minY) * scale,
    });
    const markerId = `grain-${markerIdSeed}`;
    const grainLinesSvg = grainLines
        .map((line) => {
        const start = transform(line.start);
        const end = transform(line.end);
        return `<line x1="${roundMetric(start.x, 2)}" y1="${roundMetric(start.y, 2)}" x2="${roundMetric(end.x, 2)}" y2="${roundMetric(end.y, 2)}" stroke="#2563eb" stroke-width="1.6" marker-end="url(#${markerId})" />`;
    })
        .join('');
    const principalAxisSvg = visualGuides?.principalAxis
        ? (() => {
            const start = transform(visualGuides.principalAxis.start);
            const end = transform(visualGuides.principalAxis.end);
            return `<line x1="${roundMetric(start.x, 2)}" y1="${roundMetric(start.y, 2)}" x2="${roundMetric(end.x, 2)}" y2="${roundMetric(end.y, 2)}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4" />`;
        })()
        : '';
    const majorArcSvg = visualGuides?.majorArcPaths
        ?.map((points) => points.length >= 2
        ? `<path d="${renderBoundaryPath(points, transform).replace(/ Z$/, '')}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" opacity="0.7" />`
        : '')
        .join('') ?? '';
    return [
        `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="h-full w-full" xmlns="http://www.w3.org/2000/svg">`,
        '<defs>',
        `<marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">`,
        '<path d="M0,0 L8,4 L0,8 Z" fill="#2563eb" />',
        '</marker>',
        '</defs>',
        '<rect width="100%" height="100%" fill="#f8fafc" rx="10" />',
        outerBoundary
            ? `<path d="${renderBoundaryPath(outerBoundary.points, transform)}" fill="rgba(59,130,246,0.08)" stroke="#1d4ed8" stroke-width="1.8" />`
            : '',
        innerBoundary
            ? `<path d="${renderBoundaryPath(innerBoundary.points, transform)}" fill="none" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 4" />`
            : '',
        majorArcSvg,
        principalAxisSvg,
        grainLinesSvg,
        '</svg>',
    ].join('');
}
function isUsefulCandidateText(text) {
    if (!text)
        return false;
    if (/^#\s*\d+$/i.test(text))
        return false;
    if (/^\d+$/.test(text))
        return false;
    if (/^[^a-zA-Z\u4E00-\u9FFF]+$/.test(text))
        return false;
    if (normalizeWhitespace(text).length < 2)
        return false;
    return !SYSTEM_TEXT_PREFIXES.some((prefix) => text.toLowerCase().startsWith(prefix));
}
function pickStandardPartName(values) {
    const normalizedValues = values.map(normalizeComparisonText);
    const rules = [
        { label: '立领', keywords: ['立领', 'standcollar'] },
        { label: '上领', keywords: ['上节领', '上领', 'kerahatas'] },
        { label: '下领', keywords: ['下节领', '下领', 'kerahbawah', 'kerahbbawah'] },
        { label: '袖口', keywords: ['袖口', 'manset', 'cuff'] },
        { label: '领子', keywords: ['衣领', '衬衣领', '领子', 'kerah'] },
        { label: '前片', keywords: ['前片', 'front'] },
        { label: '后片', keywords: ['后片', 'back'] },
        { label: '袖片', keywords: ['袖片', 'sleeve'] },
        { label: '门襟', keywords: ['门襟', 'placket'] },
        { label: '口袋', keywords: ['口袋', 'pocket'] },
    ];
    for (const rule of rules) {
        if (normalizedValues.some((value) => rule.keywords.some((keyword) => value.includes(keyword)))) {
            return rule.label;
        }
    }
    return undefined;
}
export function suggestStandardPartName(part) {
    const values = [
        part.sourcePartName,
        part.systemPieceName ?? '',
        part.sourceBlockName,
        ...part.candidatePartNames,
    ].filter(Boolean);
    return pickStandardPartName(values) ?? part.candidatePartNames[0] ?? part.systemPieceName ?? part.sourcePartName;
}
function blockToPartInstance(block) {
    const textEntities = block.entities.filter((entity) => entity.type === 'TEXT');
    const polylineEntities = block.entities.filter((entity) => entity.type === 'POLYLINE');
    const lineEntities = block.entities.filter((entity) => entity.type === 'LINE');
    const pointEntities = block.entities.filter((entity) => entity.type === 'POINT');
    const insertEntities = block.entities.filter((entity) => entity.type === 'INSERT');
    const rawTextLabels = textEntities.map((entity) => normalizeWhitespace(entity.text)).filter(Boolean);
    const candidatePartNames = [];
    const candidateSet = new Set();
    const issues = [];
    let systemPieceName;
    let sourceMarkerText;
    let sizeCode;
    let annotation;
    let quantity;
    let category;
    for (const text of rawTextLabels) {
        const lowerText = text.toLowerCase();
        if (lowerText.startsWith('piece name:')) {
            systemPieceName = normalizeWhitespace(text.slice(text.indexOf(':') + 1));
            continue;
        }
        if (lowerText.startsWith('size:')) {
            sizeCode = normalizeWhitespace(text.slice(text.indexOf(':') + 1));
            continue;
        }
        if (lowerText.startsWith('annotation:')) {
            annotation = normalizeWhitespace(text.slice(text.indexOf(':') + 1));
            continue;
        }
        if (lowerText.startsWith('quantity:')) {
            quantity = normalizeWhitespace(text.slice(text.indexOf(':') + 1));
            continue;
        }
        if (lowerText.startsWith('category:')) {
            category = normalizeWhitespace(text.slice(text.indexOf(':') + 1));
            continue;
        }
        if (!sourceMarkerText && /^#\s*\d+$/i.test(text)) {
            sourceMarkerText = text;
            continue;
        }
        if (isUsefulCandidateText(text) && !candidateSet.has(text)) {
            candidateSet.add(text);
            candidatePartNames.push(text);
        }
    }
    const boundaries = polylineEntities.map(toBoundary).filter(Boolean);
    const outerBoundary = selectOuterBoundary(boundaries);
    const innerBoundaries = selectInnerBoundaries(boundaries, outerBoundary);
    const innerBoundary = innerBoundaries[0];
    const grainLines = lineEntities.filter((entity) => entity.layer === '7');
    const pointLayerStats = pointEntities.reduce((stats, entity) => {
        stats[entity.layer] = (stats[entity.layer] ?? 0) + 1;
        return stats;
    }, {});
    const sourcePartName = candidatePartNames[0] ?? systemPieceName ?? block.name;
    const geometryAnalysis = buildPartGeometryAnalysis({
        outerBoundary,
        innerBoundary,
        innerBoundaryCount: innerBoundaries.length,
        grainLines,
        outerBoundaryCount: outerBoundary ? 1 : 0,
        pointCount: outerBoundary?.points.length ?? 0,
    });
    const metrics = outerBoundary?.metrics;
    const geometryHash = geometryAnalysis?.geometryHash ??
        (outerBoundary ? buildGeometryHashFromSignature(`${outerBoundary.layer}|${outerBoundary.metrics.width}|${outerBoundary.metrics.height}`) : undefined);
    const previewSvg = buildPartPreviewSvg(outerBoundary, innerBoundary, grainLines, geometryAnalysis?.visualGuides, geometryHash ?? block.name);
    const standardPartName = pickStandardPartName([sourcePartName, systemPieceName ?? '', block.name, ...candidatePartNames]);
    const parserStatus = outerBoundary && standardPartName
        ? '解析成功'
        : outerBoundary
            ? '待人工矫正'
            : '解析异常';
    const shapeDescription = geometryAnalysis ? buildPartShapeDescription(geometryAnalysis.features) : null;
    const machineReadyStatus = !outerBoundary || !geometryAnalysis
        ? '不适用'
        : shapeDescription?.templateMachineSuitability === 'high'
            ? '可模板机处理'
            : shapeDescription?.templateMachineSuitability === 'medium'
                ? '待评估'
                : '不适用';
    if (!outerBoundary) {
        issues.push('未识别到可用外轮廓');
    }
    if (innerBoundaries.length > 0 && innerBoundary?.layer !== '14') {
        issues.push('未识别到 layer 14 的主内轮廓，已按内部闭合轮廓回退');
    }
    if (grainLines.length === 0) {
        issues.push('未识别到布纹线，推荐人工确认纹向');
    }
    return {
        sourceBlockIndex: block.index,
        sourceBlockName: block.name,
        sourcePartName,
        sourceMarkerText,
        systemPieceName,
        candidatePartNames,
        sizeCode,
        annotation,
        quantity,
        category,
        outerBoundary,
        innerBoundary,
        grainLines: grainLines.map((line) => ({
            layer: line.layer,
            start: line.start,
            end: line.end,
        })),
        pointLayerStats,
        metrics,
        geometryHash,
        normalizedShapeSignature: geometryAnalysis?.normalizedShapeSignature,
        previewSvg,
        geometryFeatures: geometryAnalysis?.features ?? null,
        shapeDescription,
        parserStatus,
        machineReadyStatus,
        issues,
        rawTextLabels,
        insertRefs: insertEntities.map((entity) => entity.name).filter(Boolean),
    };
}
export function parseDxfText(text) {
    const pairs = buildDxfPairs(text);
    const blocks = [];
    const topLevelInsertNames = [];
    let currentSection = '';
    let blockCounter = 0;
    for (let index = 0; index < pairs.length; index += 1) {
        const pair = pairs[index];
        if (pair.code === 0 && pair.value === 'SECTION') {
            const nextPair = pairs[index + 1];
            currentSection = nextPair?.code === 2 ? nextPair.value : '';
            continue;
        }
        if (pair.code === 0 && pair.value === 'ENDSEC') {
            currentSection = '';
            continue;
        }
        if (currentSection === 'BLOCKS' && pair.code === 0 && pair.value === 'BLOCK') {
            blockCounter += 1;
            const parsed = parseBlock(pairs, index, blockCounter);
            blocks.push(parsed.block);
            index = parsed.nextIndex - 1;
            continue;
        }
        if (currentSection === 'ENTITIES' && pair.code === 0 && pair.value === 'INSERT') {
            const parsed = parseInsertEntity(pairs, index);
            if (parsed.entity.name) {
                topLevelInsertNames.push(parsed.entity.name);
            }
            index = parsed.nextIndex - 1;
        }
    }
    const parts = blocks.map(blockToPartInstance).filter((part) => part.outerBoundary || part.rawTextLabels.length > 0);
    if (parts.length === 0) {
        throw new Error('当前 DXF 未解析出有效部位，请确认文件是文本型 ASCII DXF / AAMA 风格导出。');
    }
    return {
        rawText: text,
        parts,
        topLevelInsertNames,
    };
}
function stripFileExtension(fileName) {
    return fileName.replace(/\.[^.]+$/, '');
}
export async function parsePartTemplateFiles(params) {
    const parsedAt = new Date().toISOString();
    const templateName = normalizeWhitespace(params.templateName) || stripFileExtension(params.dxfFile.name);
    const [decodedDxf, decodedRul] = await Promise.all([
        decodeTemplateFile(params.dxfFile, 'dxf'),
        decodeTemplateFile(params.rulFile, 'rul'),
    ]);
    const rul = parseRulText(decodedRul.text);
    const dxf = parseDxfText(decodedDxf.text);
    return {
        templateName,
        dxfFileName: params.dxfFile.name,
        rulFileName: params.rulFile.name,
        parsedAt,
        dxfEncoding: decodedDxf.encoding,
        rulEncoding: decodedRul.encoding,
        rul,
        dxf,
        parts: dxf.parts,
    };
}
