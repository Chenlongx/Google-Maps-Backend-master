const cors = require('cors');
const AlipaySdk = require('alipay-sdk').default;

// 允许的来源白名单
const allowedOrigins = [
    'http://localhost:8888',
    'https://google-maps-backend-master.netlify.app',
    'https://mediamingle.cn'
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
            privateKey:
            "MIIEpAIBAAKCAQEAuyQsu7D1lEURImiydWQSZiHmAiQsXryFGhvfrELl3m7d4QA1+tFJmqVg7EkNvkBwcjMD1j37XUZQ7Fjfpm0gcvBxK2ZVn1rww8iQq3gOcAvHwP2weVYuhpwDEYuFoVbmdeAZIp0rwAhWeGVkPLlDSOkKDEYZxBdNm5JU59d5Tu9qbC/sIix3vxuyXz+Powvc6OZ9vRcjeuIPiP6WnYvtE0SfBE/YzHxvlQE8nAUs08XfhXviXcu0ROFi9EMd9I8prcL6x5lxwW9LsgeJ+zgFoy8f6lMcVYzFEI5m68Bm5Q0HBeFm9hCVFoab4Ntq06lzC/kfJQB5qqIF2R/dnsLaYQIDAQABAoIBAHbP2Law+rlPwDkgT2zIRAYjr2vcm27qMXcKC0/KiTZXHPcksyCyjxBnvslE+Dy5nKpkSSNT5qqpYecr5ZI75kYS8UakiefKTOGADJlQd5obYI7egZQHazJ7ClexRP3Rti9QP6UCNCyPHpcBiEolNNqtWXvBZcphIRyMIuuumY3Kyj89sEu5Dygl1BWG6pUA9kOQgU4MWVtDsB935RGbEEwn1HuQ0TwjY4uqhHfI4z+JLzSPOlMRcyuv4ahrzvFWBVne3D8VuF4w+5itcJR67SQhonACWICDGuN+YHS3UQFYs9iZrC5vQuSP14Yl4n93EoZCxrdB5rbfokWGS7k/SAECgYEA+roj1FVReDKDMKznXG9UccbUo8/oIY+1bLGqc9eRoG+RL2cpEEc7a+ejjZDjLiTZfncc+N0ehcwXKxR0AKHCz14B3wIQmIyHH4oRwyMVlgr0HuwTvX67x4RCjFdmt+EXBzBPZJBSn+ZdBvTvjuHHKLXg+VRPS/uO1x/Qb2dxrTECgYEAvxOz5CiL4cNMlNK2tEkOhSSvn/PkZEPjq1ZFMaEC//Uct2goIccIzjqLaNb5d5F2NN6Ji201+nZolFv19D3ADjdQjQrgEm1OZOXmEUFMgpmRJmQnylIkjBn/JIpC6IB69p8yMf5nw1pHbxUvSdK3mm+O7/RfrjIpUzbezfRO9DECgYBYufZj9a1W88kpOIbHVz5y5QHq1nA3MDvrsxO22tpWBCVEuST29b45eUePmW5Lrg6pik1eZCGhB5BLVnmWn6fo6kOPP5PP6CsJJjsS6x+AcW/iYXi63lZlTJCgSW24NJeJm7b8x3X1z/ertpHv5kYsSfDLSuKk6OiriD6ireC0gQKBgQCMUevJof0XzlRu9k82FnCTVl2jGXigKTsImFI4IAYT8e0kw1i1dXUB/fxjAXwyUqB8MvDPc2QwisRCL0ZwFujzh6uf6FylK6BmeG58PXfycNQnXWXbLneoa27zZpW8KJ4kfsRd8nZBAAt1iBkyHYy33TUbAltBkZTHh4QXu1JAAQKBgQDQ4MwUAVxToTKDIW7YaU4aokqrtbiacoNbR5UH8DGE6LlwnP76jDggWl206gaYB269OxiRDk9w+/atqE0dN7aCv0l/tbpI6yYdCUHQ9KYrzXKpGZhNkUgb2z/53UTcMHnRf0GYFJcQcbjoJW7T7aJ3PNOfZkhrNs/hIA64MBSaAw==",
            alipayPublicKey:
            "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhNlncu+dbzYz0nXFFZYAkF+NolGCWOyyzTY3JoVG5IdG0DmrMSI9SJo7kV2r9yv28kMSAHyUojvX+WOh0BYCrpXbSG8DZiGCIgnxbg4IgamqtZ5y+KOdgxo4snooebcwPE2Ft1x3LLsDIA5Juo0OdD3PZYlaj3rcrzAj6MN9ckUaNLPk5A8Ta/avYVITQ3PTgLKmSpiAE8SdHLcuXmODWdromUBxXgHvaAOE9TWu7nFxBykvILHb71d//QCy2BOpngOn6rzPgI56PZAkPeMYpy1thZKkp9zRBKK1FRN0rFNa2G1uvc7Jsflp0t5c6YGGE3iO9J8AOvR4HnsY9YvdgwIDAQAB",
            gateway: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
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