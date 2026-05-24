import { listPatternAssets } from './pcs-pattern-library.ts';
export function listPatternAssetsByProjectId(projectId) {
    return listPatternAssets().filter((asset) => asset.source_project_id === projectId);
}
export function listPatternAssetsByTechPackVersionId(technicalVersionId) {
    return listPatternAssets().filter((asset) => asset.source_tech_pack_version_id === technicalVersionId);
}
export function listPatternAssetsForTechPackVersions(versions) {
    const assetIds = new Set();
    const versionIds = new Set();
    versions.forEach((version) => {
        ;
        (version.linkedPatternAssetIds ?? []).forEach((assetId) => assetIds.add(assetId));
        if (version.technicalVersionId)
            versionIds.add(version.technicalVersionId);
    });
    const map = new Map();
    listPatternAssets().forEach((asset) => {
        if (assetIds.has(asset.id) || (asset.source_tech_pack_version_id && versionIds.has(asset.source_tech_pack_version_id))) {
            map.set(asset.id, asset);
        }
    });
    return Array.from(map.values());
}
