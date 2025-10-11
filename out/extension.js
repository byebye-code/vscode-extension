"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const LoginViewProvider_1 = require("./LoginViewProvider");
const DashboardViewProvider_1 = require("./DashboardViewProvider");
const SubscriptionViewProvider_1 = require("./SubscriptionViewProvider");
const SettingsViewProvider_1 = require("./SettingsViewProvider");
const CreditService_1 = require("./CreditService");
const CodexService_1 = require("./CodexService");
// 全局积分服务实例
let creditService;
// 全局 Codex 服务实例
let codexService;
// 订阅视图提供者
let subscriptionViewProvider;
// 登录视图提供者
let loginViewProvider;
// 自动重新登录定时器
let autoReloginTimer;
function activate(context) {
    console.log('88Code 插件已激活！');
    // 检查是否已登录
    const token = context.globalState.get('88code_token');
    vscode.commands.executeCommand('setContext', '88code:loggedIn', !!token);
    // 注册登录视图提供程序
    loginViewProvider = new LoginViewProvider_1.LoginViewProvider(context);
    console.log('正在注册 LoginViewProvider，viewType:', LoginViewProvider_1.LoginViewProvider.viewType);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(LoginViewProvider_1.LoginViewProvider.viewType, loginViewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // 启动自动重新登录定时任务
    startAutoReloginTask(context);
    // 注册看板视图提供程序
    const dashboardViewProvider = new DashboardViewProvider_1.DashboardViewProvider(context);
    console.log('正在注册 DashboardViewProvider，viewType:', DashboardViewProvider_1.DashboardViewProvider.viewType);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(DashboardViewProvider_1.DashboardViewProvider.viewType, dashboardViewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // 初始化订阅视图提供者
    subscriptionViewProvider = new SubscriptionViewProvider_1.SubscriptionViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SubscriptionViewProvider_1.SubscriptionViewProvider.viewType, subscriptionViewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // 注册设置视图提供程序
    const settingsViewProvider = new SettingsViewProvider_1.SettingsViewProvider(context);
    console.log('正在注册 SettingsViewProvider，viewType:', SettingsViewProvider_1.SettingsViewProvider.viewType);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SettingsViewProvider_1.SettingsViewProvider.viewType, settingsViewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // 初始化积分服务（传入订阅视图提供者）
    creditService = new CreditService_1.CreditService(context, subscriptionViewProvider);
    creditService.start();
    // 初始化 Codex 服务
    codexService = new CodexService_1.CodexService(context);
    codexService.start();
    // 注册命令
    const helloWorldDisposable = vscode.commands.registerCommand('extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from 88Code Extension!');
    });
    const loginDisposable = vscode.commands.registerCommand('88code.login', () => {
        vscode.commands.executeCommand('setContext', '88code:loggedIn', false);
        vscode.window.showInformationMessage('请在侧边栏登录面板中输入您的凭据');
    });
    const logoutDisposable = vscode.commands.registerCommand('88code.logout', async () => {
        await context.globalState.update('88code_token', undefined);
        await context.globalState.update('88code_cached_credits', undefined);
        await context.globalState.update('88code_cached_codex', undefined);
        // 清除保存的账号密码
        await context.globalState.update('88code_username', undefined);
        await context.globalState.update('88code_password', undefined);
        await context.globalState.update('88code_last_login', undefined);
        await vscode.commands.executeCommand('setContext', '88code:loggedIn', false);
        creditService.stop();
        codexService.stop();
        // 停止自动重新登录任务
        if (autoReloginTimer) {
            clearInterval(autoReloginTimer);
            autoReloginTimer = undefined;
        }
        vscode.window.showInformationMessage('已退出登录');
    });
    // 刷新积分命令
    const refreshCreditsDisposable = vscode.commands.registerCommand('88code.refreshCredits', async () => {
        await creditService.refreshCredits();
    });
    // 重置余额命令
    const resetCreditsDisposable = vscode.commands.registerCommand('88code.resetCredits', async () => {
        await creditService.resetCredits();
    });
    // 显示订阅信息面板命令
    const showSubscriptionInfoDisposable = vscode.commands.registerCommand('88code.showSubscriptionInfo', () => {
        creditService.showSubscriptionPanel();
    });
    // 更新设置命令
    const updateSettingsDisposable = vscode.commands.registerCommand('88code.updateSettings', async (settings) => {
        creditService.updateSettings(settings);
        // 刷新看板以应用新的总金额配置
        await dashboardViewProvider.refresh();
    });
    // 监听登录状态变化
    const loginStatusListener = vscode.commands.registerCommand('88code.onLoginStatusChanged', async (isLoggedIn) => {
        if (isLoggedIn) {
            await creditService.start();
            await codexService.start();
        }
        else {
            await creditService.stop();
            await codexService.stop();
        }
    });
    context.subscriptions.push(helloWorldDisposable, loginDisposable, logoutDisposable, refreshCreditsDisposable, resetCreditsDisposable, showSubscriptionInfoDisposable, updateSettingsDisposable, loginStatusListener);
}
exports.activate = activate;
/**
 * 启动自动重新登录定时任务
 * 每24小时自动使用保存的账号密码重新登录，刷新token
 */
function startAutoReloginTask(context) {
    // 清除之前的定时器
    if (autoReloginTimer) {
        clearInterval(autoReloginTimer);
    }
    // 检查是否有保存的账号密码
    const username = context.globalState.get('88code_username');
    const password = context.globalState.get('88code_password');
    if (!username || !password) {
        console.log('没有保存的账号密码，跳过自动重新登录任务');
        return;
    }
    console.log('已启动自动重新登录任务，将每24小时自动刷新token');
    // 立即执行一次检查（如果上次登录超过23小时，则重新登录）
    checkAndRelogin(context);
    // 设置定时器，每24小时执行一次
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    autoReloginTimer = setInterval(() => {
        checkAndRelogin(context);
    }, TWENTY_FOUR_HOURS);
}
/**
 * 检查并执行自动重新登录
 */
async function checkAndRelogin(context) {
    try {
        const lastLogin = context.globalState.get('88code_last_login');
        if (!lastLogin) {
            console.log('没有上次登录时间记录，执行自动重新登录');
            await performAutoRelogin();
            return;
        }
        const lastLoginTime = new Date(lastLogin).getTime();
        const now = new Date().getTime();
        const hoursSinceLastLogin = (now - lastLoginTime) / (1000 * 60 * 60);
        // 如果距离上次登录超过23小时，则自动重新登录
        if (hoursSinceLastLogin >= 23) {
            console.log(`距离上次登录已${hoursSinceLastLogin.toFixed(1)}小时，执行自动重新登录`);
            await performAutoRelogin();
        }
        else {
            console.log(`距离上次登录仅${hoursSinceLastLogin.toFixed(1)}小时，暂不需要重新登录`);
        }
    }
    catch (error) {
        console.error('检查自动重新登录失败:', error);
    }
}
/**
 * 执行自动重新登录
 */
async function performAutoRelogin() {
    try {
        if (!loginViewProvider) {
            console.error('登录视图提供者未初始化');
            return;
        }
        console.log('正在执行自动重新登录...');
        const success = await loginViewProvider.autoRelogin();
        if (success) {
            console.log('自动重新登录成功，token已更新');
            // 通知积分服务刷新数据
            if (creditService) {
                await creditService.refreshCredits();
            }
        }
        else {
            console.log('自动重新登录失败，可能需要手动登录');
        }
    }
    catch (error) {
        console.error('执行自动重新登录失败:', error);
    }
}
function deactivate() {
    // 清除自动重新登录定时器
    if (autoReloginTimer) {
        clearInterval(autoReloginTimer);
        autoReloginTimer = undefined;
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map