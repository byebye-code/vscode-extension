"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainViewProvider = void 0;
const vscode = require("vscode");
class MainViewProvider {
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
        this._subscriptionData = null;
        this._expandedSection = 'dashboard'; // 当前展开的部分
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        // 监听来自 webview 的消息
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'toggleSection':
                    this.toggleSection(message.section);
                    break;
                case 'updateSettings':
                    vscode.commands.executeCommand('88code.updateSettings', message.settings);
                    break;
                case 'resetCredits':
                    vscode.commands.executeCommand('88code.resetCredits');
                    break;
            }
        }, undefined, this._context.subscriptions);
        this.updateView();
    }
    // 切换展开的部分
    toggleSection(section) {
        if (this._expandedSection === section) {
            this._expandedSection = ''; // 如果已展开，则折叠
        }
        else {
            this._expandedSection = section; // 展开新部分，自动折叠其他
        }
        this.updateView();
    }
    // 更新订阅数据
    updateSubscriptionData(data) {
        this._subscriptionData = data;
        this.updateView();
    }
    // 更新视图内容
    updateView() {
        if (this._view) {
            this._view.webview.html = this._getHtmlContent();
        }
    }
    // 生成 HTML 内容
    _getHtmlContent() {
        const dashboardExpanded = this._expandedSection === 'dashboard';
        const subscriptionExpanded = this._expandedSection === 'subscription';
        const settingsExpanded = this._expandedSection === 'settings';
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family);
                    background: var(--vscode-editor-background);
                    color: var(--vscode-foreground);
                    overflow-x: hidden;
                }

                /* 手风琴样式 */
                .accordion {
                    width: 100%;
                }

                .accordion-section {
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .accordion-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    cursor: pointer;
                    background: var(--vscode-sideBar-background);
                    transition: all 0.2s ease;
                    user-select: none;
                }

                .accordion-header:hover {
                    background: var(--vscode-list-hoverBackground);
                }

                .accordion-header.active {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }

                .accordion-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .accordion-icon {
                    font-size: 16px;
                    transition: transform 0.2s ease;
                }

                .accordion-icon.expanded {
                    transform: rotate(90deg);
                }

                .accordion-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                    background: var(--vscode-editor-background);
                }

                .accordion-content.expanded {
                    max-height: 2000px;
                }

                .accordion-body {
                    padding: 16px;
                }

                /* 订阅卡片样式 */
                .subscription-card {
                    margin-bottom: 12px;
                    padding: 12px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .card-title {
                    font-size: 13px;
                    font-weight: 600;
                }

                .status-badge {
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
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
                    gap: 6px;
                    margin-bottom: 8px;
                    font-size: 11px;
                }

                .info-label {
                    color: var(--vscode-descriptionForeground);
                }

                .info-value {
                    color: var(--vscode-foreground);
                    font-weight: 500;
                }

                .progress-bar {
                    position: relative;
                    height: 20px;
                    background: var(--vscode-input-background);
                    border-radius: 10px;
                    overflow: hidden;
                    border: 1px solid var(--vscode-panel-border);
                    margin-top: 6px;
                }

                .progress-fill {
                    position: absolute;
                    height: 100%;
                    transition: width 0.3s ease;
                    border-radius: 10px;
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
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: 600;
                    color: white;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                }

                /* 设置样式 */
                .setting-item {
                    margin-bottom: 16px;
                }

                .setting-label {
                    display: block;
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: 6px;
                    color: var(--vscode-foreground);
                }

                .setting-input {
                    width: 100%;
                    padding: 6px 8px;
                    font-size: 12px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }

                .setting-description {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }

                .button {
                    padding: 6px 12px;
                    font-size: 12px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .button:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                .button-secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .button-secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }

                .summary {
                    margin-top: 12px;
                    padding: 8px;
                    background: var(--vscode-button-secondaryBackground);
                    border-radius: 4px;
                    text-align: center;
                    font-size: 11px;
                }

                .empty-state {
                    text-align: center;
                    padding: 24px;
                    color: var(--vscode-descriptionForeground);
                }

                .empty-icon {
                    font-size: 32px;
                    margin-bottom: 8px;
                }
            </style>
        </head>
        <body>
            <div class="accordion">
                <!-- 看板部分 -->
                <div class="accordion-section">
                    <div class="accordion-header ${dashboardExpanded ? 'active' : ''}" onclick="toggleSection('dashboard')">
                        <div class="accordion-title">
                            <span class="accordion-icon ${dashboardExpanded ? 'expanded' : ''}">▶</span>
                            <span>📊 看板</span>
                        </div>
                    </div>
                    <div class="accordion-content ${dashboardExpanded ? 'expanded' : ''}">
                        <div class="accordion-body">
                            ${this._getDashboardHtml()}
                        </div>
                    </div>
                </div>

                <!-- 订阅详情部分 -->
                <div class="accordion-section">
                    <div class="accordion-header ${subscriptionExpanded ? 'active' : ''}" onclick="toggleSection('subscription')">
                        <div class="accordion-title">
                            <span class="accordion-icon ${subscriptionExpanded ? 'expanded' : ''}">▶</span>
                            <span>💳 订阅详情</span>
                        </div>
                    </div>
                    <div class="accordion-content ${subscriptionExpanded ? 'expanded' : ''}">
                        <div class="accordion-body">
                            ${this._getSubscriptionHtml()}
                        </div>
                    </div>
                </div>

                <!-- 设置部分 -->
                <div class="accordion-section">
                    <div class="accordion-header ${settingsExpanded ? 'active' : ''}" onclick="toggleSection('settings')">
                        <div class="accordion-title">
                            <span class="accordion-icon ${settingsExpanded ? 'expanded' : ''}">▶</span>
                            <span>⚙️ 设置</span>
                        </div>
                    </div>
                    <div class="accordion-content ${settingsExpanded ? 'expanded' : ''}">
                        <div class="accordion-body">
                            ${this._getSettingsHtml()}
                        </div>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function toggleSection(section) {
                    vscode.postMessage({
                        command: 'toggleSection',
                        section: section
                    });
                }

                function updateSettings() {
                    const settings = {
                        prefixText: document.getElementById('prefixText').value,
                        suffixText: document.getElementById('suffixText').value,
                        showDecrease: document.getElementById('showDecrease').checked,
                        showIncrease: document.getElementById('showIncrease').checked
                    };
                    vscode.postMessage({
                        command: 'updateSettings',
                        settings: settings
                    });
                }

                function resetCredits() {
                    if (confirm('确定要重置所有订阅的余额吗？')) {
                        vscode.postMessage({
                            command: 'resetCredits'
                        });
                    }
                }
            </script>
        </body>
        </html>`;
    }
    // 看板内容
    _getDashboardHtml() {
        return `
            <div style="text-align: center; padding: 16px;">
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">快速操作</div>
                <button class="button" style="width: 100%; margin-bottom: 8px;" onclick="resetCredits()">🔄 重置余额</button>
                <p style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 12px;">
                    更多功能正在开发中...
                </p>
            </div>
        `;
    }
    // 订阅详情内容
    _getSubscriptionHtml() {
        if (!this._subscriptionData || !Array.isArray(this._subscriptionData)) {
            return `<div class="empty-state">
                <div class="empty-icon">⏳</div>
                <p>加载订阅信息中...</p>
            </div>`;
        }
        const activeSubscriptions = this._subscriptionData.filter((sub) => sub.subscriptionStatus === '活跃中');
        if (activeSubscriptions.length === 0) {
            return `<div class="empty-state">
                <div class="empty-icon">📦</div>
                <p>暂无活跃订阅</p>
            </div>`;
        }
        let totalCredits = 0;
        let totalLimit = 0;
        let html = '';
        activeSubscriptions.forEach((sub) => {
            const plan = sub.subscriptionPlan || {};
            const currentCredits = sub.currentCredits || 0;
            const creditLimit = plan.creditLimit || 1;
            const percentage = (currentCredits / creditLimit) * 100;
            totalCredits += currentCredits;
            totalLimit += creditLimit;
            let statusClass = 'normal';
            let statusText = '📈 正常';
            if (percentage < 5) {
                statusClass = 'low';
                statusText = '⚠️ 不足';
            }
            else if (percentage > 80) {
                statusClass = 'high';
                statusText = '✅ 充足';
            }
            html += `
            <div class="subscription-card">
                <div class="card-header">
                    <div class="card-title">🎯 ${sub.subscriptionPlanName || '未知套餐'}</div>
                    <div class="status-badge status-${statusClass}">${statusText}</div>
                </div>
                <div class="info-grid">
                    <div><span class="info-label">💰 费用:</span> <span class="info-value">¥${sub.cost || 0}</span></div>
                    <div><span class="info-label">🔄 周期:</span> <span class="info-value">${sub.billingCycleDesc || sub.billingCycle || '-'}</span></div>
                    <div><span class="info-label">⏰ 剩余:</span> <span class="info-value">${sub.remainingDays || 0} 天</span></div>
                    <div><span class="info-label">⚡ 恢复:</span> <span class="info-value">$${plan.creditsPerHour || 0}/h</span></div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                    <div class="progress-text">$${currentCredits.toFixed(2)} / $${creditLimit.toFixed(2)}</div>
                </div>
            </div>`;
        });
        const totalPercentage = totalLimit > 0 ? ((totalCredits / totalLimit) * 100).toFixed(1) : '0.0';
        html += `
            <div class="summary">
                <div style="font-weight: 600; margin-bottom: 4px;">📦 总计: ${activeSubscriptions.length} 个订阅</div>
                <div>💎 总额度: $${totalCredits.toFixed(2)} / $${totalLimit.toFixed(2)} (${totalPercentage}%)</div>
            </div>
        `;
        return html;
    }
    // 设置内容
    _getSettingsHtml() {
        const savedSettings = this._context.globalState.get('88code_settings') || {
            prefixText: '剩余余额: ',
            suffixText: '',
            showDecrease: true,
            showIncrease: true
        };
        return `
            <div class="setting-item">
                <label class="setting-label">前缀文字</label>
                <input type="text" id="prefixText" class="setting-input" value="${savedSettings.prefixText}" placeholder="剩余余额: ">
                <div class="setting-description">显示在余额金额前面的文字</div>
            </div>

            <div class="setting-item">
                <label class="setting-label">后缀文字</label>
                <input type="text" id="suffixText" class="setting-input" value="${savedSettings.suffixText}" placeholder="">
                <div class="setting-description">显示在余额金额后面的文字</div>
            </div>

            <div class="setting-item">
                <label class="setting-label">
                    <input type="checkbox" id="showDecrease" ${savedSettings.showDecrease ? 'checked' : ''}>
                    显示余额减少提示
                </label>
                <div class="setting-description">余额减少时显示变化金额（橙色）</div>
            </div>

            <div class="setting-item">
                <label class="setting-label">
                    <input type="checkbox" id="showIncrease" ${savedSettings.showIncrease ? 'checked' : ''}>
                    显示余额增加提示
                </label>
                <div class="setting-description">余额增加时显示变化金额（绿色）</div>
            </div>

            <button class="button" style="width: 100%;" onclick="updateSettings()">💾 保存设置</button>
        `;
    }
}
exports.MainViewProvider = MainViewProvider;
MainViewProvider.viewType = 'mainView';
//# sourceMappingURL=MainViewProvider.js.map