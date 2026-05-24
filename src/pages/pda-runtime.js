import { getCurrentPdaUser, getPdaSession } from '../data/fcs/store-domain-pda.ts';
import { renderRouteRedirect } from '../router/route-utils';
import { appStore } from '../state/store';
import { canFactoryEnterBusiness, ensurePdaAccessForRoute, getPdaOnboardingApplicationFromSession, } from '../data/fcs/factory-onboarding-flow.ts';
export function getPdaRuntimeContext() {
    const session = getPdaSession();
    const user = getCurrentPdaUser();
    if (session && user) {
        return {
            factoryId: session.factoryId,
            factoryName: session.factoryName,
            loginId: session.loginId,
            roleId: session.roleId,
            userId: session.userId,
            userName: session.userName,
        };
    }
    const onboardingApplication = getPdaOnboardingApplicationFromSession();
    if (!onboardingApplication)
        return null;
    if (!canFactoryEnterBusiness(onboardingApplication.status))
        return null;
    return {
        factoryId: onboardingApplication.createdFactoryId || onboardingApplication.factoryTempId,
        factoryName: onboardingApplication.factoryCompanyName,
        loginId: onboardingApplication.adminAccount.loginId,
        roleId: onboardingApplication.adminAccount.roleId,
        userId: `ONBOARDING-${onboardingApplication.applicationId}`,
        userName: onboardingApplication.adminAccount.adminName,
    };
}
export function renderPdaLoginRedirect(title = '工厂入驻&登录') {
    const redirect = ensurePdaAccessForRoute(appStore.getState().pathname || '/fcs/pda/exec');
    return renderRouteRedirect(redirect.redirectPath || '/fcs/pda/auth/login', title);
}
export function ensurePdaSessionForAction(targetRoute = appStore.getState().pathname || '/fcs/pda/exec') {
    const access = ensurePdaAccessForRoute(targetRoute);
    if (access.allowed)
        return true;
    appStore.navigate(access.redirectPath || '/fcs/pda/auth/login', { historyMode: 'replace' });
    return false;
}
