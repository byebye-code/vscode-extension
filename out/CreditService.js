"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditService = void 0;
const vscode = require("vscode");
const https = require("https");
const url_1 = require("url");
class CreditService {
    constructor(context) {
        this._isUpdating = false;
        this._subscriptionData = null; // 存储订阅信息
        this._settings = {
            prefixText: '剩余余额: ',
            suffixText: '',
            showDecrease: true,
            showIncrease: true
        }; // 用户自定义设置
        this._context = context;
        // 加载用户设置
        this.loadSettings();
        // 创建状态栏项目，显示在右下角
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        // 设置命令，点击时显示订阅信息面板
        this._statusBarItem.command = '88code.showSubscriptionInfo';
        this._statusBarItem.tooltip = new vscode.MarkdownString('**点击查看订阅详情**\n\n加载订阅信息中...');
        this._statusBarItem.tooltip.supportHtml = true;
        // 初始化显示
        this.updateStatusBarDisplay();
        // 注册到上下文订阅
        context.subscriptions.push(this._statusBarItem);
    }
    loadSettings() {
        const savedSettings = this._context.globalState.get('88code_statusbar_settings');
        if (savedSettings) {
            this._settings = {
                prefixText: savedSettings.prefixText || '剩余余额: ',
                suffixText: savedSettings.suffixText || '',
                showDecrease: savedSettings.showDecrease !== false,
                showIncrease: savedSettings.showIncrease !== false
            };
        }
    }
    updateSettings(settings) {
        this._settings = {
            prefixText: settings.prefixText || '剩余余额: ',
            suffixText: settings.suffixText || '',
            showDecrease: settings.showDecrease !== false,
            showIncrease: settings.showIncrease !== false
        };
        // 重新显示余额
        const cachedData = this._context.globalState.get('88code_cached_credits');
        if (cachedData && cachedData.credits !== undefined) {
            this.updateStatusBarDisplayWithoutChange(cachedData.credits);
        }
    }
    async start() {
        // 先显示状态栏（即使未登录也显示）
        this._statusBarItem.show();
        // 检查是否已登录
        const token = this._context.globalState.get('88code_token');
        if (token) {
            await this.fetchCredits();
            this.startPeriodicRefresh();
            this.startSubscriptionRefresh(); // 启动订阅信息刷新
        }
        else {
            // 未登录时也显示，但显示提示信息
            this._statusBarItem.text = '$(credit-card) 未登录';
            const tooltip = new vscode.MarkdownString('**请先登录 88Code**\n\n点击打开侧边栏登录');
            tooltip.supportHtml = true;
            this._statusBarItem.tooltip = tooltip;
            this._statusBarItem.backgroundColor = undefined;
        }
    }
    async stop() {
        this.stopPeriodicRefresh();
        // 不隐藏状态栏，而是显示未登录状态
        this._statusBarItem.text = '$(credit-card) 未登录';
        this._statusBarItem.tooltip = '请先登录 88Code\n点击打开侧边栏登录';
        this._statusBarItem.backgroundColor = undefined;
    }
    async refreshCredits() {
        const token = this._context.globalState.get('88code_token');
        if (!token) {
            vscode.window.showWarningMessage('请先登录 88Code');
            return;
        }
        if (this._isUpdating) {
            return; // 防止重复请求
        }
        this._isUpdating = true;
        this._statusBarItem.text = '$(sync~spin) 更新中...';
        try {
            await this.fetchCredits();
        }
        catch (error) {
            vscode.window.showErrorMessage(`获取余额信息失败: ${error}`);
            this._statusBarItem.text = '$(alert) 余额获取失败';
        }
        finally {
            this._isUpdating = false;
        }
    }
    async resetCredits() {
        const token = this._context.globalState.get('88code_token');
        if (!token) {
            vscode.window.showWarningMessage('请先登录 88Code');
            return;
        }
        if (this._isUpdating) {
            return; // 防止重复请求
        }
        this._isUpdating = true;
        this._statusBarItem.text = '$(sync~spin) 重置中...';
        try {
            const token = this._context.globalState.get('88code_token');
            if (!token) {
                throw new Error('未找到登录令牌');
            }
            const subscriptions = await this.httpRequestWithAuth('GET', 'https://www.88code.org/admin-api/cc-admin/system/subscription/my', token);
            if (!Array.isArray(subscriptions?.data)) {
                throw new Error(subscriptions?.msg || '获取订阅列表失败或返回格式不正确');
            }
            const validResetableSubscriptions = subscriptions.data.filter((sub) => sub.id &&
                sub.subscriptionStatus === '活跃中' &&
                sub.subscriptionPlan &&
                sub.subscriptionPlan.planType !== 'PAY_PER_USE' && // 待确认：PAYGO 订阅的值是什么？
                sub.currentCredits !== sub.subscriptionPlan.creditLimit // 满余额的订阅不需要重置
            );
            if (validResetableSubscriptions.length === 0) {
                vscode.window.showInformationMessage('没有订阅需要重置');
                return;
            }
            const results = await Promise.allSettled(validResetableSubscriptions.map(async (sub) => {
                const response = await this.httpRequestWithAuth('POST', 'https://www.88code.org/admin-api/cc-admin/system/subscription/my/reset-credits/' + sub.id, token, null);
                if (!response) {
                    throw new Error(`#${sub.id} 服务器无响应`);
                }
                if (response.ok !== true) {
                    throw new Error(`#${sub.id} ${response.msg ?? '服务器错误'}`);
                }
            }));
            if (results.every(result => result.status === 'fulfilled')) {
                vscode.window.showInformationMessage('所有订阅已成功重置余额');
                await this.fetchCredits();
            }
            else {
                const failedResults = results
                    .filter((result) => result.status === 'rejected')
                    .map(result => result.reason instanceof Error ? result.reason.message : String(result.reason));
                const isPartialFailure = failedResults.length === validResetableSubscriptions.length ?
                    '全部' : '部分';
                vscode.window.showErrorMessage(`${isPartialFailure}余额重置失败: ${failedResults.join('; ')}`);
            }
        }
        catch (error) {
            console.error('重置余额失败:', error);
            vscode.window.showErrorMessage(`重置余额失败: ${error}`);
        }
        finally {
            this._isUpdating = false;
        }
    }
    async fetchCredits() {
        try {
            const token = this._context.globalState.get('88code_token');
            if (!token) {
                throw new Error('未找到登录令牌');
            }
            const response = await this.httpRequestWithAuth('GET', 'https://www.88code.org/admin-api/cc-admin/system/subscription/my/credit-history?pageNum=1&pageSize=20', token);
            if (response.ok && response.data && response.data.list && response.data.list.length > 0) {
                const remainingCredits = response.data.list[0].remainingCredits;
                this.updateStatusBarDisplay(remainingCredits);
                // 缓存余额数据
                await this._context.globalState.update('88code_cached_credits', {
                    credits: remainingCredits,
                    timestamp: Date.now()
                });
            }
            else {
                throw new Error(response.msg || '获取余额数据失败');
            }
        }
        catch (error) {
            console.error('获取余额失败:', error);
            this.showCachedCredits();
            throw error;
        }
    }
    showCachedCredits() {
        const cachedData = this._context.globalState.get('88code_cached_credits');
        if (cachedData && cachedData.credits !== undefined) {
            // 如果缓存数据不超过10分钟，则显示缓存的余额
            const tenMinutes = 10 * 60 * 1000;
            if (Date.now() - cachedData.timestamp < tenMinutes) {
                this.updateStatusBarDisplay(cachedData.credits, true);
                return;
            }
        }
        this._statusBarItem.text = '$(alert) 余额未知';
    }
    updateStatusBarDisplay(credits, isCached = false) {
        if (credits !== undefined) {
            const cacheIndicator = isCached ? ' (缓存)' : '';
            // 计算余额变化
            let changeText = '';
            let flashColor = undefined;
            if (this._previousCredits !== undefined && this._previousCredits !== credits) {
                const change = credits - this._previousCredits;
                if (change < 0 && this._settings.showDecrease) {
                    // 余额减少：显示负值，橙色闪烁（如果用户启用）
                    changeText = ` (${change})`;
                    flashColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                }
                else if (change > 0 && this._settings.showIncrease) {
                    // 余额增加：显示正值，绿色闪烁（如果用户启用）
                    changeText = ` (+${change})`;
                    flashColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                }
            }
            // 使用用户自定义的前缀和后缀
            const prefix = this._settings.prefixText || '剩余余额: ';
            const suffix = this._settings.suffixText || '';
            // 显示完整的美元金额，包含变化提示
            this._statusBarItem.text = `$(credit-card) ${prefix}$${credits}${changeText}${suffix}${cacheIndicator}`;
            // 如果有变化，设置闪烁背景色
            if (flashColor) {
                this._statusBarItem.backgroundColor = flashColor;
                // 清除之前的定时器
                if (this._hideChangeTimer) {
                    clearTimeout(this._hideChangeTimer);
                }
                // 1秒后隐藏变化提示并恢复正常背景色
                this._hideChangeTimer = setTimeout(() => {
                    this.updateStatusBarDisplayWithoutChange(credits, isCached);
                }, 1000);
            }
            else {
                // 没有变化时，根据余额数量设置背景色（美元单位）
                if (credits >= 0.5) {
                    this._statusBarItem.backgroundColor = undefined; // 默认背景
                }
                else if (credits >= 0 && credits < 0.5) {
                    this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground'); // 红色背景
                }
                else if (credits < 0) {
                    this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBar.debuggingBackground'); // 灰色背景
                }
            }
            // 保存当前余额用于下次比较
            this._previousCredits = credits;
        }
        else {
            this._statusBarItem.text = '$(credit-card) 余额加载中...';
            this._statusBarItem.tooltip = '正在获取剩余余额信息...';
            this._statusBarItem.backgroundColor = undefined;
        }
    }
    updateStatusBarDisplayWithoutChange(credits, isCached = false) {
        const cacheIndicator = isCached ? ' (缓存)' : '';
        // 使用用户自定义的前缀和后缀
        const prefix = this._settings.prefixText || '剩余余额: ';
        const suffix = this._settings.suffixText || '';
        // 显示完整的美元金额，不包含变化提示
        this._statusBarItem.text = `$(credit-card) ${prefix}$${credits}${suffix}${cacheIndicator}`;
        // 根据余额数量设置背景色（美元单位）
        if (credits >= 0.5) {
            this._statusBarItem.backgroundColor = undefined; // 默认背景
        }
        else if (credits >= 0 && credits < 0.5) {
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground'); // 红色背景
        }
        else if (credits < 0) {
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBar.debuggingBackground'); // 灰色背景
        }
    }
    formatCredits(credits) {
        // 显示完整数字，不使用任何格式化
        return credits.toString();
    }
    startPeriodicRefresh() {
        // 每2秒自动刷新一次
        this._refreshTimer = setInterval(async () => {
            try {
                await this.fetchCredits();
            }
            catch (error) {
                console.log('定时刷新余额失败:', error);
            }
        }, 2 * 1000);
    }
    stopPeriodicRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = undefined;
        }
        if (this._subscriptionRefreshTimer) {
            clearInterval(this._subscriptionRefreshTimer);
            this._subscriptionRefreshTimer = undefined;
        }
    }
    async fetchSubscriptionInfo() {
        try {
            const token = this._context.globalState.get('88code_token');
            if (!token) {
                return;
            }
            const response = await this.httpRequestWithAuth('GET', 'https://www.88code.org/admin-api/cc-admin/system/subscription/my', token);
            if (response.ok && response.data && Array.isArray(response.data)) {
                this._subscriptionData = response.data;
                this.updateTooltip();
            }
        }
        catch (error) {
            console.error('获取订阅信息失败:', error);
        }
    }
    startSubscriptionRefresh() {
        // 立即获取一次
        this.fetchSubscriptionInfo();
        // 每2秒刷新一次订阅信息
        this._subscriptionRefreshTimer = setInterval(async () => {
            try {
                await this.fetchSubscriptionInfo();
            }
            catch (error) {
                console.log('定时刷新订阅信息失败:', error);
            }
        }, 2 * 1000);
    }
    updateTooltip() {
        if (!this._subscriptionData || !Array.isArray(this._subscriptionData)) {
            return;
        }
        // 筛选活跃中的订阅
        const activeSubscriptions = this._subscriptionData.filter((sub) => sub.subscriptionStatus === '活跃中');
        if (activeSubscriptions.length === 0) {
            const tooltip = new vscode.MarkdownString('**点击刷新剩余余额**\n\n暂无活跃订阅');
            tooltip.supportHtml = true;
            this._statusBarItem.tooltip = tooltip;
            return;
        }
        // CSS 样式定义
        const styles = `
            <style>
                .subscription-tooltip {
                    padding: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    max-width: 400px;
                }

                .tooltip-header {
                    margin: 0 0 16px 0;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #555;
                    font-size: 15px;
                    font-weight: 600;
                    color: #fff;
                }

                .subscription-divider {
                    height: 2px;
                    background: linear-gradient(to right, transparent, #888, transparent);
                    margin: 24px 0;
                    border-radius: 1px;
                }

                .subscription-item {
                    margin-bottom: 16px;
                }

                .plan-header {
                    margin: 12px 0 8px 0;
                    padding: 12px;
                    background: linear-gradient(135deg, #2d2d2d 0%, #252525 100%);
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }

                .plan-header.status-low { border-left: 4px solid #E74C3C; }
                .plan-header.status-normal { border-left: 4px solid #0078D4; }
                .plan-header.status-high { border-left: 4px solid #2ECC71; }

                .subscription-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 13px;
                    margin-top: 8px;
                    background: #252525;
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }

                .subscription-table thead tr {
                    background: linear-gradient(180deg, #3a3a3a 0%, #333 100%);
                }

                .subscription-table th {
                    padding: 10px 12px;
                    font-weight: 600;
                    color: #fff;
                    border-bottom: 2px solid #444;
                }

                .subscription-table th:first-child {
                    text-align: left;
                    width: 40%;
                }

                .subscription-table th:last-child {
                    text-align: right;
                }

                .subscription-table tbody tr {
                    transition: background-color 0.2s ease;
                }

                .subscription-table tbody tr:hover {
                    background: #2a2a2a;
                }

                .subscription-table tbody tr:not(:last-child) {
                    border-bottom: 1px solid #333;
                }

                .subscription-table td {
                    padding: 10px 12px;
                    color: #ddd;
                }

                .subscription-table td:first-child {
                    text-align: left;
                    color: #fff;
                }

                .subscription-table td:last-child {
                    text-align: right;
                }

                .progress-row {
                    background: linear-gradient(180deg, #2d2d2d 0%, #2a2a2a 100%) !important;
                }

                .progress-row td {
                    padding: 14px 12px !important;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .progress-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #fff;
                }

                .progress-status {
                    font-size: 11px;
                    color: #999;
                    padding: 2px 8px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                }

                .progress-bar-container {
                    position: relative;
                    height: 28px;
                    background: #1a1a1a;
                    border-radius: 14px;
                    overflow: hidden;
                    border: 1px solid #444;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
                }

                .progress-bar-fill {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    border-radius: 14px 0 0 14px;
                }

                .progress-bar-fill.full {
                    border-radius: 14px;
                }

                .progress-bar-fill.color-low {
                    background: linear-gradient(90deg, #E74C3C 0%, #C0392B 100%);
                    box-shadow: 0 0 15px rgba(231, 76, 60, 0.6);
                }

                .progress-bar-fill.color-normal {
                    background: linear-gradient(90deg, #0078D4 0%, #005A9E 100%);
                    box-shadow: 0 0 15px rgba(0, 120, 212, 0.6);
                }

                .progress-bar-fill.color-high {
                    background: linear-gradient(90deg, #2ECC71 0%, #27AE60 100%);
                    box-shadow: 0 0 15px rgba(46, 204, 113, 0.6);
                }

                .progress-bar-text {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 12px;
                    color: #fff;
                    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
                    letter-spacing: 0.3px;
                }

                .highlight-value {
                    font-weight: 700;
                    color: #FFA500;
                }

                .speed-value {
                    color: #3498DB;
                    font-weight: 600;
                }

                .tooltip-footer {
                    margin-top: 16px;
                    padding: 10px;
                    background: linear-gradient(135deg, #2d2d2d 0%, #252525 100%);
                    border-radius: 6px;
                    text-align: center;
                    font-size: 11px;
                    color: #999;
                    border: 1px dashed #444;
                }
            </style>
        `;
        // 构建 HTML 内容
        let content = styles + '<div class="subscription-tooltip">';
        content += '<h3 class="tooltip-header">📊 订阅信息详情</h3>';
        activeSubscriptions.forEach((sub, index) => {
            // 在每个订阅之间添加分割线
            if (index > 0) {
                content += '<div class="subscription-divider"></div>';
            }
            const plan = sub.subscriptionPlan || {};
            const currentCredits = sub.currentCredits || 0;
            const creditLimit = plan.creditLimit || 1; // 避免除以0
            const percentage = (currentCredits / creditLimit) * 100;
            // 根据百分比确定进度条颜色和状态
            let statusClass = 'status-normal';
            let colorClass = 'color-normal';
            let progressStatus = '📈 额度正常';
            if (percentage < 5) {
                statusClass = 'status-low';
                colorClass = 'color-low';
                progressStatus = '⚠️ 额度不足';
            }
            else if (percentage > 80) {
                statusClass = 'status-high';
                colorClass = 'color-high';
                progressStatus = '✅ 额度充足';
            }
            const isFull = percentage >= 99.9;
            // 套餐标题
            content += '<div class="subscription-item">';
            content += '<div class="plan-header ' + statusClass + '">';
            content += '🎯 ' + (sub.subscriptionPlanName || '未知套餐');
            content += '</div>';
            // 表格开始
            content += '<table class="subscription-table">';
            // 表头
            content += '<thead><tr>';
            content += '<th>项目</th>';
            content += '<th>详情</th>';
            content += '</tr></thead>';
            // 表体
            content += '<tbody>';
            // 费用行
            content += '<tr>';
            content += '<td><strong>💰 费用</strong></td>';
            content += '<td>¥' + (sub.cost || 0) + '</td>';
            content += '</tr>';
            // 计费周期行
            content += '<tr>';
            content += '<td><strong>🔄 计费周期</strong></td>';
            content += '<td>' + (sub.billingCycleDesc || sub.billingCycle || '-') + '</td>';
            content += '</tr>';
            // 剩余天数行
            content += '<tr>';
            content += '<td><strong>⏰ 剩余天数</strong></td>';
            content += '<td><span class="highlight-value">' + (sub.remainingDays || 0) + ' 天</span></td>';
            content += '</tr>';
            // 额度进度条行
            content += '<tr class="progress-row">';
            content += '<td colspan="2">';
            content += '<div class="progress-header">';
            content += '<span class="progress-title">💎 额度使用情况</span>';
            content += '<span class="progress-status">' + progressStatus + '</span>';
            content += '</div>';
            // 进度条
            content += '<div class="progress-bar-container">';
            content += '<div class="progress-bar-fill ' + colorClass + (isFull ? ' full' : '') + '" style="width:' + Math.min(percentage, 100).toFixed(1) + '%"></div>';
            content += '<div class="progress-bar-text">';
            content += '$' + currentCredits.toFixed(2) + ' / $' + creditLimit.toFixed(2) + ' (' + percentage.toFixed(1) + '%)';
            content += '</div>';
            content += '</div>';
            content += '</td>';
            content += '</tr>';
            // 恢复速度行
            content += '<tr>';
            content += '<td><strong>⚡ 恢复速度</strong></td>';
            content += '<td><span class="speed-value">$' + (plan.creditsPerHour || 0) + '</span> / 小时</td>';
            content += '</tr>';
            // 开始时间行
            content += '<tr>';
            content += '<td><strong>🕐 开始时间</strong></td>';
            content += '<td>' + (sub.startDate || '-') + '</td>';
            content += '</tr>';
            // 到期时间行（移除红色样式）
            content += '<tr>';
            content += '<td><strong>⏳ 到期时间</strong></td>';
            content += '<td>' + (sub.endDate || '-') + '</td>';
            content += '</tr>';
            content += '</tbody>';
            content += '</table>';
            content += '</div>';
        });
        // 底部提示
        content += '<div class="tooltip-footer">💡 点击状态栏可刷新数据</div>';
        content += '</div>';
        const tooltip = new vscode.MarkdownString(content);
        tooltip.supportHtml = true;
        tooltip.isTrusted = true;
        this._statusBarItem.tooltip = tooltip;
    }
    // 显示订阅信息面板
    showSubscriptionPanel() {
        if (!this._subscriptionData || !Array.isArray(this._subscriptionData)) {
            vscode.window.showInformationMessage('订阅信息加载中，请稍后再试...');
            return;
        }
        // 筛选活跃中的订阅
        const activeSubscriptions = this._subscriptionData.filter((sub) => sub.subscriptionStatus === '活跃中');
        if (activeSubscriptions.length === 0) {
            vscode.window.showInformationMessage('暂无活跃订阅');
            return;
        }
        // 如果面板已存在，则直接显示
        if (this._subscriptionPanel) {
            this._subscriptionPanel.reveal(vscode.ViewColumn.One);
            // 更新内容
            this._subscriptionPanel.webview.html = this.getSubscriptionPanelHtml(activeSubscriptions);
            return;
        }
        // 创建新面板
        this._subscriptionPanel = vscode.window.createWebviewPanel('subscriptionInfo', '📊 订阅信息详情', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        // 设置面板内容
        this._subscriptionPanel.webview.html = this.getSubscriptionPanelHtml(activeSubscriptions);
        // 监听面板关闭事件
        this._subscriptionPanel.onDidDispose(() => {
            this._subscriptionPanel = undefined;
        });
    }
    // 生成订阅信息面板的 HTML 内容
    getSubscriptionPanelHtml(activeSubscriptions) {
        // CSS 样式定义
        const styles = `
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background: #1e1e1e;
                    color: #cccccc;
                    padding: 24px;
                    line-height: 1.6;
                }

                .container {
                    max-width: 900px;
                    margin: 0 auto;
                }

                .header {
                    margin-bottom: 32px;
                    padding-bottom: 16px;
                    border-bottom: 3px solid #555;
                }

                .header h1 {
                    font-size: 28px;
                    font-weight: 700;
                    color: #ffffff;
                    margin-bottom: 8px;
                }

                .header p {
                    font-size: 14px;
                    color: #999;
                }

                .subscription-divider {
                    height: 3px;
                    background: linear-gradient(to right, transparent, #888, transparent);
                    margin: 32px 0;
                    border-radius: 2px;
                }

                .subscription-item {
                    margin-bottom: 24px;
                    animation: fadeIn 0.5s ease;
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .plan-header {
                    margin: 16px 0 12px 0;
                    padding: 16px;
                    background: linear-gradient(135deg, #2d2d2d 0%, #252525 100%);
                    border-radius: 8px;
                    font-size: 18px;
                    font-weight: 700;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                    transition: transform 0.2s ease;
                }

                .plan-header:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.4);
                }

                .plan-header.status-low {
                    border-left: 6px solid #E74C3C;
                    background: linear-gradient(135deg, #3d2d2d 0%, #352525 100%);
                }
                .plan-header.status-normal {
                    border-left: 6px solid #0078D4;
                    background: linear-gradient(135deg, #2d3540 0%, #252d35 100%);
                }
                .plan-header.status-high {
                    border-left: 6px solid #2ECC71;
                    background: linear-gradient(135deg, #2d3d30 0%, #253528 100%);
                }

                .subscription-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 14px;
                    margin-top: 12px;
                    background: #252525;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }

                .subscription-table thead tr {
                    background: linear-gradient(180deg, #3a3a3a 0%, #333 100%);
                }

                .subscription-table th {
                    padding: 14px 16px;
                    font-weight: 700;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #fff;
                    border-bottom: 3px solid #444;
                }

                .subscription-table th:first-child {
                    text-align: left;
                    width: 35%;
                }

                .subscription-table th:last-child {
                    text-align: right;
                }

                .subscription-table tbody tr {
                    transition: all 0.2s ease;
                    cursor: pointer;
                }

                .subscription-table tbody tr:hover {
                    background: #2d2d2d;
                    transform: scale(1.01);
                }

                .subscription-table tbody tr:not(:last-child) {
                    border-bottom: 1px solid #333;
                }

                .subscription-table td {
                    padding: 14px 16px;
                    color: #ddd;
                }

                .subscription-table td:first-child {
                    text-align: left;
                    color: #fff;
                    font-weight: 600;
                }

                .subscription-table td:last-child {
                    text-align: right;
                    font-weight: 500;
                }

                .progress-row {
                    background: linear-gradient(180deg, #2d2d2d 0%, #2a2a2a 100%) !important;
                }

                .progress-row:hover {
                    background: linear-gradient(180deg, #323232 0%, #2f2f2f 100%) !important;
                }

                .progress-row td {
                    padding: 18px 16px !important;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .progress-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: #fff;
                }

                .progress-status {
                    font-size: 12px;
                    color: #999;
                    padding: 4px 12px;
                    background: rgba(255,255,255,0.08);
                    border-radius: 12px;
                    font-weight: 600;
                }

                .progress-bar-container {
                    position: relative;
                    height: 36px;
                    background: #1a1a1a;
                    border-radius: 18px;
                    overflow: hidden;
                    border: 2px solid #444;
                    box-shadow: inset 0 2px 6px rgba(0,0,0,0.4);
                }

                .progress-bar-fill {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                    border-radius: 16px 0 0 16px;
                }

                .progress-bar-fill.full {
                    border-radius: 16px;
                }

                .progress-bar-fill.color-low {
                    background: linear-gradient(90deg, #E74C3C 0%, #C0392B 100%);
                    box-shadow: 0 0 20px rgba(231, 76, 60, 0.7);
                }

                .progress-bar-fill.color-normal {
                    background: linear-gradient(90deg, #0078D4 0%, #005A9E 100%);
                    box-shadow: 0 0 20px rgba(0, 120, 212, 0.7);
                }

                .progress-bar-fill.color-high {
                    background: linear-gradient(90deg, #2ECC71 0%, #27AE60 100%);
                    box-shadow: 0 0 20px rgba(46, 204, 113, 0.7);
                }

                .progress-bar-text {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 14px;
                    color: #fff;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                    letter-spacing: 0.5px;
                }

                .highlight-value {
                    font-weight: 800;
                    color: #FFA500;
                }

                .speed-value {
                    color: #3498DB;
                    font-weight: 700;
                }

                .footer {
                    margin-top: 32px;
                    padding: 16px;
                    background: linear-gradient(135deg, #2d2d2d 0%, #252525 100%);
                    border-radius: 8px;
                    text-align: center;
                    font-size: 13px;
                    color: #999;
                    border: 2px dashed #444;
                }

                .footer strong {
                    color: #fff;
                }
            </style>
        `;
        // 构建 HTML 内容
        let html = `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>订阅信息详情</title>
            ${styles}
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 订阅信息详情</h1>
                    <p>查看您的所有活跃订阅和额度使用情况</p>
                </div>`;
        activeSubscriptions.forEach((sub, index) => {
            // 在每个订阅之间添加分割线
            if (index > 0) {
                html += '<div class="subscription-divider"></div>';
            }
            const plan = sub.subscriptionPlan || {};
            const currentCredits = sub.currentCredits || 0;
            const creditLimit = plan.creditLimit || 1;
            const percentage = (currentCredits / creditLimit) * 100;
            // 根据百分比确定进度条颜色和状态
            let statusClass = 'status-normal';
            let colorClass = 'color-normal';
            let progressStatus = '📈 额度正常';
            if (percentage < 5) {
                statusClass = 'status-low';
                colorClass = 'color-low';
                progressStatus = '⚠️ 额度不足';
            }
            else if (percentage > 80) {
                statusClass = 'status-high';
                colorClass = 'color-high';
                progressStatus = '✅ 额度充足';
            }
            const isFull = percentage >= 99.9;
            // 套餐标题
            html += '<div class="subscription-item">';
            html += '<div class="plan-header ' + statusClass + '">';
            html += '🎯 ' + (sub.subscriptionPlanName || '未知套餐');
            html += '</div>';
            // 表格
            html += '<table class="subscription-table">';
            html += '<thead><tr><th>项目</th><th>详情</th></tr></thead>';
            html += '<tbody>';
            // 费用行
            html += '<tr><td><strong>💰 费用</strong></td><td>¥' + (sub.cost || 0) + '</td></tr>';
            // 计费周期行
            html += '<tr><td><strong>🔄 计费周期</strong></td><td>' + (sub.billingCycleDesc || sub.billingCycle || '-') + '</td></tr>';
            // 剩余天数行
            html += '<tr><td><strong>⏰ 剩余天数</strong></td><td><span class="highlight-value">' + (sub.remainingDays || 0) + ' 天</span></td></tr>';
            // 额度进度条行
            html += '<tr class="progress-row"><td colspan="2">';
            html += '<div class="progress-header">';
            html += '<span class="progress-title">💎 额度使用情况</span>';
            html += '<span class="progress-status">' + progressStatus + '</span>';
            html += '</div>';
            html += '<div class="progress-bar-container">';
            html += '<div class="progress-bar-fill ' + colorClass + (isFull ? ' full' : '') + '" style="width:' + Math.min(percentage, 100).toFixed(1) + '%"></div>';
            html += '<div class="progress-bar-text">$' + currentCredits.toFixed(2) + ' / $' + creditLimit.toFixed(2) + ' (' + percentage.toFixed(1) + '%)</div>';
            html += '</div></td></tr>';
            // 恢复速度行
            html += '<tr><td><strong>⚡ 恢复速度</strong></td><td><span class="speed-value">$' + (plan.creditsPerHour || 0) + '</span> / 小时</td></tr>';
            // 开始时间行
            html += '<tr><td><strong>🕐 开始时间</strong></td><td>' + (sub.startDate || '-') + '</td></tr>';
            // 到期时间行
            html += '<tr><td><strong>⏳ 到期时间</strong></td><td>' + (sub.endDate || '-') + '</td></tr>';
            html += '</tbody></table></div>';
        });
        html += `
                <div class="footer">
                    💡 <strong>提示：</strong>此页面会保持打开，您可以随时查看订阅信息
                </div>
            </div>
        </body>
        </html>`;
        return html;
    }
    httpRequestWithAuth(method, url, token, data) {
        return new Promise((resolve, reject) => {
            const urlObj = new url_1.URL(url);
            const postData = data ? JSON.stringify(data) : undefined;
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'saToken': token,
                'User-Agent': 'VSCode Extension'
            };
            if (postData) {
                headers['Content-Length'] = Buffer.byteLength(postData);
            }
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: headers
            };
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        resolve(response);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
            req.on('error', (error) => {
                reject(error);
            });
            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }
    dispose() {
        this.stopPeriodicRefresh();
        if (this._hideChangeTimer) {
            clearTimeout(this._hideChangeTimer);
            this._hideChangeTimer = undefined;
        }
        if (this._subscriptionPanel) {
            this._subscriptionPanel.dispose();
            this._subscriptionPanel = undefined;
        }
        this._statusBarItem.dispose();
    }
}
exports.CreditService = CreditService;
//# sourceMappingURL=CreditService.js.map