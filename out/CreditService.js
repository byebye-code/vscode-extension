"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditService = void 0;
const vscode = require("vscode");
const https = require("https");
const url_1 = require("url");
class CreditService {
    constructor(context) {
        this._isUpdating = false;
        this._context = context;
        // 创建状态栏项目，显示在右下角
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        // 设置命令，点击时刷新积分
        this._statusBarItem.command = '88code.refreshCredits';
        this._statusBarItem.tooltip = '点击刷新剩余积分';
        // 初始化显示
        this.updateStatusBarDisplay();
        // 注册到上下文订阅
        context.subscriptions.push(this._statusBarItem);
    }
    async start() {
        // 检查是否已登录
        const token = this._context.globalState.get('88code_token');
        if (token) {
            this._statusBarItem.show();
            await this.fetchCredits();
            this.startPeriodicRefresh();
        }
        else {
            this._statusBarItem.hide();
        }
    }
    async stop() {
        this._statusBarItem.hide();
        this.stopPeriodicRefresh();
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
            vscode.window.showErrorMessage(`获取积分信息失败: ${error}`);
            this._statusBarItem.text = '$(alert) 积分获取失败';
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
                // 缓存积分数据
                await this._context.globalState.update('88code_cached_credits', {
                    credits: remainingCredits,
                    timestamp: Date.now()
                });
            }
            else {
                throw new Error(response.msg || '获取积分数据失败');
            }
        }
        catch (error) {
            console.error('获取积分失败:', error);
            this.showCachedCredits();
            throw error;
        }
    }
    showCachedCredits() {
        const cachedData = this._context.globalState.get('88code_cached_credits');
        if (cachedData && cachedData.credits !== undefined) {
            // 如果缓存数据不超过10分钟，则显示缓存的积分
            const tenMinutes = 10 * 60 * 1000;
            if (Date.now() - cachedData.timestamp < tenMinutes) {
                this.updateStatusBarDisplay(cachedData.credits, true);
                return;
            }
        }
        this._statusBarItem.text = '$(alert) 积分未知';
    }
    updateStatusBarDisplay(credits, isCached = false) {
        if (credits !== undefined) {
            const cacheIndicator = isCached ? ' (缓存)' : '';
            this._statusBarItem.text = `$(credit-card) 剩余积分: ${this.formatCredits(credits)}${cacheIndicator}`;
            this._statusBarItem.tooltip = `剩余积分: ${credits.toLocaleString()}${cacheIndicator}\n点击刷新`;
            // 根据积分数量设置背景色
            if (credits >= 500) {
                this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground'); // 绿色背景
            }
            else if (credits >= 0 && credits < 500) {
                this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground'); // 红色背景
            }
            else if (credits < 0) {
                this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBar.debuggingBackground'); // 灰色背景
            }
            else {
                this._statusBarItem.backgroundColor = undefined; // 默认背景
            }
        }
        else {
            this._statusBarItem.text = '$(credit-card) 积分加载中...';
            this._statusBarItem.tooltip = '正在获取剩余积分信息...';
            this._statusBarItem.backgroundColor = undefined;
        }
    }
    formatCredits(credits) {
        // 不再使用K/M格式，直接显示完整数字
        return credits.toLocaleString();
    }
    startPeriodicRefresh() {
        // 每2秒自动刷新一次
        this._refreshTimer = setInterval(async () => {
            try {
                await this.fetchCredits();
            }
            catch (error) {
                console.log('定时刷新积分失败:', error);
            }
        }, 2 * 1000);
    }
    stopPeriodicRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = undefined;
        }
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
        this._statusBarItem.dispose();
    }
}
exports.CreditService = CreditService;
//# sourceMappingURL=CreditService.js.map