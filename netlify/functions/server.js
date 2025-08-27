// server.js
const express = require('express');
const AlipaySdk = require('alipay-sdk').default;
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // 允许跨域请求

// ====== ▼▼▼ 在这里填入您在支付宝开放平台获取的密钥 ▼▼▼ ======
const alipaySdk = new AlipaySdk({
    appId: "9021000151648033",
    privateKey:
      "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCTwwLi6v/f4A83YTCDKLfzWp2EneUs+eY1/CPO/a/p2mT2eZmx11RPodfjW6AmQ8SyZ+iXveD3SlCnlzMtsUMuqqqzfQg6EqzFUxGmgNTAfuP5FWsUXP78glX8TCFzUsw+0KOI1HdaqUoMjpaV7SAUvAlw+6fVGvaRXbr/9y/Xfs2FPkgSkJBJed1fo4XeLfmXDC0IaD1XhC6PZGV+aI7M+KMRMNssiM3oz/cQYbs+Y18zZYaj5i6g3RxxaB2M08ZFExbe13WunBxcE4pgS2hrQmUBJOSjJsZV3NzP3JcFLHihL70AxmgOXnNFh2SHWgXohp3TKFH10YPZoWrQSj/7AgMBAAECggEAEf1dHZl026Hg2GI50M4lTziKEvpSS56FO69eALZ8M2GGh0eYwcEwn51ZtnGSVvZLPVlPRSI2AIWIuk67SWXagxT+QWoIlWFurXuGm5n1zRXl1Y6ZAdqspLuNknEGZY8AFOm7703G1j/kJxE5HjnHfR7Dm4DYFyb4PAyIVt+WcIrtN5n7f6Z3TvGOB35rGaVPCH2ZSZU5bofLPMQqnRuRS0zv6ktN2mfw1u1mGyfMhbTfzcnl84KPuFGJHHjJcwTXFbcJC5mY53yRzbdvfQb6QG6i6DBEV1o4jZLKstDunEPQAmapBOf5/smP+9pW6oglFfBTMgLay/KDYj52cP6WYQKBgQDNKks7eCCthkBmE/Kyo6m/fru+tMVCnlHH7oqqXCQrST984GySiVZDQMNPlMkFyro/KpHq27N6/gyx2H9Da/eALTQK7Uj7P47BkV8syE86wPSjxKzZisyKGQ9XvxU19wmDjjnfcQ22/9T3KpkSdwuECj5lyDnmbdjueSjwJn9kUQKBgQC4X5hgQjTiXUwbmO9nAaZwY06LjLKzP2XfFitnvPiwbLYgV/+qum7aIh9LSXvoUjdWjm9SVAEwOQ5r4WQfRq2vJrjwM9JqnRPsMDYbjK0tloLoUgYgmpB17nli4Ffv2xO1YUnhbOkDfR0MJmgeowaea6oB364hIlmxGvsrFGhIiwKBgFl4bD6O8JE7zrG1WU2WGdysw+syoiOfL0LlQAtzC0LlOo6WwEJXKgtCHuqBk/i2o+oQAnpNPUQRri+Qnk8kslZvYBazy/Plj7fSUZMR95tDsmwIxOhJo1FGBG7bocBa7wcz6wEKKFT51EHFjeODjr4SSYvReY6HsOauZ6/y2fNBAoGAYhoDYtx3dSa9U0XZxE49eDlu1pPjlbqbAsuyBr2m+YCum6EXGYmfaBOV4SJVerUcWsLo+r5V74m8YayI8JdT3QlWiACa6j1wF1FDyP7eOo6GUwUp23lCem2MSw8h2y8PWohMnlSr2z5cEVXyOrL1159j0yFobprvbGv1zuNJ5acCgYB+woFo3pFE9cTiB2RVUBJh/Zpa+3T9ppf/D4Nq3JAUnuH/XHpHd4+zWlAjVQNkeEw84S0FOtpi/3/kYWhiP0YSKiXz6p8qYKr7aAvFtA/V9fEtUsEDukT2we6XmVofOWhQdiOYNke9XLvFbEPmyFnWnwfEMHIoPMDVH2fgzjco0g==",
    alipayPublicKey:
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhNlncu+dbzYz0nXFFZYAkF+NolGCWOyyzTY3JoVG5IdG0DmrMSI9SJo7kV2r9yv28kMSAHyUojvX+WOh0BYCrpXbSG8DZiGCIgnxbg4IgamqtZ5y+KOdgxo4snooebcwPE2Ft1x3LLsDIA5Juo0OdD3PZYlaj3rcrzAj6MN9ckUaNLPk5A8Ta/avYVITQ3PTgLKmSpiAE8SdHLcuXmODWdromUBxXgHvaAOE9TWu7nFxBykvILHb71d//QCy2BOpngOn6rzPgI56PZAkPeMYpy1thZKkp9zRBKK1FRN0rFNa2G1uvc7Jsflp0t5c6YGGE3iO9J8AOvR4HnsY9YvdgwIDAQAB",
    gateway: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
    appAuthToken: "<-- 请填写应用授权令牌 -->",
  });
// ==========================================================

// 创建支付订单的API接口
app.post('/api/create-payment', async (req, res) => {
    const { productId, price, email } = req.body;

    if (!productId || !price || !email) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    // 将用户邮箱进行 Base64 编码，以安全地放入订单号
    const encodedEmail = Buffer.from(email).toString('base64');

    // 生成唯一的订单号，格式：产品ID-时间戳-编码后的邮箱
    const outTradeNo = `${productId}-${Date.now()}-${encodedEmail}`;
    
    // 从 productId 解析商品标题
    let subject = '未知商品';
    if (productId.startsWith('gmaps')) {
        subject = productId.includes('premium') ? 'Google Maps Scraper 高级版' : 'Google Maps Scraper 标准版';
    } else if (productId.startsWith('validator')) {
        subject = productId.includes('premium') ? 'Email Validator 高级版激活码' : 'Email Validator 标准版激活码';
    }

    try {
        const result = await alipaySdk.exec('alipay.trade.precreate', {
            bizContent: {
                out_trade_no: outTradeNo,
                total_amount: price,
                subject: subject,
            },
        });

        res.json({ success: true, qrCodeUrl: result.qrCode });

    } catch (error) {
        console.error('Alipay API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Payment server is running on port ${PORT}`);
});