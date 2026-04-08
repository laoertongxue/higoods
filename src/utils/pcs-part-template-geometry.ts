export interface PartTemplatePointLike {
  x: number
  y: number
}

export interface PartTemplateBoundaryLike {
  layer?: string
  points: PartTemplatePointLike[]
}

export interface PartTemplateLineLike {
  start: PartTemplatePointLike
  end: PartTemplatePointLike
}

export type PartCurvatureLevel = 'straight' | 'slight' | 'medium' | 'strong'
export type PartComplexityLevel = 'low' | 'medium' | 'high'

export interface PartGeometryFeatures {
  bboxWidth: number
  bboxHeight: number
  area: number
  perimeter: number
  aspectRatio: number

  symmetryScore: number
  taperRatio: number
  headWidth: number
  midWidth: number
  tailWidth: number

  curveRate: number
  straightRate: number
  cornerCount: number

  majorArcCount: number
  maxSagitta: number
  avgSagitta: number
  maxEstimatedRadius: number | null
  curvatureLevel: PartCurvatureLevel

  outerBoundaryCount: number
  innerBoundaryCount: number
  innerHoleCount: number
  grainLineCount: number
  grainLineAngle: number | null
  notchCountEstimate: number
  pointCount: number
  complexityLevel: PartComplexityLevel

  normalizedShapeSignature: string
}

export interface PartGeometryVisualGuides {
  principalAxis: { start: PartTemplatePointLike; end: PartTemplatePointLike } | null
  majorArcPaths: PartTemplatePointLike[][]
}

export interface PartGeometryAnalysisResult {
  features: PartGeometryFeatures
  normalizedShapeSignature: string
  geometryHash: string
  visualGuides: PartGeometryVisualGuides
}

interface RotatedPoint {
  x: number
  y: number
}

interface ArcSegment {
  points: PartTemplatePointLike[]
  sagitta: number
  estimatedRadius: number | null
  length: number
}

const SAMPLE_POINT_COUNT = 48
const WIDTH_SAMPLE_POSITIONS = [0.1, 0.5, 0.9] as const
const CURVE_VERTEX_MIN_ANGLE = (Math.PI / 180) * 4
const CURVE_VERTEX_MAX_ANGLE = (Math.PI / 180) * 36
const CORNER_ANGLE = (Math.PI / 180) * 38
const NOTCH_ANGLE = (Math.PI / 180) * 60
const CLOSE_DISTANCE_RATIO = 0.005
const SIGNATURE_PRECISION = 3
const ARC_LENGTH_RATIO = 0.08
const EPSILON = 1e-6

function roundMetric(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function distance(a: PartTemplatePointLike, b: PartTemplatePointLike): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function isSamePoint(a: PartTemplatePointLike, b: PartTemplatePointLike): boolean {
  return distance(a, b) <= EPSILON
}

function dot(a: PartTemplatePointLike, b: PartTemplatePointLike): number {
  return a.x * b.x + a.y * b.y
}

function cross(a: PartTemplatePointLike, b: PartTemplatePointLike): number {
  return a.x * b.y - a.y * b.x
}

function subtract(a: PartTemplatePointLike, b: PartTemplatePointLike): PartTemplatePointLike {
  return { x: a.x - b.x, y: a.y - b.y }
}

function rotate(point: PartTemplatePointLike, center: PartTemplatePointLike, angle: number): RotatedPoint {
  const translatedX = point.x - center.x
  const translatedY = point.y - center.y
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: translatedX * cos - translatedY * sin,
    y: translatedX * sin + translatedY * cos,
  }
}

function unrotate(point: RotatedPoint, center: PartTemplatePointLike, angle: number): PartTemplatePointLike {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: point.x * cos + point.y * -sin + center.x,
    y: point.x * sin + point.y * cos + center.y,
  }
}

function removeConsecutiveDuplicatePoints(points: PartTemplatePointLike[]): PartTemplatePointLike[] {
  const nextPoints: PartTemplatePointLike[] = []
  for (const point of points) {
    const previous = nextPoints[nextPoints.length - 1]
    if (!previous || !isSamePoint(previous, point)) {
      nextPoints.push({ x: point.x, y: point.y })
    }
  }
  if (nextPoints.length > 1 && isSamePoint(nextPoints[0], nextPoints[nextPoints.length - 1])) {
    nextPoints.pop()
  }
  return nextPoints
}

function getBoundingBox(points: PartTemplatePointLike[]) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function closeIfNeeded(points: PartTemplatePointLike[]): PartTemplatePointLike[] {
  if (points.length < 3) return points
  const bbox = getBoundingBox(points)
  const maxDimension = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, 1)
  if (distance(points[0], points[points.length - 1]) <= maxDimension * CLOSE_DISTANCE_RATIO) {
    return points.slice(0, -1)
  }
  return points
}

function perpendicularDistance(point: PartTemplatePointLike, start: PartTemplatePointLike, end: PartTemplatePointLike): number {
  const line = subtract(end, start)
  const length = Math.hypot(line.x, line.y)
  if (length <= EPSILON) return distance(point, start)
  return Math.abs(cross(subtract(point, start), line)) / length
}

function simplifyRdp(points: PartTemplatePointLike[], epsilon: number): PartTemplatePointLike[] {
  if (points.length <= 2) return points
  let maxDistance = 0
  let maxIndex = 0
  const start = points[0]
  const end = points[points.length - 1]

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentDistance = perpendicularDistance(points[index], start, end)
    if (currentDistance > maxDistance) {
      maxDistance = currentDistance
      maxIndex = index
    }
  }

  if (maxDistance <= epsilon) {
    return [start, end]
  }

  const left = simplifyRdp(points.slice(0, maxIndex + 1), epsilon)
  const right = simplifyRdp(points.slice(maxIndex), epsilon)
  return [...left.slice(0, -1), ...right]
}

function simplifyClosedBoundary(points: PartTemplatePointLike[]): PartTemplatePointLike[] {
  if (points.length <= 8) return points
  const bbox = getBoundingBox(points)
  const epsilon = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, 1) * 0.003
  const openPoints = [...points, points[0]]
  const simplified = simplifyRdp(openPoints, epsilon)
  return removeConsecutiveDuplicatePoints(simplified)
}

function computePolygonArea(points: PartTemplatePointLike[]): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    sum += current.x * next.y - next.x * current.y
  }
  return Math.abs(sum / 2)
}

function computePolygonPerimeter(points: PartTemplatePointLike[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    total += distance(points[index], points[(index + 1) % points.length])
  }
  return total
}

function computeCentroid(points: PartTemplatePointLike[]): PartTemplatePointLike {
  if (points.length === 0) return { x: 0, y: 0 }
  const total = points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }),
    { x: 0, y: 0 },
  )
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  }
}

function computePrincipalAxis(points: PartTemplatePointLike[]): { center: PartTemplatePointLike; angle: number } {
  const center = computeCentroid(points)
  let covXX = 0
  let covXY = 0
  let covYY = 0

  for (const point of points) {
    const dx = point.x - center.x
    const dy = point.y - center.y
    covXX += dx * dx
    covXY += dx * dy
    covYY += dy * dy
  }

  const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY)
  return { center, angle }
}

function rotateBoundary(points: PartTemplatePointLike[], center: PartTemplatePointLike, angle: number): RotatedPoint[] {
  return points.map((point) => rotate(point, center, angle))
}

function segmentIntersectsAtX(start: RotatedPoint, end: RotatedPoint, x: number): number | null {
  const minX = Math.min(start.x, end.x)
  const maxX = Math.max(start.x, end.x)

  if (x < minX - EPSILON || x > maxX + EPSILON) return null
  if (Math.abs(end.x - start.x) <= EPSILON) {
    return (start.y + end.y) / 2
  }

  const ratio = (x - start.x) / (end.x - start.x)
  if (ratio < -EPSILON || ratio > 1 + EPSILON) return null
  return start.y + (end.y - start.y) * ratio
}

function computeWidthAtProjection(rotatedPoints: RotatedPoint[], projectionX: number): number {
  const intersections: number[] = []
  for (let index = 0; index < rotatedPoints.length; index += 1) {
    const start = rotatedPoints[index]
    const end = rotatedPoints[(index + 1) % rotatedPoints.length]
    const y = segmentIntersectsAtX(start, end, projectionX)
    if (y !== null) intersections.push(y)
  }

  if (intersections.length >= 2) {
    intersections.sort((left, right) => left - right)
    return intersections[intersections.length - 1] - intersections[0]
  }

  const nearby = rotatedPoints.filter((point) => Math.abs(point.x - projectionX) <= 1)
  if (nearby.length >= 2) {
    const ys = nearby.map((point) => point.y)
    return Math.max(...ys) - Math.min(...ys)
  }

  return 0
}

function normalizeAngleDegrees(angle: number): number {
  const normalized = ((angle % 180) + 180) % 180
  return roundMetric(normalized, 1)
}

function estimatePointDistanceToBoundary(point: RotatedPoint, boundary: RotatedPoint[]): number {
  return Math.min(
    ...boundary.map((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y)),
  )
}

function computeSymmetryScore(rotatedPoints: RotatedPoint[], majorAxisLength: number): number {
  if (rotatedPoints.length === 0 || majorAxisLength <= EPSILON) return 1
  const total = rotatedPoints.reduce((sum, point) => {
    const reflected: RotatedPoint = { x: point.x, y: -point.y }
    return sum + estimatePointDistanceToBoundary(reflected, rotatedPoints)
  }, 0)
  return roundMetric(Math.min(1, total / rotatedPoints.length / majorAxisLength), 3)
}

function normalizeTurnAngle(angle: number): number {
  let normalized = angle
  while (normalized > Math.PI) normalized -= Math.PI * 2
  while (normalized < -Math.PI) normalized += Math.PI * 2
  return normalized
}

function computeSegmentLength(points: PartTemplatePointLike[], startIndex: number, endIndex: number): number {
  let total = 0
  for (let index = startIndex; index < endIndex; index += 1) {
    total += distance(points[index], points[index + 1])
  }
  return total
}

function distanceToChord(point: PartTemplatePointLike, start: PartTemplatePointLike, end: PartTemplatePointLike): number {
  const line = subtract(end, start)
  const length = Math.hypot(line.x, line.y)
  if (length <= EPSILON) return distance(point, start)
  return Math.abs(cross(subtract(point, start), line)) / length
}

function buildArcSegments(points: PartTemplatePointLike[], perimeter: number): ArcSegment[] {
  if (points.length < 4 || perimeter <= EPSILON) return []

  const turnAngles: number[] = []
  const segmentLabels: Array<'curve' | 'straight' | 'corner'> = []
  const segmentLengths: number[] = []

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length]
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const vectorA = subtract(current, previous)
    const vectorB = subtract(next, current)
    const lengthA = Math.hypot(vectorA.x, vectorA.y)
    const lengthB = Math.hypot(vectorB.x, vectorB.y)
    if (lengthA <= EPSILON || lengthB <= EPSILON) {
      turnAngles.push(0)
      segmentLabels.push('straight')
      segmentLengths.push(lengthB)
      continue
    }

    const angle = Math.abs(normalizeTurnAngle(Math.atan2(cross(vectorA, vectorB), dot(vectorA, vectorB))))
    turnAngles.push(angle)
    segmentLengths.push(lengthB)

    if (angle >= CORNER_ANGLE) {
      segmentLabels.push('corner')
    } else if (angle >= CURVE_VERTEX_MIN_ANGLE && angle <= CURVE_VERTEX_MAX_ANGLE) {
      segmentLabels.push('curve')
    } else {
      segmentLabels.push('straight')
    }
  }

  const arcSegments: ArcSegment[] = []
  let startIndex: number | null = null

  function closeCurrent(endIndex: number): void {
    if (startIndex === null) return
    const segmentPoints = points.slice(startIndex, endIndex + 1)
    if (segmentPoints.length < 3) {
      startIndex = null
      return
    }

    const length = computeSegmentLength(segmentPoints, 0, segmentPoints.length - 1)
    if (length < perimeter * ARC_LENGTH_RATIO) {
      startIndex = null
      return
    }

    const chordStart = segmentPoints[0]
    const chordEnd = segmentPoints[segmentPoints.length - 1]
    const chordLength = distance(chordStart, chordEnd)
    const sagittas = segmentPoints
      .slice(1, -1)
      .map((point) => distanceToChord(point, chordStart, chordEnd))
    const maxSagitta = Math.max(...sagittas, 0)
    const avgSagitta =
      sagittas.length > 0 ? sagittas.reduce((sum, value) => sum + value, 0) / sagittas.length : 0
    const estimatedRadius =
      maxSagitta > EPSILON
        ? (chordLength ** 2) / (8 * maxSagitta) + maxSagitta / 2
        : null

    arcSegments.push({
      points: segmentPoints,
      sagitta: maxSagitta,
      estimatedRadius,
      length,
    })
    startIndex = null
  }

  for (let index = 0; index < segmentLabels.length; index += 1) {
    const label = segmentLabels[index]
    if (label === 'curve') {
      if (startIndex === null) startIndex = index
      continue
    }
    closeCurrent(index)
  }

  closeCurrent(points.length - 1)
  return arcSegments
}

function buildNormalizedShapeSignature(points: PartTemplatePointLike[]): string {
  if (points.length === 0) return ''
  const { center, angle } = computePrincipalAxis(points)
  const rotated = rotateBoundary(points, center, -angle)
  const bbox = getBoundingBox(rotated)
  const width = Math.max(bbox.maxX - bbox.minX, 1)
  const height = Math.max(bbox.maxY - bbox.minY, 1)

  let signature = rotated
    .map((point) => ({
      x: roundMetric((point.x - bbox.minX) / width, SIGNATURE_PRECISION),
      y: roundMetric((point.y - bbox.minY) / height, SIGNATURE_PRECISION),
    }))
    .map((point) => `${point.x},${point.y}`)

  while (signature.length < SAMPLE_POINT_COUNT) {
    signature = [...signature, ...signature]
  }

  const step = signature.length / SAMPLE_POINT_COUNT
  const sampled = Array.from({ length: SAMPLE_POINT_COUNT }, (_, index) => signature[Math.floor(index * step)])
  return sampled.join(';')
}

function createSimpleHash(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return Math.abs(hash >>> 0).toString(36)
}

export function buildGeometryHashFromSignature(signature: string): string {
  return createSimpleHash(signature)
}

function computeComplexityLevel(params: {
  pointCount: number
  cornerCount: number
  innerBoundaryCount: number
  majorArcCount: number
}): PartComplexityLevel {
  const score =
    params.pointCount / 24 +
    params.cornerCount / 4 +
    params.innerBoundaryCount * 1.2 +
    params.majorArcCount * 0.7

  if (score >= 7.5) return 'high'
  if (score >= 3.5) return 'medium'
  return 'low'
}

function estimateNotchCount(points: PartTemplatePointLike[]): number {
  if (points.length < 3) return 0
  let count = 0
  const perimeter = computePolygonPerimeter(points)
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length]
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const vectorA = subtract(current, previous)
    const vectorB = subtract(next, current)
    const angle = Math.abs(normalizeTurnAngle(Math.atan2(cross(vectorA, vectorB), dot(vectorA, vectorB))))
    const localLength = distance(previous, current) + distance(current, next)
    if (angle >= NOTCH_ANGLE && localLength <= perimeter * 0.08) {
      count += 1
    }
  }
  return count
}

export function buildPartGeometryAnalysis(params: {
  outerBoundary?: PartTemplateBoundaryLike
  innerBoundary?: PartTemplateBoundaryLike
  innerBoundaryCount?: number
  grainLines?: PartTemplateLineLike[]
  outerBoundaryCount?: number
  pointCount?: number
}): PartGeometryAnalysisResult | null {
  if (!params.outerBoundary || params.outerBoundary.points.length < 3) return null

  const cleaned = closeIfNeeded(removeConsecutiveDuplicatePoints(params.outerBoundary.points))
  const simplified = simplifyClosedBoundary(cleaned)
  const bbox = getBoundingBox(cleaned)
  const bboxWidth = Math.max(bbox.maxX - bbox.minX, 0)
  const bboxHeight = Math.max(bbox.maxY - bbox.minY, 0)
  const area = computePolygonArea(cleaned)
  const perimeter = computePolygonPerimeter(cleaned)
  const aspectRatio = bboxHeight <= EPSILON ? bboxWidth : bboxWidth / bboxHeight

  const { center, angle } = computePrincipalAxis(simplified)
  const rotated = rotateBoundary(simplified, center, -angle)
  const rotatedBounds = getBoundingBox(rotated)
  const principalAxisLength = Math.max(rotatedBounds.maxX - rotatedBounds.minX, 1)
  const widthSamples = WIDTH_SAMPLE_POSITIONS.map((ratio) =>
    computeWidthAtProjection(rotated, rotatedBounds.minX + principalAxisLength * ratio),
  )
  const [headWidth, midWidth, tailWidth] = widthSamples.map((value) => roundMetric(Math.max(value, 0), 2))
  const taperRatio = midWidth <= EPSILON ? 1 : ((headWidth + tailWidth) / 2) / midWidth
  const symmetryScore = computeSymmetryScore(rotated, principalAxisLength)

  const arcSegments = buildArcSegments(simplified, perimeter)
  const majorArcCount = arcSegments.length
  const maxSagitta = arcSegments.reduce((max, segment) => Math.max(max, segment.sagitta), 0)
  const avgSagitta =
    arcSegments.length > 0
      ? arcSegments.reduce((sum, segment) => sum + segment.sagitta, 0) / arcSegments.length
      : 0
  const maxEstimatedRadius = arcSegments.reduce<number | null>((max, segment) => {
    if (segment.estimatedRadius === null) return max
    if (max === null) return segment.estimatedRadius
    return Math.max(max, segment.estimatedRadius)
  }, null)

  const curvatureRatio = maxSagitta / principalAxisLength
  const curvatureLevel: PartCurvatureLevel =
    curvatureRatio < 0.02 ? 'straight' : curvatureRatio < 0.05 ? 'slight' : curvatureRatio < 0.1 ? 'medium' : 'strong'

  let curveLength = 0
  let straightLength = 0
  let cornerCount = 0
  for (let index = 0; index < simplified.length; index += 1) {
    const previous = simplified[(index - 1 + simplified.length) % simplified.length]
    const current = simplified[index]
    const next = simplified[(index + 1) % simplified.length]
    const vectorA = subtract(current, previous)
    const vectorB = subtract(next, current)
    const angleValue = Math.abs(normalizeTurnAngle(Math.atan2(cross(vectorA, vectorB), dot(vectorA, vectorB))))
    const segmentLength = distance(current, next)
    if (angleValue >= CORNER_ANGLE) {
      cornerCount += 1
      straightLength += segmentLength
    } else if (angleValue >= CURVE_VERTEX_MIN_ANGLE && angleValue <= CURVE_VERTEX_MAX_ANGLE) {
      curveLength += segmentLength
    } else {
      straightLength += segmentLength
    }
  }

  const totalClassifiedLength = curveLength + straightLength
  const curveRate = totalClassifiedLength <= EPSILON ? 0 : curveLength / totalClassifiedLength
  const straightRate = totalClassifiedLength <= EPSILON ? 1 : straightLength / totalClassifiedLength

  const normalizedShapeSignature = buildNormalizedShapeSignature(simplified)
  const geometryHash = buildGeometryHashFromSignature(normalizedShapeSignature)
  const innerBoundaryCount = params.innerBoundaryCount ?? (params.innerBoundary ? 1 : 0)
  const pointCount = params.pointCount ?? cleaned.length
  const complexityLevel = computeComplexityLevel({
    pointCount,
    cornerCount,
    innerBoundaryCount,
    majorArcCount,
  })

  const longestGrainLine = [...(params.grainLines ?? [])].sort(
    (left, right) =>
      distance(right.start, right.end) - distance(left.start, left.end),
  )[0]
  const grainLineAngle = longestGrainLine
    ? normalizeAngleDegrees(
        (Math.atan2(longestGrainLine.end.y - longestGrainLine.start.y, longestGrainLine.end.x - longestGrainLine.start.x) *
          180) /
          Math.PI,
      )
    : null

  const axisHalf = principalAxisLength / 2
  const principalAxis = {
    start: unrotate({ x: -axisHalf, y: 0 }, center, angle),
    end: unrotate({ x: axisHalf, y: 0 }, center, angle),
  }

  return {
    features: {
      bboxWidth: roundMetric(bboxWidth, 1),
      bboxHeight: roundMetric(bboxHeight, 1),
      area: roundMetric(area, 2),
      perimeter: roundMetric(perimeter, 2),
      aspectRatio: roundMetric(aspectRatio, 3),
      symmetryScore,
      taperRatio: roundMetric(taperRatio, 3),
      headWidth,
      midWidth,
      tailWidth,
      curveRate: roundMetric(curveRate, 3),
      straightRate: roundMetric(straightRate, 3),
      cornerCount,
      majorArcCount,
      maxSagitta: roundMetric(maxSagitta, 2),
      avgSagitta: roundMetric(avgSagitta, 2),
      maxEstimatedRadius: maxEstimatedRadius === null ? null : roundMetric(maxEstimatedRadius, 2),
      curvatureLevel,
      outerBoundaryCount: params.outerBoundaryCount ?? 1,
      innerBoundaryCount,
      innerHoleCount: innerBoundaryCount,
      grainLineCount: params.grainLines?.length ?? 0,
      grainLineAngle,
      notchCountEstimate: estimateNotchCount(simplified),
      pointCount,
      complexityLevel,
      normalizedShapeSignature,
    },
    normalizedShapeSignature,
    geometryHash,
    visualGuides: {
      principalAxis,
      majorArcPaths: arcSegments.slice(0, 3).map((segment) => segment.points),
    },
  }
}
