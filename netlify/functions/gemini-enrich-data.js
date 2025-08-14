const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require('@supabase/supabase-js');

// 初始化
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { user_id, companies } = JSON.parse(event.body);

        if (!user_id || !Array.isArray(companies) || companies.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: '请求参数不正确' }) };
        }
        
        // 1. 用户验证
        const { data: user, error: userError } = await supabase
            .from('user_accounts')
            .select('is_ai_authorized, ai_tokens_remaining')
            .eq('id', user_id)
            .single();

        if (userError || !user) {
            return { statusCode: 404, body: JSON.stringify({ success: false, message: '用户不存在' }) };
        }
        if (!user.is_ai_authorized) {
            return { statusCode: 403, body: JSON.stringify({ success: false, message: 'AI功能未授权' }) };
        }
        
        const tokens_needed = companies.length;
        if (Number(user.ai_tokens_remaining) < tokens_needed) {
            return { statusCode: 402, body: JSON.stringify({ success: false, message: 'AI点数余额不足' }) };
        }

        // 2. Prompt
        const companiesListString = JSON.stringify(companies.map(c => c.name), null, 2);
        const prompt = `
您是一个专业的数据查询与情报采集专家。
请根据我提供的公司列表，使用互联网搜索查询它们的完整联系信息和贸易数据。
严格按照以下 JSON 模板返回，所有字段必须包含，即使值为 null。

JSON模板：
{
  "公司": [
    {
      "name": "公司全名",
      "address": "公司地址",
      "phone": "主要电话",
      "email": "电子邮箱",
      "website": "官方网站链接",
      "facebook": "Facebook页面链接",
      "instagram": "Instagram 页面链接",
      "youtube": "YouTube 频道链接",
      "linkedin": "LinkedIn页面链接",
      "交易数据": {
        "出口国家": [],
        "进口国家": [],
        "产品类别": [],
        "年份": [],
        "总值": null
      }
    }
  ]
}

公司列表:
${companiesListString}
`;

        // 3. 调用 Gemini（联网版模型）
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest", // 带浏览功能
        });

        const result = await model.generateContent(prompt);
        let aiText = result.response.text();

        // 4. 提取 JSON（更鲁棒）
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI 未返回有效的 JSON");
        }

        let enrichedData;
        try {
            enrichedData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.error("原始 AI 输出:", aiText);
            throw new Error("JSON 解析失败");
        }

        // 5. 更新 Token
        const new_tokens_remaining = Number(user.ai_tokens_remaining) - tokens_needed;
        await supabase
            .from('user_accounts')
            .update({ ai_tokens_remaining: new_tokens_remaining })
            .eq('id', user_id);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                data: enrichedData,
                tokens_used: tokens_needed,
                tokens_remaining: new_tokens_remaining
            })
        };

    } catch (e) {
        console.error("AI处理时发生错误:", e);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: e.message }) };
    }
};
