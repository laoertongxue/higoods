import type { PartGeometryFeatures } from './pcs-part-template-geometry'

export interface PartShapeDescription {
  shapeTags: string[]
  autoDescription: string
  templateMachineSuitability: 'high' | 'medium' | 'low'
  suitabilityReason: string[]
}

export const SHAPE_TAG_THRESHOLDS = {
  longShapeAspectRatio: 3,
  shortWideAspectRatio: 1.5,
  rectangleCurveRate: 0.2,
  highStraightRate: 0.65,
  highCurveRate: 0.5,
  nearSymmetryScore: 0.08,
  asymmetryScore: 0.16,
  taperTight: 0.92,
  taperBalancedMin: 0.92,
  taperBalancedMax: 1.08,
  midWidthBoost: 1.05,
} as const

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value)
  }
}

function buildShapeTags(features: PartGeometryFeatures): string[] {
  const tags: string[] = []

  if (features.aspectRatio >= SHAPE_TAG_THRESHOLDS.longShapeAspectRatio) {
    pushUnique(tags, '长条形')
  } else if (features.aspectRatio < SHAPE_TAG_THRESHOLDS.shortWideAspectRatio) {
    pushUnique(tags, '短宽形')
  }

  if (features.curveRate < SHAPE_TAG_THRESHOLDS.rectangleCurveRate && features.cornerCount >= 4) {
    pushUnique(tags, '近矩形')
  }

  if (features.curvatureLevel === 'slight' || features.curvatureLevel === 'medium') {
    pushUnique(tags, '弧形')
  }

  if (features.curvatureLevel === 'strong') {
    pushUnique(tags, '明显弧形')
  }

  if (features.majorArcCount >= 2) {
    pushUnique(tags, '双主曲边')
  } else if (features.majorArcCount === 1) {
    pushUnique(tags, '单主曲边')
  }

  if (features.symmetryScore <= SHAPE_TAG_THRESHOLDS.nearSymmetryScore) {
    pushUnique(tags, '左右近对称')
  } else if (features.symmetryScore > SHAPE_TAG_THRESHOLDS.asymmetryScore) {
    pushUnique(tags, '左右不对称')
  }

  if (features.taperRatio < SHAPE_TAG_THRESHOLDS.taperTight) {
    pushUnique(tags, '两端收窄')
  } else if (
    features.taperRatio >= SHAPE_TAG_THRESHOLDS.taperBalancedMin &&
    features.taperRatio <= SHAPE_TAG_THRESHOLDS.taperBalancedMax
  ) {
    pushUnique(tags, '两端接近等宽')
  }

  if (
    features.midWidth > Math.max(features.headWidth, features.tailWidth, 1) * SHAPE_TAG_THRESHOLDS.midWidthBoost
  ) {
    pushUnique(tags, '中段更宽')
  }

  if (features.straightRate >= SHAPE_TAG_THRESHOLDS.highStraightRate) {
    pushUnique(tags, '直边占比高')
  }

  if (features.curveRate >= SHAPE_TAG_THRESHOLDS.highCurveRate) {
    pushUnique(tags, '曲边占比高')
  }

  if (features.innerBoundaryCount > 0) {
    pushUnique(tags, '含内轮廓')
  }

  if (features.grainLineCount > 0) {
    pushUnique(tags, '含布纹线')
  }

  if (features.complexityLevel === 'low') {
    pushUnique(tags, '结构简单')
  } else if (features.complexityLevel === 'high') {
    pushUnique(tags, '结构复杂')
  }

  return tags.slice(0, 6)
}

function buildSuitability(features: PartGeometryFeatures): Pick<
  PartShapeDescription,
  'templateMachineSuitability' | 'suitabilityReason'
> {
  const reasons: string[] = []

  if (features.symmetryScore <= 0.1) {
    reasons.push('左右近对称')
  }
  if (features.complexityLevel !== 'high') {
    reasons.push('外轮廓复杂度可控')
  }
  if (features.innerHoleCount <= 1) {
    reasons.push('内轮廓数量较少')
  }
  if (features.cornerCount <= 8) {
    reasons.push('明显拐点较少')
  }
  if (features.majorArcCount <= 2) {
    reasons.push('主曲边数量可控')
  }

  if (
    features.symmetryScore <= 0.1 &&
    features.complexityLevel !== 'high' &&
    features.innerHoleCount <= 1 &&
    features.cornerCount <= 8 &&
    features.majorArcCount <= 2
  ) {
    return {
      templateMachineSuitability: 'high',
      suitabilityReason: reasons.slice(0, 4),
    }
  }

  if (
    features.complexityLevel === 'high' ||
    features.cornerCount > 12 ||
    features.innerHoleCount > 2 ||
    (features.majorArcCount >= 3 && features.curvatureLevel === 'strong')
  ) {
    const lowReasons = ['轮廓结构偏复杂']
    if (features.cornerCount > 12) lowReasons.push('明显拐点过多')
    if (features.innerHoleCount > 2) lowReasons.push('内轮廓偏多')
    if (features.majorArcCount >= 3 && features.curvatureLevel === 'strong') lowReasons.push('多主曲边且弯曲明显')
    return {
      templateMachineSuitability: 'low',
      suitabilityReason: lowReasons,
    }
  }

  const mediumReasons = reasons.length > 0 ? reasons : ['建议先人工复核后再上模板机']
  if (!mediumReasons.includes('建议先人工复核后再上模板机')) {
    mediumReasons.push('建议先人工复核后再上模板机')
  }

  return {
    templateMachineSuitability: 'medium',
    suitabilityReason: mediumReasons.slice(0, 4),
  }
}

function buildAutoDescription(features: PartGeometryFeatures, tags: string[]): string {
  const shape = tags.find((item) =>
    ['长条形', '短宽形', '近矩形', '弧形', '明显弧形'].includes(item),
  )
  const symmetry = tags.find((item) => item.startsWith('左右'))
  const curvature = tags.find((item) => item.includes('曲边') || item.includes('弧形'))
  const widthTrend = tags.find((item) =>
    ['两端收窄', '两端接近等宽', '中段更宽'].includes(item),
  )
  const structure =
    tags.find((item) => item === '含内轮廓') ??
    tags.find((item) => item === '含布纹线') ??
    tags.find((item) => item.startsWith('结构'))

  return [shape ?? '外形稳定', symmetry ?? '对称性中等', curvature ?? '曲边特征一般', widthTrend ?? '宽度变化平稳', structure ?? '结构可读']
    .filter(Boolean)
    .join('，')
    .concat('。')
}

export function buildPartShapeDescription(features: PartGeometryFeatures): PartShapeDescription {
  const shapeTags = buildShapeTags(features)
  const suitability = buildSuitability(features)

  return {
    shapeTags,
    autoDescription: buildAutoDescription(features, shapeTags),
    templateMachineSuitability: suitability.templateMachineSuitability,
    suitabilityReason: suitability.suitabilityReason,
  }
}

export function getTemplateMachineSuitabilityLabel(value: PartShapeDescription['templateMachineSuitability']): string {
  if (value === 'high') return '高'
  if (value === 'medium') return '中'
  return '低'
}
