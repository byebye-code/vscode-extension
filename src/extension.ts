import * as vscode from 'vscode';
import { LoginViewProvider } from './LoginViewProvider';
import { DashboardViewProvider } from './DashboardViewProvider';
import { SubscriptionViewProvider } from './SubscriptionViewProvider';
import { SettingsViewProvider } from './SettingsViewProvider';
import { CreditService } from './CreditService';
import { CodexService } from './CodexService';

// 全局积分服务实例
let creditService: CreditService;
// 全局 Codex 服务实例
let codexService: CodexService;
// 订阅视图提供者
let subscriptionViewProvider: SubscriptionViewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('88Code 插件已激活！');

    // 检查是否已登录
    const token = context.globalState.get('88code_token');
    vscode.commands.executeCommand('setContext', '88code:loggedIn', !!token);

    // 注册登录视图提供程序
    const loginViewProvider = new LoginViewProvider(context);
    console.log('正在注册 LoginViewProvider，viewType:', LoginViewProvider.viewType);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(LoginViewProvider.viewType, loginViewProvider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    // 注册看板视图提供程序
    const dashboardViewProvider = new DashboardViewProvider(context);
    console.log('正在注册 DashboardViewProvider，viewType:', DashboardViewProvider.viewType);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(DashboardViewProvider.viewType, dashboardViewProvider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    // 初始化订阅视图提供者
    subscriptionViewProvider = new SubscriptionViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SubscriptionViewProvider.viewType,
            subscriptionViewProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // 注册设置视图提供程序
    const settingsViewProvider = new SettingsViewProvider(context);
    console.log('正在注册 SettingsViewProvider，viewType:', SettingsViewProvider.viewType);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SettingsViewProvider.viewType, settingsViewProvider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    // 初始化积分服务（传入订阅视图提供者）
    creditService = new CreditService(context, subscriptionViewProvider);
    creditService.start();

    // 初始化 Codex 服务
    codexService = new CodexService(context);
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
    const updateSettingsDisposable = vscode.commands.registerCommand('88code.updateSettings', async (settings: any) => {
        creditService.updateSettings(settings);
        // 刷新看板以应用新的总金额配置
        await dashboardViewProvider.refresh();
    });

    // 监听登录状态变化
    const loginStatusListener = vscode.commands.registerCommand('88code.onLoginStatusChanged', async (isLoggedIn: boolean) => {
        if (isLoggedIn) {
            await creditService.start();
            await codexService.start();
        } else {
            await creditService.stop();
            await codexService.stop();
        }
    });

    context.subscriptions.push(
        helloWorldDisposable,
        loginDisposable,
        logoutDisposable,
        refreshCreditsDisposable,
        resetCreditsDisposable,
        showSubscriptionInfoDisposable,
        updateSettingsDisposable,
        loginStatusListener
    );
}

export function deactivate() {}