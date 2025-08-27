// // 文件路径: netlify/functions/payment.js (最终生产版)

// const AlipaySdk = require('alipay-sdk').default;

// exports.handler = async (event) => {
//     // 允许的来源白名单
//     const allowedOrigins = [
//         'http://localhost:8888',
//         'https://google-maps-backend-master.netlify.app',
//         ""
//     ];
//     const origin = event.headers.origin;

//     // 准备CORS响应头
//     let headers = {
//       'Access-Control-Allow-Headers': 'Content-Type',
//       'Access-Control-Allow-Methods': 'POST, OPTIONS'
//     };
//     if (allowedOrigins.includes(origin)) {
//         headers['Access-Control-Allow-Origin'] = origin;
//     }

//     // 1. 响应浏览器的 OPTIONS 预检请求
//     if (event.httpMethod === 'OPTIONS') {
//         return { statusCode: 204, headers: headers, body: '' };
//     }

//     // 只处理POST请求
//     if (event.httpMethod !== 'POST') {
//         return { statusCode: 405, body: 'Method Not Allowed', headers };
//     }

//     // ====== 核心业务逻辑开始 ======
//     try {
//         // ====== 2. 【关键】在 try...catch 块内进行支付宝 SDK 初始化 ======
//         // 这样如果初始化失败，我们能捕获到具体的错误
//         const alipaySdk = new AlipaySdk({
//             appId: process.env.ALIPAY_APP_ID,
//             privateKey: process.env.ALIPAY_PRIVATE_KEY.replace(/\\n/g, '\n'),
//             alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
//             gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
//         });
        
//         const { productId, price, email } = JSON.parse(event.body);

//         if (!productId || !price || !email) {
//             return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Missing parameters' }), headers };
//         }

//         const encodedEmail = Buffer.from(email).toString('base64');
//         const outTradeNo = `${productId}-${Date.now()}-${encodedEmail}`;
        
//         let subject = '未知商品';
//         if (productId.startsWith('gmaps')) {
//             subject = productId.includes('premium') ? 'Google Maps Scraper 高级版' : 'Google Maps Scraper 标准版';
//         } else if (productId.startsWith('validator')) {
//             subject = productId.includes('premium') ? 'Email Validator 高级版激活码' : 'Email Validator 标准版激活码';
//         }

//         const result = await alipaySdk.exec('alipay.trade.precreate', {
//             bizContent: {
//                 out_trade_no: outTradeNo,
//                 total_amount: price,
//                 subject: subject,
//                 notify_url: `https://google-maps-backend-master.netlify.app/.netlify/functions/alipay-notify`
//             },
//         });

//         return {
//             statusCode: 200,
//             headers: headers,
//             body: JSON.stringify({ success: true, qrCodeUrl: result.qrCode })
//         };

//     } catch (error) {
//         // ====== 3. 【关键】提供更详细的错误日志 ======
//         console.error('Function execution error:', error);
        
//         // 检查是否是SDK初始化失败
//         let errorMessage = 'Failed to create payment order.';
//         if (error.message && (error.message.includes('private key') || error.message.includes('public key'))) {
//             errorMessage = 'Alipay SDK initialization failed. Please check your environment variables for private/public keys.';
//         }

//         return {
//             statusCode: 500,
//             headers: headers,
//             body: JSON.stringify({ success: false, message: errorMessage })
//         };
//     }
// };


// 文件路径: netlify/functions/payment.js (硬编码密钥 - 仅供调试使用！)

const AlipaySdk = require('alipay-sdk').default;

// 允许的来源白名单
const allowedOrigins = [
    'http://localhost:8888',
    'https://google-maps-backend-master.netlify.app'
];

exports.handler = async (event) => {
    const origin = event.headers.origin;
    let headers = {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    if (allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed', headers };
    }

    // ====== ▼▼▼【核心修改】直接在代码中写入您的密钥 ▼▼▼ ======
    try {
        // 将密钥字符串完整地放入代码中
        const hardcoded_private_key = "-----BEGIN PRIVATE KEY-----\n" +
            "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQChIwr8dGNq2DNe1BVV7Pi5q5A4x2p1NVdfUqynEIR2iFbx/lGFVVbrhkHI8Q2IKqi/OO1CXE+q3ZOETUubf/9bGS4Zxtgakuyv3ynkkh8DhlF2Eg14OGtFpkpdsUIS3ipMMnxZj6G+O+DsDokrwh7ymcv/OO7VfzzQqQ5cGG6fZ7ZMcBNhZ01zGDtLE0HII1QlMxhBBvPDXBJSkcVql86CbMuiHul5ZX3nROf6D7ZkvaoV6V55g6MdacKifpuF17Vu+WnQIr1auTnj6NQ80z28vp+78JDvyVsTGAztNqnpYnQj0X+VDv2sNOnYgjZk2L0wj726YD51ssZPnVHvpb9DAgMBAAECggEAT0xrj6nHc0FKppRAm7SvAtCHfSnGHkBN6z9IcD8UsTCPeS/q9m71A5tirHzUZ/p2aQSe3lWHb1Lz0dwoJTJsfGx733uXxhwgFr0AZNf0I0vqsuxXbJ53TCN13X3qQlbLAgymXXzt4CyfmAvfPYWerU06szNVdgPT7ewEgRYU+qTIo/4ABIbJXOEZ8hOt/YnvpceWxiu6u5jxsQuXBIXhwVgYZ/hjC62L1+Kt2o+3QAsmcNEUFDYDzl3ud2fKec6nLvP9PcbN3os8Mo0AicDbsIEcNs6x8kZBSh97wGL8jbbCE7oXmtlNWlE6Z8cvqCpLhfSlCZ2nidzmKEWZ4bayoQKBgQDw4GtRFgKTAIsJrKJU0XvU376cOgLdipBxQxnXk+/2DNKSVyJGkoyHi14sBXrE6xIf9I3FnF6AsHE6xM3a5cwkEN2Uu6n1nHse9M+2KAFJ42jqEk6u1MlW3V0LAwqyVYCRI3jOtfgRA3vmOWS62lSipo3B5I1XAcbf3QgHCXMUBwKBgQCrQPn2wdSRhj+rczdtCH+T+XvANl32uzHy9aVEe7dyzVg7xNZCKLlX2g4/xXvxEH7AnQ87OROLe7iEI/+q/aKYNn3HilvsHi6nKM9em23NOu2IQsVnzAEptB75Jxwl7VPWyiXdUF3BzLTppF9+yOOkTNshOAFQO0asVfp2bxFD5QKBgEDdLgj31Fmhm89PHaeZga8hUULgnETsO1lEqIDU5ZlseofNzv0SGaWmcgWItDay1n6kbEj6grhEyzj4Jjb8Cqzrnb+fiXUKXl1Hr2dt/mrXQjlGFMofotgxZAzDFO5Q9/4dfzqq5dIvDf5BFk763C+wihvcX/M+Fz/RVYgPk12hAoGABiq41aH1PahP8qSbglmj/ngldK6Ag7oJ+m3OHcE2wfOTEdPsw0UkJ326taEu7WdiqRz+x2suwP8bjead9lJb4I9VyDG7Ta1okKxvi0Cdm55bn2SIJ0y5Xf8WfnJiGRuKwVlWM7oJJklw2lkI90/Uor4Bxhh2M6VuzhXqhwlI3eECgYEAqUA+Wpc65phNqpx4wiN648GGRGNRgq32AdQwABFZulhwxyaM4IhknQdebdxe/tfF5nyP5wMQrSHpLgFYcw2FOQ3ikcbFac3gIp45ANYi1hZYE4RNCUEjxJGXJYXkcqvuMrjWyOqC0+yiU5IFwQ5UdDVb6orIsqp/LV6lNP8NswI=\n" +
            "-----END PRIVATE KEY-----";

        const alipaySdk = new AlipaySdk({
            appId: "9021000151648033",
            privateKey: hardcoded_private_key,
            alipayPublicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoSMK/HRjatgzXtQVVez4uauQOMdqdTVXX1KspxCEdohW8f5RhVVW64ZByPENiCqovzjtQlxPqt2ThE1Lm3//WxkuGcbYGpLsr98p5JIfA4ZRdhINeDhrRaZKXbFCEt4qTDJ8WY+hvjvg7A6JK8Ie8pnL/zju1X880KkOXBhun2e2THATYWdNcxg7SxNByCNUJTMYQQbzw1wSUpHFapfOgmzLoh7peWV950Tn+g+2ZL2qFeleeYOjHWnCon6bhde1bvlp0CK9Wrk54+jUPNM9vL6fu/CQ78lbExgM7Tap6WJ0I9F/lQ79rDTp2II2ZNi9MI+9umA+dbLGT51R76W/QwIDAQAB",
            gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
        });
        
        // ... 后续的业务逻辑完全不变 ...
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
        console.error('Function execution error:', error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, message: 'Failed to create payment order.' })
        };
    }
};