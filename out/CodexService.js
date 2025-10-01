"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexService = void 0;
const vscode = require("vscode");
const https = require("https");
const url_1 = require("url");
class CodexService {
    constructor(context) {
        this._isUpdating = false;
        this._context = context;
        // 创建状态栏项目，显示在积分右侧
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        this._statusBarItem.tooltip = 'Codex 剩余用量';
        // 初始化显示
        this.updateStatusBarDisplay();
        // 注册到上下文订阅
        context.subscriptions.push(this._statusBarItem);
    }
    async start() {
        // 隐藏 Codex 状态栏显示
        this._statusBarItem.hide();
        // 检查是否已登录
        // const token = this._context.globalState.get('88code_token') as string;
        // if (token) {
        //     this._statusBarItem.show();
        //     await this.fetchCodexUsage();
        //     this.startPeriodicRefresh();
        // } else {
        //     this._statusBarItem.hide();
        // }
    }
    async stop() {
        this._statusBarItem.hide();
        this.stopPeriodicRefresh();
    }
    async refreshCodexUsage() {
        const token = this._context.globalState.get('88code_token');
        if (!token) {
            return;
        }
        if (this._isUpdating) {
            return; // 防止重复请求
        }
        this._isUpdating = true;
        try {
            await this.fetchCodexUsage();
        }
        catch (error) {
            console.error('获取 Codex 用量失败:', error);
            this._statusBarItem.text = '$(alert) Codex 获取失败';
        }
        finally {
            this._isUpdating = false;
        }
    }
    async fetchCodexUsage() {
        try {
            const token = this._context.globalState.get('88code_token');
            if (!token) {
                throw new Error('未找到登录令牌');
            }
            const response = await this.httpRequestWithAuth('GET', 'https://www.88code.org/admin-api/cc-admin/user/openai-daily-usage', token);
            if (response.ok && response.data) {
                const { used, limit } = response.data;
                const remaining = limit - used;
                this.updateStatusBarDisplay(remaining, limit);
                // 缓存 Codex 数据
                await this._context.globalState.update('88code_cached_codex', {
                    remaining: remaining,
                    limit: limit,
                    timestamp: Date.now()
                });
            }
            else {
                throw new Error(response.msg || '获取 Codex 数据失败');
            }
        }
        catch (error) {
            console.error('获取 Codex 用量失败:', error);
            this.showCachedCodexUsage();
            throw error;
        }
    }
    showCachedCodexUsage() {
        const cachedData = this._context.globalState.get('88code_cached_codex');
        if (cachedData && cachedData.remaining !== undefined && cachedData.limit !== undefined) {
            // 如果缓存数据不超过10分钟，则显示缓存的数据
            const tenMinutes = 10 * 60 * 1000;
            if (Date.now() - cachedData.timestamp < tenMinutes) {
                this.updateStatusBarDisplay(cachedData.remaining, cachedData.limit, true);
                return;
            }
        }
        this._statusBarItem.text = '$(alert) Codex 未知';
    }
    updateStatusBarDisplay(remaining, limit, isCached = false) {
        if (remaining !== undefined && limit !== undefined) {
            const cacheIndicator = isCached ? ' (缓存)' : '';
            this._statusBarItem.text = `$(code) Codex: $${remaining.toFixed(2)}/$${limit.toFixed(2)}${cacheIndicator}`;
            this._statusBarItem.tooltip = `Codex 剩余用量: $${remaining.toFixed(2)}/$${limit.toFixed(2)}${cacheIndicator}`;
            // 根据剩余量设置背景色
            if (remaining < 5) {
                this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground'); // 红色背景
            }
            else if (remaining <= 0) {
                this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBar.debuggingBackground'); // 灰色背景
            }
            else {
                this._statusBarItem.backgroundColor = undefined; // 默认背景
            }
        }
        else {
            this._statusBarItem.text = '$(code) Codex 加载中...';
            this._statusBarItem.tooltip = '正在获取 Codex 用量信息...';
            this._statusBarItem.backgroundColor = undefined;
        }
    }
    startPeriodicRefresh() {
        // 每2秒自动刷新一次
        this._refreshTimer = setInterval(async () => {
            try {
                await this.fetchCodexUsage();
            }
            catch (error) {
                console.log('定时刷新 Codex 用量失败:', error);
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
exports.CodexService = CodexService;
//# sourceMappingURL=CodexService.js.map