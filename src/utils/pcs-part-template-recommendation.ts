import type { PartGeometryFeatures } from './pcs-part-template-geometry'

export interface PartTemplateRecommendationInput {
  standardPartName?: string
  sourcePartName: string
  systemPieceName?: string
  candidatePartNames: string[]
  sizeCode?: string
  geometryFeatures?: PartGeometryFeatures
  normalizedShapeSignature?: string
}

export interface PartTemplateRecommendationCandidate {
  id: string
  templateName: string
  standardPartName: string
  sourcePartName: string
  systemPieceName?: string
  candidatePartNames: string[]
  sizeCode?: string
  geometryFeatures?: PartGeometryFeatures
  normalizedShapeSignature?: string
  reuseHitCount: number
  hotStyleCount: number
  cumulativeOrderQty: number
}

export interface PartTemplateRecommendationScore {
  candidateId: string
  matchScore: number
  reasons: string[]
}

const WEIGHTS = {
  standardPartName: 30,
  sourceNames: 20,
  sizeCode: 10,
  aspectRatio: 8,
  symmetryScore: 6,
  curvatureLevel: 6,
  majorArcCount: 5,
  taperRatio: 5,
  normalizedShapeSignature: 6,
  historyValue: 4,
} as const

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_\-./\\()[\]{}，。:：;；、]+/g, '')
    .trim()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getNameSimilarity(source: string, target: string): number {
  const normalizedSource = normalizeText(source)
  const normalizedTarget = normalizeText(target)
  if (!normalizedSource || !normalizedTarget) return 0
  if (normalizedSource === normalizedTarget) return 1
  if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) return 0.8
  if (normalizedSource.slice(0, 2) && normalizedTarget.includes(normalizedSource.slice(0, 2))) return 0.55
  return 0
}

function parseSignature(signature?: string): Array<{ x: number; y: number }> {
  if (!signature) return []
  return signature
    .split(';')
    .map((item) => {
      const [x, y] = item.split(',').map(Number.parseFloat)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      return { x, y }
    })
    .filter((item): item is { x: number; y: number } => item !== null)
}

function getSignatureSimilarity(left?: string, right?: string): number {
  const leftPoints = parseSignature(left)
  const rightPoints = parseSignature(right)
  if (leftPoints.length === 0 || rightPoints.length === 0) return 0
  const sampleSize = Math.min(leftPoints.length, rightPoints.length)
  let totalDistance = 0
  for (let index = 0; index < sampleSize; index += 1) {
    const leftPoint = leftPoints[index]
    const rightPoint = rightPoints[index]
    totalDistance += Math.hypot(leftPoint.x - rightPoint.x, leftPoint.y - rightPoint.y)
  }
  const averageDistance = totalDistance / sampleSize
  return clamp(1 - averageDistance / 0.35, 0, 1)
}

function getRangeSimilarity(gap: number, highSimilarityGap: number, lowSimilarityGap: number): number {
  if (gap <= highSimilarityGap) return 1
  if (gap >= lowSimilarityGap) return 0
  return 1 - (gap - highSimilarityGap) / (lowSimilarityGap - highSimilarityGap)
}

function scoreNames(input: PartTemplateRecommendationInput, candidate: PartTemplateRecommendationCandidate) {
  const standardName = normalizeText(input.standardPartName ?? '')
  const candidateStandard = normalizeText(candidate.standardPartName)
  if (standardName && standardName === candidateStandard) {
    return {
      score: WEIGHTS.standardPartName,
      reason: `名称命中：标准部位与“${candidate.standardPartName}”一致`,
    }
  }

  const sourceNames = [
    input.sourcePartName,
    input.systemPieceName ?? '',
    ...input.candidatePartNames,
  ].filter(Boolean)
  const targetNames = [
    candidate.standardPartName,
    candidate.sourcePartName,
    candidate.systemPieceName ?? '',
    ...candidate.candidatePartNames,
  ].filter(Boolean)

  let bestScore = 0
  let bestPair: [string, string] | null = null
  for (const source of sourceNames) {
    for (const target of targetNames) {
      const similarity = getNameSimilarity(source, target)
      if (similarity > bestScore) {
        bestScore = similarity
        bestPair = [source, target]
      }
    }
  }

  return {
    score: Math.round(WEIGHTS.sourceNames * bestScore),
    reason:
      bestScore > 0 && bestPair
        ? `候选名接近：${bestPair[0]} 与模板名称 ${bestPair[1]} 接近`
        : undefined,
  }
}

function scoreSize(input: PartTemplateRecommendationInput, candidate: PartTemplateRecommendationCandidate) {
  if (!input.sizeCode || !candidate.sizeCode) return { score: 0, reason: undefined }
  if (normalizeText(input.sizeCode) !== normalizeText(candidate.sizeCode)) return { score: 0, reason: undefined }
  return {
    score: WEIGHTS.sizeCode,
    reason: `尺码一致：均为 ${candidate.sizeCode}`,
  }
}

function scoreGeometry(input: PartTemplateRecommendationInput, candidate: PartTemplateRecommendationCandidate) {
  const inputFeatures = input.geometryFeatures
  const candidateFeatures = candidate.geometryFeatures
  if (!inputFeatures || !candidateFeatures) {
    return { score: 0, reasons: [] as string[] }
  }

  let score = 0
  const reasons: string[] = []

  const aspectRatioSimilarity = getRangeSimilarity(
    Math.abs(inputFeatures.aspectRatio - candidateFeatures.aspectRatio),
    0.15,
    0.5,
  )
  score += WEIGHTS.aspectRatio * aspectRatioSimilarity
  if (aspectRatioSimilarity >= 0.55) {
    reasons.push(`几何接近：长宽比偏差 ${Math.abs(inputFeatures.aspectRatio - candidateFeatures.aspectRatio).toFixed(2)}`)
  }

  const symmetrySimilarity = getRangeSimilarity(
    Math.abs(inputFeatures.symmetryScore - candidateFeatures.symmetryScore),
    0.05,
    0.25,
  )
  score += WEIGHTS.symmetryScore * symmetrySimilarity
  if (symmetrySimilarity >= 0.55) {
    reasons.push('几何接近：对称度接近')
  }

  const curvatureSimilarity =
    inputFeatures.curvatureLevel === candidateFeatures.curvatureLevel
      ? 1
      : Math.abs(
            ['straight', 'slight', 'medium', 'strong'].indexOf(inputFeatures.curvatureLevel) -
              ['straight', 'slight', 'medium', 'strong'].indexOf(candidateFeatures.curvatureLevel),
          ) === 1
        ? 0.5
        : 0
  score += WEIGHTS.curvatureLevel * curvatureSimilarity
  if (curvatureSimilarity > 0) {
    reasons.push(`弧度接近：${candidateFeatures.curvatureLevel === 'strong' ? '明显弧形' : candidateFeatures.curvatureLevel}`)
  }

  const arcGap = Math.abs(inputFeatures.majorArcCount - candidateFeatures.majorArcCount)
  const arcSimilarity = arcGap === 0 ? 1 : arcGap === 1 ? 0.5 : 0
  score += WEIGHTS.majorArcCount * arcSimilarity
  if (arcSimilarity > 0) {
    reasons.push(`主弧段接近：均为 ${candidateFeatures.majorArcCount} 段左右`)
  }

  const taperSimilarity = getRangeSimilarity(
    Math.abs(inputFeatures.taperRatio - candidateFeatures.taperRatio),
    0.08,
    0.35,
  )
  score += WEIGHTS.taperRatio * taperSimilarity
  if (taperSimilarity >= 0.55) {
    reasons.push('宽度趋势接近：收窄比例相近')
  }

  const signatureSimilarity = getSignatureSimilarity(
    input.normalizedShapeSignature ?? inputFeatures.normalizedShapeSignature,
    candidate.normalizedShapeSignature ?? candidateFeatures.normalizedShapeSignature,
  )
  score += WEIGHTS.normalizedShapeSignature * signatureSimilarity
  if (signatureSimilarity >= 0.55) {
    reasons.push('轮廓接近：归一化形状相似')
  }

  return {
    score,
    reasons,
  }
}

function scoreHistory(candidate: PartTemplateRecommendationCandidate) {
  const historyScore = clamp(
    candidate.reuseHitCount / 50 + candidate.hotStyleCount / 8 + candidate.cumulativeOrderQty / 5000,
    0,
    1,
  )
  return {
    score: WEIGHTS.historyValue * historyScore,
    reason: `历史价值：累计命中 ${candidate.reuseHitCount} 次，爆款 ${candidate.hotStyleCount} 次，累计下单 ${candidate.cumulativeOrderQty} 件`,
  }
}

export function scorePartTemplateRecommendation(
  input: PartTemplateRecommendationInput,
  candidate: PartTemplateRecommendationCandidate,
): PartTemplateRecommendationScore {
  const reasons: string[] = []
  const name = scoreNames(input, candidate)
  const size = scoreSize(input, candidate)
  const geometry = scoreGeometry(input, candidate)
  const history = scoreHistory(candidate)

  if (name.reason) reasons.push(name.reason)
  if (size.reason) reasons.push(size.reason)
  reasons.push(...geometry.reasons)
  reasons.push(history.reason)

  if (!name.reason && !size.reason) {
    reasons.unshift(`名称参考：当前按“${candidate.standardPartName}”和候选名近似匹配`)
  }
  if (geometry.reasons.length === 0 && input.geometryFeatures && candidate.geometryFeatures) {
    reasons.push('几何参考：已按轮廓、对称度和弧度综合比对')
  }

  const totalScore = clamp(
    Math.round(name.score + size.score + geometry.score + history.score),
    0,
    100,
  )

  return {
    candidateId: candidate.id,
    matchScore: totalScore,
    reasons: reasons.slice(0, 5),
  }
}
