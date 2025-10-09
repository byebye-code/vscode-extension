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
function activate(context) {
    console.log('88Code 插件已激活！');
    // 检查是否已登录
    const token = context.globalState.get('88code_token');
    vscode.commands.executeCommand('setContext', '88code:loggedIn', !!token);
    // 注册登录视图提供程序
    const loginViewProvider = new LoginViewProvider_1.LoginViewProvider(context);
    console.log('正在注册 LoginViewProvider，viewType:', LoginViewProvider_1.LoginViewProvider.viewType);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(LoginViewProvider_1.LoginViewProvider.viewType, loginViewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
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
        await vscode.commands.executeCommand('setContext', '88code:loggedIn', false);
        creditService.stop();
        codexService.stop();
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
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map