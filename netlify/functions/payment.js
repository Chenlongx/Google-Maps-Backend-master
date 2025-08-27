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
            "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7JCy7sPWURREiaLJ1ZBJmIeYCJCxevIUaG9+sQuXebt3hADX60UmapWDsSQ2+QHByMwPWPftdRlDsWN+mbSBy8HErZlWfWvDDyJCreA5wC8fA/bB5Vi6GnAMRi4WhVuZ14BkinSvACFZ4ZWQ8uUNI6QoMRhnEF02bklTn13lO72psL+wiLHe/G7JfP4+jC9zo5n29FyN64g+I/padi+0TRJ8ET9jMfG+VATycBSzTxd+Fe+Jdy7RE4WL0Qx30jymtwvrHmXHBb0uyB4n7OAWjLx/qUxxVjMUQjmbrwGblDQcF4Wb2EJUWhpvg22rTqXML+R8lAHmqogXZH92ewtphAgMBAAECggEAds/YtrD6uU/AOSBPbMhEBiOva9ybbuoxdwoLT8qJNlcc9ySzILKPEGe+yUT4PLmcqmRJI1Pmqqlh5yvlkjvmRhLxRqSJ58pM4YAMmVB3mhtgjt6BlAdrMnsKV7FE/dG2L1A/pQI0LI8elwGISiU02q1Ze8FlymEhHIwi666ZjcrKPz2wS7kPKCXUFYbqlQD2Q5CBTgxZW0OwH3flEZsQTCfUe5DRPCNji6qEd8jjP4kvNI86UxFzK6/hqGvO8VYFWd7cPxW4XjD7mK1wlHrtJCGicAJYgIMa435gdLdRAViz2JmsLm9C5I/XhiXif3cShkLGt0Hmtt+iRYZLuT9IAQKBgQD6uiPUVVF4MoMwrOdcb1RxxtSjz+ghj7Vssapz15Ggb5EvZykQRztr56ONkOMuJNl+dxz43R6FzBcrFHQAocLPXgHfAhCYjIcfihHDIxWWCvQe7BO9frvHhEKMV2a34RcHME9kkFKf5l0G9O+O4ccoteD5VE9L+47XH9BvZ3GtMQKBgQC/E7PkKIvhw0yU0ra0SQ6FJK+f8+RkQ+OrVkUxoQL/9Ry3aCghxwjOOoto1vl3kXY03omLbTX6dmiUW/X0PcAON1CNCuASbU5k5eYRQUyCmZEmZCfKUiSMGf8kikLogHr2nzIx/mfDWkdvFS9J0reab47v9F+uMilTNt7N9E70MQKBgFi59mP1rVbzySk4hsdXPnLlAerWcDcwO+uzE7ba2lYEJUS5JPb1vjl5R4+ZbkuuDqmKTV5kIaEHkEtWeZafp+jqQ48/k8/oKwkmOxLrH4Bxb+JheLreVmVMkKBJbbg0l4mbtvzHdfXP96u2ke/mRixJ8MtK4qTo6KuIPqKt4LSBAoGBAIxR68mh/RfOVG72TzYWcJNWXaMZeKApOwiYUjggBhPx7STDWLV1dQH9/GMBfDJSoHwy8M9zZDCKxEIvRnAW6POHq5/oXKUroGZ4bnw9d/Jw1CddZdsud6hrbvNmlbwoniR+xF3ydkEAC3WIGTIdjLfdNRsCW0GRlMeHhBe7UkABAoGBANDgzBQBXFOhMoMhbthpThqiSqu1uJpyg1tHlQfwMYTouXCc/vqMOCBaXbTqBpgHbr07GJEOT3D79q2oTR03toK/SX+1ukjrJh0JQdD0pivNcqkZmE2RSBvbP/ndRNwwedF/QZgUlxBxuOglbtPtonc8059mSGs2z+EgDrgwFJoD\n" +
            "-----END PRIVATE KEY-----";

        const alipaySdk = new AlipaySdk({
            appId: "9021000151648033",
            privateKey: hardcoded_private_key,
            alipayPublicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhNlncu+dbzYz0nXFFZYAkF+NolGCWOyyzTY3JoVG5IdG0DmrMSI9SJo7kV2r9yv28kMSAHyUojvX+WOh0BYCrpXbSG8DZiGCIgnxbg4IgamqtZ5y+KOdgxo4snooebcwPE2Ft1x3LLsDIA5Juo0OdD3PZYlaj3rcrzAj6MN9ckUaNLPk5A8Ta/avYVITQ3PTgLKmSpiAE8SdHLcuXmODWdromUBxXgHvaAOE9TWu7nFxBykvILHb71d//QCy2BOpngOn6rzPgI56PZAkPeMYpy1thZKkp9zRBKK1FRN0rFNa2G1uvc7Jsflp0t5c6YGGE3iO9J8AOvR4HnsY9YvdgwIDAQAB",
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