import * as vscode from 'vscode';

export class SubscriptionViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'subscriptionView';
    private _view?: vscode.WebviewView;
    private _subscriptionData: any = null;

    constructor(private readonly _extensionUri: vscode.Uri) {}

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

        this.updateView();
    }

    // 更新订阅数据
    public updateSubscriptionData(data: any) {
        this._subscriptionData = data;
        this.updateView();
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
                    font-size: 48px;
                    margin-bottom: 16px;
                }
            </style>
        </head>
        <body>
            <div class="empty">
                <div class="empty-icon"><i class="fas fa-box fa-3x"></i></div>
                <h3>暂无活跃订阅</h3>
                <p style="color: var(--vscode-descriptionForeground);">您当前没有活跃的订阅</p>
            </div>
        </body>
        </html>`;
    }

    // 订阅信息页面
    private _getSubscriptionHtml(activeSubscriptions: any[]): string {
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
                <p>${activeSubscriptions.length} 个活跃订阅</p>
            </div>`;

        // 计算总额度
        let totalCredits = 0;
        let totalLimit = 0;

        activeSubscriptions.forEach((sub: any) => {
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

            html += `
            <div class="subscription-card">
                <div class="card-header">
                    <div class="card-title"><i class="fas fa-bullseye icon"></i>${sub.subscriptionPlanName || '未知套餐'}</div>
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
                        <div class="info-label"><i class="fas fa-bolt icon"></i>恢复速度</div>
                        <div class="info-value">$${plan.creditsPerHour || 0}/小时</div>
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
        });

        // 总计
        const totalPercentage = totalLimit > 0 ? ((totalCredits / totalLimit) * 100).toFixed(1) : '0.0';
        html += `
            <div class="summary">
                <div class="summary-title"><i class="fas fa-box icon"></i>总计</div>
                <div><i class="fas fa-gem icon"></i>总额度: $${totalCredits} / $${totalLimit} (${totalPercentage}%)</div>
            </div>
        </body>
        </html>`;

        return html;
    }
}
