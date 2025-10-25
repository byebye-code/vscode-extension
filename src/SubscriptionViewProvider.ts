import * as vscode from 'vscode';

export class SubscriptionViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'subscriptionView';
    private _view?: vscode.WebviewView;
    private _subscriptionData: any = null;
    private _messageHandler?: (message: any) => void;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    // 设置消息处理器
    public setMessageHandler(handler: (message: any) => void) {
        this._messageHandler = handler;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // 监听来自 webview 的消息
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (this._messageHandler) {
                await this._messageHandler(message);
            }
        });

        this.updateView();
    }

    // 更新订阅数据
    public updateSubscriptionData(data: any) {
        this._subscriptionData = data;
        this.updateView();
    }

    // 显示支付二维码
    public showPaymentQRCode(paymentData: any) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showPaymentQRCode',
                data: paymentData
            });
        }
    }

    // 更新支付状态
    public updatePaymentStatus(statusData: any) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updatePaymentStatus',
                data: statusData
            });
        }
    }

    // 更新视图内容
    private updateView() {
        if (this._view) {
            this._view.webview.html = this._getHtmlContent();
        }
    }

    // 生成 HTML 内容
    private _getHtmlContent(): string {
        if (!this._subscriptionData || !Array.isArray(this._subscriptionData)) {
            return this._getLoadingHtml();
        }

        // 筛选活跃中的订阅
        const activeSubscriptions = this._subscriptionData.filter((sub: any) =>
            sub.subscriptionStatus === '活跃中'
        );

        if (activeSubscriptions.length === 0) {
            return this._getEmptyHtml();
        }

        return this._getSubscriptionHtml(activeSubscriptions);
    }

    // 加载中页面
    private _getLoadingHtml(): string {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    text-align: center;
                }
                .loading {
                    margin-top: 50px;
                }
                .spinner {
                    border: 4px solid rgba(255,255,255,0.1);
                    border-radius: 50%;
                    border-top: 4px solid var(--vscode-button-background);
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="loading">
                <div class="spinner"></div>
                <p>加载订阅信息中...</p>
            </div>
        </body>
        </html>`;
    }

    // 空状态页面
    private _getEmptyHtml(): string {
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    text-align: center;
                }
                .empty {
                    margin-top: 50px;
                }
                .empty-icon {
                    font-size: 64px;
                    margin-bottom: 24px;
                    opacity: 0.5;
                }
                .empty-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    color: var(--vscode-foreground);
                }
                .empty-desc {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 32px;
                }
                .open-plan-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 20px;
                    padding: 12px 32px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }
                .open-plan-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }
                .open-plan-btn:active {
                    transform: translateY(0);
                }
            </style>
        </head>
        <body>
            <div class="empty">
                <div class="empty-icon"><i class="fas fa-inbox"></i></div>
                <h3 class="empty-title">暂无活跃订阅</h3>
                <p class="empty-desc">您当前没有活跃的订阅，开通套餐后即可使用服务</p>
                <button class="open-plan-btn" onclick="openPlanPage()">
                    <i class="fas fa-rocket"></i>
                    前往开通新的套餐
                </button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                
                function openPlanPage() {
                    vscode.postMessage({
                        type: 'openPlanPage'
                    });
                }
            </script>
        </body>
        </html>`;
    }

    // 订阅信息页面
    private _getSubscriptionHtml(activeSubscriptions: any[]): string {
        // 定义排序顺序
        const planOrder: { [key: string]: number } = {
            'FREE': 1,
            'PRO': 2,
            'PLUS': 3,
            'MAX': 4,
            'PAYGO': 999 // PAYGO 始终在最后
        };

        // 对订阅进行排序
        const sortedSubscriptions = [...activeSubscriptions].sort((a, b) => {
            const orderA = planOrder[a.subscriptionPlanName] || 900; // 未知类型排在 PAYGO 之前
            const orderB = planOrder[b.subscriptionPlanName] || 900;
            return orderA - orderB;
        });

        const styles = `
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                .icon {
                    margin-right: 4px;
                }

                body {
                    font-family: var(--vscode-font-family);
                    background: var(--vscode-editor-background);
                    color: var(--vscode-foreground);
                    padding: 16px;
                    line-height: 1.5;
                }

                .header {
                    margin-bottom: 20px;
                    padding: 16px;
                    background: var(--vscode-button-background);
                    border-radius: 8px;
                    text-align: center;
                }

                .header h2 {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--vscode-button-foreground);
                    margin-bottom: 4px;
                }

                .header p {
                    font-size: 12px;
                    color: var(--vscode-button-foreground);
                    opacity: 0.8;
                }

                .subscription-card {
                    margin-bottom: 16px;
                    padding: 16px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    transition: all 0.2s ease;
                }

                .subscription-card:hover {
                    border-color: var(--vscode-button-background);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .card-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .status-badge {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .status-low {
                    background: rgba(231, 76, 60, 0.2);
                    color: #E74C3C;
                }

                .status-normal {
                    background: rgba(0, 120, 212, 0.2);
                    color: #0078D4;
                }

                .status-high {
                    background: rgba(46, 204, 113, 0.2);
                    color: #2ECC71;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .info-item {
                    font-size: 12px;
                }

                .info-label {
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 2px;
                }

                .info-value {
                    color: var(--vscode-foreground);
                    font-weight: 500;
                }

                .progress-container {
                    margin-top: 12px;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    font-size: 11px;
                }

                .progress-bar {
                    position: relative;
                    height: 24px;
                    background: var(--vscode-input-background);
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid var(--vscode-panel-border);
                }

                .progress-fill {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    transition: width 0.4s ease;
                    border-radius: 12px;
                }

                .progress-fill.low {
                    background: linear-gradient(90deg, #E74C3C, #C0392B);
                }

                .progress-fill.normal {
                    background: linear-gradient(90deg, #0078D4, #005A9E);
                }

                .progress-fill.high {
                    background: linear-gradient(90deg, #2ECC71, #27AE60);
                }

                .progress-text {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 600;
                    color: white;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                }

                .summary {
                    margin-top: 20px;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 6px;
                    text-align: center;
                    font-size: 12px;
                    color: #000;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }

                .summary-title {
                    font-weight: 600;
                    margin-bottom: 4px;
                    color: #000;
                }

                /* 折叠区域样式 */
                .collapsed-section {
                    margin-top: 20px;
                    border-top: 1px solid var(--vscode-panel-border);
                    padding-top: 16px;
                }

                .collapse-toggle {
                    width: 100%;
                    padding: 12px 16px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--vscode-foreground);
                    transition: all 0.2s ease;
                }

                .collapse-toggle:hover {
                    background: var(--vscode-button-hoverBackground);
                    opacity: 0.8;
                }

                .collapse-toggle .icon {
                    transition: transform 0.2s ease;
                }

                .collapse-toggle.expanded .icon {
                    transform: rotate(180deg);
                }

                .collapsed-content {
                    margin-top: 12px;
                    transition: all 0.3s ease;
                }

                .reset-credit-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 20px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    font-size: 11px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .reset-credit-btn:hover:not(:disabled) {
                    background: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }

                .reset-credit-btn:disabled {
                    background: var(--vscode-input-background);
                    color: var(--vscode-descriptionForeground);
                    cursor: not-allowed;
                    opacity: 0.7;
                    box-shadow: none;
                }

                .reset-credit-btn:active:not(:disabled) {
                    transform: translateY(0);
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                }

                /* 续费按钮样式 */
                .renew-btn {
                    padding: 4px 12px;
                    border: none;
                    border-radius: 12px;
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    font-size: 11px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                }

                .renew-btn:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                    transform: translateY(-1px);
                }

                .renew-btn:active {
                    transform: translateY(0);
                }

                /* 模态框样式 */
                .modal-overlay {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 1000;
                    align-items: center;
                    justify-content: center;
                }

                .modal-overlay.active {
                    display: flex;
                }

                .modal-content {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                }

                .modal-header {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: var(--vscode-foreground);
                }

                .modal-body {
                    margin-bottom: 20px;
                    color: var(--vscode-descriptionForeground);
                    font-size: 13px;
                    line-height: 1.6;
                }

                .modal-input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    font-size: 13px;
                    margin-top: 12px;
                }

                .modal-input:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                }

                .modal-footer {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }

                .modal-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }

                .modal-btn-cancel {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .modal-btn-cancel:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }

                .modal-btn-confirm {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }

                .modal-btn-confirm:hover:not(:disabled) {
                    background: var(--vscode-button-hoverBackground);
                }

                .modal-btn-confirm:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .warning-text {
                    color: #E74C3C;
                    font-weight: 600;
                    margin-top: 8px;
                }

                /* 支付弹窗特定样式 */
                .payment-modal-content {
                    max-width: 500px;
                    width: 90%;
                }

                .qr-code-container {
                    text-align: center;
                    padding: 20px;
                    background: white;
                    border-radius: 8px;
                    margin: 16px 0;
                }

                .qr-code-container img {
                    max-width: 200px;
                    height: auto;
                }

                .payment-info {
                    margin: 12px 0;
                    padding: 12px;
                    background: var(--vscode-input-background);
                    border-radius: 6px;
                }

                .payment-info-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 6px 0;
                    font-size: 13px;
                }

                .payment-info-label {
                    color: var(--vscode-descriptionForeground);
                }

                .payment-info-value {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .payment-status {
                    text-align: center;
                    padding: 12px;
                    margin: 12px 0;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                }

                .payment-status.waiting {
                    background: rgba(255, 193, 7, 0.2);
                    color: #FFC107;
                }

                .payment-status.success {
                    background: rgba(76, 175, 80, 0.2);
                    color: #4CAF50;
                }

                .payment-status.failed {
                    background: rgba(231, 76, 60, 0.2);
                    color: #E74C3C;
                }

                .declaration-text {
                    font-size: 13px;
                    line-height: 1.8;
                    color: var(--vscode-foreground);
                    margin-bottom: 12px;
                }

                .declaration-text strong {
                    color: var(--vscode-textLink-foreground);
                }

                .declaration-list {
                    margin-left: 20px;
                    font-size: 13px;
                    line-height: 1.8;
                }

                .declaration-list li {
                    margin-bottom: 8px;
                    color: var(--vscode-foreground);
                }
            </style>
        `;

        let html = `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>订阅详情</title>
            ${styles}
        </head>
        <body>
            <div class="header">
                <h2><i class="fas fa-chart-bar icon"></i>订阅信息</h2>
                <p>${sortedSubscriptions.length} 个活跃订阅</p>
            </div>`;

        // 分类订阅：额度>0和额度<=0
        const activeSubscriptionsWithCredit = sortedSubscriptions.filter((sub: any) => {
            const currentCredits = sub.currentCredits || 0;
            return currentCredits > 0;
        });

        const emptySubscriptions = sortedSubscriptions.filter((sub: any) => {
            const currentCredits = sub.currentCredits || 0;
            return currentCredits <= 0;
        });

        // 计算总额度
        let totalCredits = 0;
        let totalLimit = 0;

        // 渲染函数：生成订阅卡片HTML
        const renderSubscriptionCard = (sub: any) => {
            const plan = sub.subscriptionPlan || {};
            const currentCredits = sub.currentCredits || 0;
            const creditLimit = plan.creditLimit || 1;
            const percentage = (currentCredits / creditLimit) * 100;

            totalCredits += currentCredits;
            totalLimit += creditLimit;

            // 确定状态
            let statusClass = 'normal';
            let statusText = '<i class="fas fa-chart-line icon"></i>额度正常';
            if (percentage < 5) {
                statusClass = 'low';
                statusText = '<i class="fas fa-exclamation-triangle icon"></i>额度不足';
            } else if (percentage > 80) {
                statusClass = 'high';
                statusText = '<i class="fas fa-check-circle icon"></i>额度充足';
            }

            // 格式化上次重置时间
            const lastResetTime = sub.lastCreditReset 
                ? sub.lastCreditReset.replace(' ', ' ') 
                : '暂无记录';

            // 判断是否显示重置按钮
            // 1. PAYGO套餐不显示重置按钮
            // 2. 剩余重置次数为0时不显示重置按钮
            const isPAYGO = sub.subscriptionPlanName === 'PAYGO' || plan.planType === 'PAY_PER_USE';
            const showResetButton = !isPAYGO && (sub.resetTimes > 0);

            return `
            <div class="subscription-card">
                <div class="card-header">
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <div class="card-title"><i class="fas fa-bullseye icon"></i>${sub.subscriptionPlanName || '未知套餐'}</div>
                        <button class="renew-btn" data-plan-id="${sub.subscriptionPlan?.id || ''}" data-plan-name="${sub.subscriptionPlanName || ''}"><i class="fas fa-redo-alt"></i> 续费</button>
                    </div>
                    <div class="status-badge status-${statusClass}">${statusText}</div>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label"><i class="fas fa-money-bill-wave icon"></i>费用</div>
                        <div class="info-value">¥${sub.cost || 0}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label"><i class="fas fa-sync icon"></i>计费周期</div>
                        <div class="info-value">${sub.billingCycleDesc || sub.billingCycle || '-'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label"><i class="fas fa-clock icon"></i>剩余天数</div>
                        <div class="info-value">${sub.remainingDays || 0} 天</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label"><i class="fas fa-redo-alt icon"></i>剩余重置次数</div>
                        <div class="info-value">${sub.resetTimes || 0} 次</div>
                    </div>
                    <div class="info-item" style="grid-column: 1 / -1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div>
                                <div class="info-label"><i class="fas fa-history icon"></i>上次重置时间</div>
                                <div class="info-value">${lastResetTime}</div>
                            </div>
                            ${showResetButton ? `
                            <button 
                                class="reset-credit-btn" 
                                data-sub-id="${sub.id}" 
                                data-credit-limit="${creditLimit}"
                                data-current-credits="${currentCredits}"
                                data-last-reset="${sub.lastCreditReset || ''}">
                                <i class="fas fa-sync-alt icon"></i>
                                <span class="btn-text">加载中...</span>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="progress-container">
                    <div class="progress-header">
                        <span><i class="fas fa-gem icon"></i>额度使用情况</span>
                        <span>${percentage.toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                        <div class="progress-text">$${currentCredits} / $${creditLimit}</div>
                    </div>
                </div>
            </div>`;
        };

        // 渲染有额度的订阅
        activeSubscriptionsWithCredit.forEach((sub: any) => {
            const cardHtml = renderSubscriptionCard(sub);
            html += cardHtml;
            
            // 累加总额度
            const currentCredits = sub.currentCredits || 0;
            const creditLimit = sub.subscriptionPlan?.creditLimit || 1;
            totalCredits += currentCredits;
            totalLimit += creditLimit;
        });

        // 渲染额度为0的订阅（折叠区域）
        if (emptySubscriptions.length > 0) {
            html += `
            <div class="collapsed-section">
                <button class="collapse-toggle" id="collapseToggle">
                    <i class="fas fa-chevron-down icon" id="collapseIcon"></i>
                    <span>额度已用完的套餐 (${emptySubscriptions.length})</span>
                </button>
                <div class="collapsed-content" id="collapsedContent" style="display: none;">`;

            emptySubscriptions.forEach((sub: any) => {
                const cardHtml = renderSubscriptionCard(sub);
                html += cardHtml;
                
                // 累加总额度
                const currentCredits = sub.currentCredits || 0;
                const creditLimit = sub.subscriptionPlan?.creditLimit || 1;
                totalCredits += currentCredits;
                totalLimit += creditLimit;
            });

            html += `
                </div>
            </div>`;
        }

        // 总计
        const totalPercentage = totalLimit > 0 ? ((totalCredits / totalLimit) * 100).toFixed(1) : '0.0';
        html += `
            <div class="summary">
                <div class="summary-title"><i class="fas fa-box icon"></i>总计</div>
                <div><i class="fas fa-gem icon"></i>总额度: $${totalCredits} / $${totalLimit} (${totalPercentage}%)</div>
            </div>

            <!-- 二次确认模态框 -->
            <div class="modal-overlay" id="confirmModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <i class="fas fa-exclamation-triangle" style="color: #E74C3C;"></i>
                        确认重置余额
                    </div>
                    <div class="modal-body">
                        <p>您当前的余额为 <strong id="modalCurrentCredit">$0</strong>，重置后将恢复到 <strong id="modalCreditLimit">$0</strong>。</p>
                        <p class="warning-text">此操作不可撤销！</p>
                        <p>请输入 <strong>"确认"</strong> 来继续：</p>
                        <input type="text" id="confirmInput" class="modal-input" placeholder="请输入：确认" />
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-cancel" id="modalCancelBtn">取消</button>
                        <button class="modal-btn modal-btn-confirm" id="modalConfirmBtn" disabled>确认重置</button>
                    </div>
                </div>
            </div>

            <!-- 续费确认（购买声明）模态框 -->
            <div class="modal-overlay" id="renewConfirmModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <i class="fas fa-file-contract"></i>
                        购买声明 - <span id="renewPlanName"></span>
                    </div>
                    <div class="modal-body">
                        <div class="declaration-text">
                            <strong>请仔细阅读以下声明：</strong>
                        </div>
                        <ul class="declaration-list">
                            <li>本站 CC 号池全部为 Max20，Codex 号池全部为 TEAM，绝无掺假</li>
                            <li>本站仅提供中转，最终服务方为 Anthropic 与 OPENAI，如遇上游涨价或减额，我们也会跟随涨价与减额</li>
                            <li>因质量问题引起的纠纷本站提供按日退款服务</li>
                            <li>严禁共享使用、分发与二次销售，本站保留封号退款的权利（按使用日退款）</li>
                        </ul>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-cancel" id="renewCancelBtn">取消</button>
                        <button class="modal-btn modal-btn-confirm" id="renewConfirmBtn">我已阅读并同意</button>
                    </div>
                </div>
            </div>

            <!-- 支付弹窗 -->
            <div class="modal-overlay" id="paymentModal">
                <div class="modal-content payment-modal-content">
                    <div class="modal-header">
                        <i class="fas fa-qrcode"></i>
                        扫码支付
                    </div>
                    <div class="modal-body">
                        <div class="payment-status waiting" id="paymentStatus">
                            <i class="fas fa-spinner fa-spin"></i> 等待支付...
                        </div>
                        <div class="qr-code-container" id="qrCodeContainer">
                            <!-- 二维码将在这里显示 -->
                        </div>
                        <div class="payment-info">
                            <div class="payment-info-item">
                                <span class="payment-info-label">订单号：</span>
                                <span class="payment-info-value" id="orderNo">-</span>
                            </div>
                            <div class="payment-info-item">
                                <span class="payment-info-label">商品名称：</span>
                                <span class="payment-info-value" id="subject">-</span>
                            </div>
                            <div class="payment-info-item">
                                <span class="payment-info-label">支付金额：</span>
                                <span class="payment-info-value" id="amount" style="color: #E74C3C; font-size: 16px;">-</span>
                            </div>
                        </div>
                        <p style="text-align: center; font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 8px;">
                            请使用微信扫描二维码完成支付
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-cancel" id="closePaymentBtn">关闭</button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentResetSubId = null;

                // 折叠/展开功能
                const collapseToggle = document.getElementById('collapseToggle');
                const collapsedContent = document.getElementById('collapsedContent');
                const collapseIcon = document.getElementById('collapseIcon');

                if (collapseToggle && collapsedContent) {
                    collapseToggle.addEventListener('click', function() {
                        const isExpanded = collapsedContent.style.display !== 'none';
                        
                        if (isExpanded) {
                            collapsedContent.style.display = 'none';
                            collapseToggle.classList.remove('expanded');
                        } else {
                            collapsedContent.style.display = 'block';
                            collapseToggle.classList.add('expanded');
                        }
                    });
                }

                // 计算时间差（毫秒）
                function getTimeDiff(lastResetTime) {
                    if (!lastResetTime) {
                        return Infinity;
                    }
                    const lastTime = new Date(lastResetTime).getTime();
                    const now = new Date().getTime();
                    return now - lastTime;
                }

                // 格式化倒计时
                function formatCountdown(milliseconds) {
                    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
                    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
                    return hours + '小时' + minutes + '分' + seconds + '秒';
                }

                // 更新所有按钮状态
                function updateButtonStates() {
                    const buttons = document.querySelectorAll('.reset-credit-btn');
                    buttons.forEach(button => {
                        const subId = button.getAttribute('data-sub-id');
                        const creditLimit = parseFloat(button.getAttribute('data-credit-limit'));
                        const lastReset = button.getAttribute('data-last-reset');
                        const btnText = button.querySelector('.btn-text');

                        const timeDiff = getTimeDiff(lastReset);
                        const fiveHours = 5 * 60 * 60 * 1000;

                        if (timeDiff >= fiveHours) {
                            // 可以重置
                            button.disabled = false;
                            btnText.textContent = '重置余额($' + creditLimit.toFixed(2) + ')';
                        } else {
                            // 需要等待
                            button.disabled = true;
                            const remaining = fiveHours - timeDiff;
                            btnText.textContent = formatCountdown(remaining) + '后可重置';
                        }
                    });
                }

                // 初始化按钮状态
                updateButtonStates();

                // 每秒更新一次倒计时
                setInterval(updateButtonStates, 1000);

                // 按钮点击事件
                document.querySelectorAll('.reset-credit-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const subId = this.getAttribute('data-sub-id');
                        const creditLimit = parseFloat(this.getAttribute('data-credit-limit'));
                        const currentCredits = parseFloat(this.getAttribute('data-current-credits'));

                        currentResetSubId = subId;

                        // 如果当前余额大于5美元，显示确认模态框
                        if (currentCredits > 5) {
                            document.getElementById('modalCurrentCredit').textContent = '$' + currentCredits.toFixed(2);
                            document.getElementById('modalCreditLimit').textContent = '$' + creditLimit.toFixed(2);
                            document.getElementById('confirmInput').value = '';
                            document.getElementById('modalConfirmBtn').disabled = true;
                            document.getElementById('confirmModal').classList.add('active');
                        } else {
                            // 直接发送重置请求
                            vscode.postMessage({
                                type: 'resetSingleSubscription',
                                subId: subId
                            });
                        }
                    });
                });

                // 模态框输入监听
                const confirmInput = document.getElementById('confirmInput');
                const modalConfirmBtn = document.getElementById('modalConfirmBtn');

                confirmInput.addEventListener('input', function() {
                    if (this.value === '确认') {
                        modalConfirmBtn.disabled = false;
                    } else {
                        modalConfirmBtn.disabled = true;
                    }
                });

                // 模态框取消按钮
                document.getElementById('modalCancelBtn').addEventListener('click', function() {
                    document.getElementById('confirmModal').classList.remove('active');
                    currentResetSubId = null;
                });

                // 模态框确认按钮
                modalConfirmBtn.addEventListener('click', function() {
                    if (currentResetSubId) {
                        vscode.postMessage({
                            type: 'resetSingleSubscription',
                            subId: currentResetSubId
                        });
                        document.getElementById('confirmModal').classList.remove('active');
                        currentResetSubId = null;
                    }
                });

                // 点击模态框背景关闭
                document.getElementById('confirmModal').addEventListener('click', function(e) {
                    if (e.target === this) {
                        this.classList.remove('active');
                        currentResetSubId = null;
                    }
                });

                // ===== 续费功能 =====
                // 续费按钮点击事件
                document.querySelectorAll('.renew-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const planId = this.getAttribute('data-plan-id');
                        const planName = this.getAttribute('data-plan-name');
                        
                        // 显示购买声明弹窗
                        document.getElementById('renewPlanName').textContent = planName;
                        document.getElementById('renewConfirmModal').classList.add('active');
                        
                        // 保存planId到确认按钮
                        document.getElementById('renewConfirmBtn').setAttribute('data-plan-id', planId);
                    });
                });

                // 购买声明确认按钮
                document.getElementById('renewConfirmBtn').addEventListener('click', function() {
                    const planId = this.getAttribute('data-plan-id');
                    
                    // 关闭确认弹窗
                    document.getElementById('renewConfirmModal').classList.remove('active');
                    
                    // 调用创建订单接口
                    vscode.postMessage({
                        type: 'createPaymentOrder',
                        planId: parseInt(planId),
                        duration: 1
                    });
                });

                // 购买声明取消按钮
                document.getElementById('renewCancelBtn').addEventListener('click', function() {
                    document.getElementById('renewConfirmModal').classList.remove('active');
                });

                // 关闭支付弹窗
                document.getElementById('closePaymentBtn').addEventListener('click', function() {
                    document.getElementById('paymentModal').classList.remove('active');
                    // 停止轮询
                    if (window.paymentPollingTimer) {
                        clearInterval(window.paymentPollingTimer);
                        window.paymentPollingTimer = null;
                    }
                });

                // 点击背景关闭弹窗
                document.getElementById('renewConfirmModal').addEventListener('click', function(e) {
                    if (e.target === this) {
                        this.classList.remove('active');
                    }
                });

                document.getElementById('paymentModal').addEventListener('click', function(e) {
                    if (e.target === this) {
                        this.classList.remove('active');
                        if (window.paymentPollingTimer) {
                            clearInterval(window.paymentPollingTimer);
                            window.paymentPollingTimer = null;
                        }
                    }
                });

                // 监听来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'showPaymentQRCode':
                            handleShowPaymentQRCode(message.data);
                            break;
                        case 'updatePaymentStatus':
                            handleUpdatePaymentStatus(message.data);
                            break;
                    }
                });

                // 处理显示支付二维码
                function handleShowPaymentQRCode(data) {
                    const { qrCode, orderNo, paymentOrderDTO } = data;
                    
                    // 显示支付弹窗
                    document.getElementById('paymentModal').classList.add('active');
                    
                    // 显示二维码（使用 QRCode.js 或直接生成）
                    const qrContainer = document.getElementById('qrCodeContainer');
                    qrContainer.innerHTML = '<div id="qrcode"></div>';
                    
                    // 使用第三方库生成二维码
                    // 这里简单起见，使用 API 生成二维码图片
                    const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrCode);
                    qrContainer.innerHTML = '<img src="' + qrCodeUrl + '" alt="支付二维码" />';
                    
                    // 显示订单信息
                    document.getElementById('orderNo').textContent = orderNo;
                    document.getElementById('subject').textContent = paymentOrderDTO.subject;
                    document.getElementById('amount').textContent = '¥' + paymentOrderDTO.amount.toFixed(2);
                    
                    // 开始轮询订单状态
                    startPaymentPolling(orderNo);
                }

                // 处理更新支付状态
                function handleUpdatePaymentStatus(data) {
                    const { tradeStatus, success } = data;
                    const statusElement = document.getElementById('paymentStatus');
                    
                    // 支付成功：tradeStatus不为NOTPAY（即为其他任何状态如SUCCESS、PAYING等）
                    if (tradeStatus && tradeStatus !== 'NOTPAY') {
                        // 支付成功
                        statusElement.className = 'payment-status success';
                        statusElement.innerHTML = '<i class="fas fa-check-circle"></i> 支付成功！';
                        
                        // 停止轮询
                        if (window.paymentPollingTimer) {
                            clearInterval(window.paymentPollingTimer);
                            window.paymentPollingTimer = null;
                        }
                        
                        // 2秒后关闭弹窗并刷新订阅详情
                        setTimeout(() => {
                            document.getElementById('paymentModal').classList.remove('active');
                            vscode.postMessage({ type: 'refreshSubscription' });
                        }, 2000);
                    } else if (tradeStatus === 'NOTPAY') {
                        // 等待支付
                        statusElement.className = 'payment-status waiting';
                        statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 等待支付...';
                    } else {
                        // 未知状态，继续等待
                        statusElement.className = 'payment-status waiting';
                        statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 等待支付...';
                    }
                }

                // 开始轮询支付状态
                function startPaymentPolling(orderNo) {
                    // 清除之前的轮询
                    if (window.paymentPollingTimer) {
                        clearInterval(window.paymentPollingTimer);
                    }
                    
                    // 每5秒查询一次订单状态
                    window.paymentPollingTimer = setInterval(() => {
                        vscode.postMessage({
                            type: 'queryPaymentStatus',
                            orderNo: orderNo
                        });
                    }, 5000);
                    
                    // 立即查询一次
                    vscode.postMessage({
                        type: 'queryPaymentStatus',
                        orderNo: orderNo
                    });
                }
            </script>
        </body>
        </html>`;

        return html;
    }
}
