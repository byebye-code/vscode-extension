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
            </script>
        </body>
        </html>`;

        return html;
    }
}
