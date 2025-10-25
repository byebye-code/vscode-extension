"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const LoginViewProvider_1 = require("./LoginViewProvider");
const DashboardViewProvider_1 = require("./DashboardViewProvider");
const SubscriptionViewProvider_1 = require("./SubscriptionViewProvider");
const AnnouncementViewProvider_1 = require("./AnnouncementViewProvider");
const AnnouncementNotificationService_1 = require("./AnnouncementNotificationService");
const SettingsViewProvider_1 = require("./SettingsViewProvider");
const FriendLinksViewProvider_1 = require("./FriendLinksViewProvider");
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
// 公告通知服务实例
let announcementNotificationService;
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
    // 注册公告视图提供程序
    const announcementViewProvider = new AnnouncementViewProvider_1.AnnouncementViewProvider(context);
    console.log('正在注册 AnnouncementViewProvider，viewType:', AnnouncementViewProvider_1.AnnouncementViewProvider.viewType);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(AnnouncementViewProvider_1.AnnouncementViewProvider.viewType, announcementViewProvider, {
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
    // 注册友链视图提供程序
    const friendLinksViewProvider = new FriendLinksViewProvider_1.FriendLinksViewProvider(context.extensionUri);
    console.log('正在注册 FriendLinksViewProvider，viewType:', FriendLinksViewProvider_1.FriendLinksViewProvider.viewType);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(FriendLinksViewProvider_1.FriendLinksViewProvider.viewType, friendLinksViewProvider, {
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
    // 初始化公告通知服务，启动时显示最新公告（如果已登录且未禁用）
    announcementNotificationService = new AnnouncementNotificationService_1.AnnouncementNotificationService(context);
    const disableNotification = context.globalState.get('88code_disable_announcement_notification');
    if (token && !disableNotification) {
        // 延迟2秒显示公告，避免启动时太多弹窗
        setTimeout(() => {
            announcementNotificationService.start();
        }, 2000);
    }
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
        // 清理公告通知服务
        if (announcementNotificationService) {
            announcementNotificationService.dispose();
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
    // 显示积分历史记录命令
    const showCreditHistoryDisposable = vscode.commands.registerCommand('88code.showCreditHistory', async () => {
        await creditService.showCreditHistory();
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
            // 登录成功后显示最新公告（如果未禁用）
            const disableNotification = context.globalState.get('88code_disable_announcement_notification');
            if (!disableNotification && announcementNotificationService) {
                setTimeout(() => {
                    announcementNotificationService.start();
                }, 1000);
            }
        }
        else {
            await creditService.stop();
            await codexService.stop();
            // 清理公告通知服务
            if (announcementNotificationService) {
                announcementNotificationService.dispose();
            }
        }
    });
    context.subscriptions.push(helloWorldDisposable, loginDisposable, logoutDisposable, refreshCreditsDisposable, resetCreditsDisposable, showSubscriptionInfoDisposable, showCreditHistoryDisposable, updateSettingsDisposable, loginStatusListener);
}
exports.activate = activate;
function deactivate() {
    // 清理公告通知服务
    if (announcementNotificationService) {
        announcementNotificationService.dispose();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map