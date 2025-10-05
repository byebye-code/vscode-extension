"use strict";
/**
 * 密码加密工具模块
 * 使用国密SM4算法对密码进行加密
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptData = void 0;
// @ts-ignore
const CryptoSM = require("sm-crypto");
const CryptoJS = require("crypto-js");
// SM4加密密钥 (必须与后端保持一致)
const SM4_KEY = '1024lab__1024lab';
/**
 * 将字符串转换为16进制
 * @param str 原始字符串
 * @returns 16进制字符串
 */
function stringToHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
}
/**
 * 将对象转换为字符串
 * @param data 数据对象
 * @returns 字符串
 */
function object2string(data) {
    if (typeof data === 'string') {
        return data;
    }
    return JSON.stringify(data);
}
/**
 * SM4加密对象
 */
const SM4 = {
    /**
     * 使用SM4算法加密数据
     * @param data 要加密的数据
     * @returns Base64编码的加密数据
     */
    encryptData: function (data) {
        // 第一步：将数据转为字符串
        let dataStr = object2string(data);
        // 第二步：SM4 加密（密钥转为16进制）
        let encryptData = CryptoSM.sm4.encrypt(dataStr, stringToHex(SM4_KEY));
        // 第三步：Base64 编码
        return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(encryptData));
    }
};
/**
 * 加密数据（主要用于密码加密）
 * @param data 要加密的数据
 * @returns 加密后的Base64字符串
 */
const encryptData = function (data) {
    return !data ? null : SM4.encryptData(data);
};
exports.encryptData = encryptData;
//# sourceMappingURL=encrypt.js.map