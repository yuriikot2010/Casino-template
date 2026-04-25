const crypto = require('crypto');


const MAINNET_URL = 'https://pay.crypt.bot/api';
const TESTNET_URL = 'https://testnet-pay.crypt.bot/api';
const API_TOKEN = process.env.CRYPTO_PAY_TOKEN; 
const EXCHANGE_RATE = 100; // 1 USDT = 100 RUBY

const IS_TESTNET = process.env.CRYPTO_NET === 'testnet' || (API_TOKEN && API_TOKEN.includes('test')); 
const API_URL = IS_TESTNET ? TESTNET_URL : MAINNET_URL;

console.log(`📡 Crypto Service Initialized: ${IS_TESTNET ? '🧪 TESTNET' : '💸 MAINNET'} (${API_URL})`);

const doFetch = async (url, options) => {
    if (typeof fetch === 'function') return fetch(url, options);
    try {
        const nf = require('node-fetch');
        return nf(url, options);
    } catch (e) {
        throw new Error('Node.js v18+ required or "npm install node-fetch"');
    }
};

async function cryptoApiCall(endpoint, body = {}) {
    if (!API_TOKEN) throw new Error('CRYPTO_PAY_TOKEN not set');
    
    const baseUrl = API_URL.replace(/\/$/, '');
    const url = `${baseUrl}/${endpoint}`;
    
    try {
        const response = await doFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Crypto-Pay-API-Token': API_TOKEN
            },
            body: JSON.stringify(body)
        });
        
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error(`API Bad JSON`); }

        if (!data.ok) {
            console.error(`⚠️ API Error [${endpoint}]:`, data.error);
            throw new Error(data.error?.name || 'CryptoPay API Error');
        }

        return data.result;

    } catch (error) {
        throw error;
    }
}

async function createDepositInvoice(userId, amountUsdt) {
    const cleanAmount = parseFloat(amountUsdt).toFixed(2);
    const amountRuby = Math.floor(parseFloat(cleanAmount) * EXCHANGE_RATE);
    const invoice = await cryptoApiCall('createInvoice', {
        asset: 'USDT',
        amount: cleanAmount,
        description: `Deposit ${amountRuby} RUBY`,
        payload: JSON.stringify({ userId, type: 'deposit' }),
        allow_comments: false,
        allow_anonymous: false,
        expires_in: 3600
    });
    return {
        invoiceId: invoice.invoice_id,
        payUrl: invoice.mini_app_invoice_url || invoice.bot_invoice_url || invoice.pay_url,
        amountRuby
    };
}

async function sendWithdrawal(userId, amountUsdt, withdrawalId) {
    const cleanAmount = parseFloat(amountUsdt).toFixed(2);
    return await cryptoApiCall('transfer', {
        user_id: parseInt(userId),
        asset: 'USDT',
        amount: cleanAmount,
        spend_id: withdrawalId
    });
}

async function getInvoices(invoiceIds) {
    if (!invoiceIds || invoiceIds.length === 0) return [];
    const result = await cryptoApiCall('getInvoices', { invoice_ids: invoiceIds });
    return result.items || [];
}

async function getAppBalance() {
    try {
        const result = await cryptoApiCall('getBalance');
        if (Array.isArray(result)) {
            const usdt = result.find(a => a.currency_code === 'USDT');
            return usdt ? parseFloat(usdt.available) : 0.0;
        } 
        return 0.0;
    } catch (e) { return 0.0; }
}

function verifyWebhook(rawBody, signature) {
    if (!API_TOKEN) return false;
    const secret = crypto.createHash('sha256').update(API_TOKEN).digest();
    if (!rawBody) return false;
    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return hmac === signature;
}

module.exports = {
    createDepositInvoice,
    sendWithdrawal,
    getInvoices,
    verifyWebhook,
    getAppBalance,
    EXCHANGE_RATE,
    IS_TESTNET
};