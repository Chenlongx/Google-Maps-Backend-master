// // 文件路径: netlify/functions/payment.js (最小化测试版)

// exports.handler = async (event) => {
//     // 允许的来源白名单
//     const allowedOrigins = [
//         'http://localhost:8888',
//         'https://google-maps-backend-master.netlify.app'
//     ];
//     const origin = event.headers.origin;

//     // 准备CORS响应头
//     let headers = {
//       'Access-Control-Allow-Headers': 'Content-Type',
//       'Access-Control-Allow-Methods': 'POST, OPTIONS' // 明确允许POST方法
//     };
//     if (allowedOrigins.includes(origin)) {
//         headers['Access-Control-Allow-Origin'] = origin;
//     }

//     // 1. 响应浏览器的 OPTIONS 预检请求
//     if (event.httpMethod === 'OPTIONS') {
//         return {
//             statusCode: 204,
//             headers: headers,
//             body: ''
//         };
//     }

//     // 2. 响应 POST 请求
//     if (event.httpMethod === 'POST') {
//         try {
//             // 尝试解析数据，确认请求是有效的
//             const body = JSON.parse(event.body);
//             console.log('Received data:', body);

//             // 返回一个成功的假数据
//             const mockResponse = {
//                 success: true,
//                 qrCodeUrl: 'https://www.alipay.com' // 使用一个假的URL作为占位符
//             };

//             return {
//                 statusCode: 200,
//                 headers: headers,
//                 body: JSON.stringify(mockResponse)
//             };

//         } catch (error) {
//             console.error('Function execution error:', error);
//             return {
//                 statusCode: 500,
//                 headers: headers,
//                 body: JSON.stringify({ success: false, message: 'Server internal error.' })
//             };
//         }
//     }
    
//     // 对于其他所有请求方法，返回不允许
//     return {
//         statusCode: 405,
//         headers: headers,
//         body: 'Method Not Allowed'
//     };
// };



// 文件路径: netlify/functions/payment.js (最终生产版)

const AlipaySdk = require('alipay-sdk').default;

exports.handler = async (event) => {
    // 允许的来源白名单
    const allowedOrigins = [
        'http://localhost:8888',
        'https://google-maps-backend-master.netlify.app',
        ""
    ];
    const origin = event.headers.origin;

    // 准备CORS响应头
    let headers = {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    if (allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    // 1. 响应浏览器的 OPTIONS 预检请求
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: headers, body: '' };
    }

    // 只处理POST请求
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed', headers };
    }

    // ====== 核心业务逻辑开始 ======
    try {
        // ====== 2. 【关键】在 try...catch 块内进行支付宝 SDK 初始化 ======
        // 这样如果初始化失败，我们能捕获到具体的错误
        const alipaySdk = new AlipaySdk({
            appId: process.env.ALIPAY_APP_ID,
            privateKey: process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n'),
            alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
            gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
        });
        
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
        // ====== 3. 【关键】提供更详细的错误日志 ======
        console.error('Function execution error:', error);
        
        // 检查是否是SDK初始化失败
        let errorMessage = 'Failed to create payment order.';
        if (error.message && (error.message.includes('private key') || error.message.includes('public key'))) {
            errorMessage = 'Alipay SDK initialization failed. Please check your environment variables for private/public keys.';
        }

        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, message: errorMessage })
        };
    }
};