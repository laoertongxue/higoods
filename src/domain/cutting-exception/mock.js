import { buildPlatformCuttingExceptionViews } from './platform.adapter';
export function cloneCuttingExceptionRecords() {
    return buildPlatformCuttingExceptionViews().map((row) => ({ ...row }));
}
