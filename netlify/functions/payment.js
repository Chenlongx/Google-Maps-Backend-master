// 文件路径: netlify/functions/payment.js

const AlipaySdk = require('alipay-sdk').default;

// 允许的来源白名单
const allowedOrigins = [
    'http://localhost:8888',
    'https://google-maps-backend-master.netlify.app'
];

exports.handler = async (event) => {
    const origin = event.headers.origin;
    let headers = {
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // 【重要】根据请求来源，动态设置CORS头
    if (allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    // 【重要】处理浏览器的 OPTIONS 预检请求
    // 这是解决CORS问题的关键
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // No Content
            headers: headers
        };
    }
    
    // 只处理POST请求
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed', headers };
    }

    // ====== 支付宝 SDK 初始化 (从环境变量读取) ======
    const alipaySdk = new AlipaySdk({
        appId: process.env.ALIPAY_APP_ID,
        privateKey: process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n'),
        alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
        gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    });

    try {
        const { productId, price, email } = JSON.parse(event.body);

        if (!productId || !price || !email) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Missing parameters' }), headers };
        }

        const encodedEmail = Buffer.from(email).toString('base64');
        const outTradeNo = `${productId}-${Date.now()}-${encodedEmail}`;
        
        let subject = '未知商品';
        if (productId.startsWith('gmaps')) {
            subject = productId.includes('premium') ? 'Google Maps Scraper 高级版' : 'Google Maps Scraper 标准版';
        } else if (productId.startsWith('validator')) {
            subject = productId.includes('premium') ? 'Email Validator 高级版激活码' : 'Email Validator 标准版激活码';
        }

        const result = await alipaySdk.exec('alipay.trade.precreate', {
            bizContent: {
                out_trade_no: outTradeNo,
                total_amount: price,
                subject: subject,
                notify_url: `https://google-maps-backend-master.netlify.app/.netlify/functions/alipay-notify`
            },
        });

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ success: true, qrCodeUrl: result.qrCode })
        };

    } catch (error) {
        console.error('Alipay API Error:', error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, message: 'Failed to create payment order' })
        };
    }
};