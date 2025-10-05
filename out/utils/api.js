"use strict";
/**
 * API 客户端工具模块
 * 处理与后端服务器的通信
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.getCaptcha = void 0;
const https = require("https");
const url_1 = require("url");
// API 基础地址
const API_BASE_URL = 'https://88code.org';
/**
 * 执行 HTTP 请求
 * @param method HTTP 方法
 * @param path API 路径
 * @param token 可选的认证token
 * @param data 可选的请求体数据
 * @returns Promise<ResponseDTO>
 */
function httpRequest(method, path, token, data) {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE_URL}${path}`;
        const urlObj = new url_1.URL(url);
        const postData = data ? JSON.stringify(data) : undefined;
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'VSCode Extension'
        };
        // 如果有token,添加到请求头
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['saToken'] = token;
        }
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
                    // 检查响应是否成功
                    if (!response.ok || response.code !== 0) {
                        reject(new Error(response.msg || `请求失败 (code: ${response.code})`));
                    }
                    else {
                        resolve(response);
                    }
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
/**
 * 获取验证码
 * @returns Promise<CaptchaData>
 */
async function getCaptcha() {
    const response = await httpRequest('GET', '/admin-api/login/getCaptcha');
    return response.data;
}
exports.getCaptcha = getCaptcha;
/**
 * 账号密码登录
 * @param loginRequest 登录请求数据
 * @returns Promise<LoginData>
 */
async function login(loginRequest) {
    const response = await httpRequest('POST', '/admin-api/login', undefined, loginRequest);
    return response.data;
}
exports.login = login;
//# sourceMappingURL=api.js.map