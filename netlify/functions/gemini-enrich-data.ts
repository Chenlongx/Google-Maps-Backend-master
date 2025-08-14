// // 导入所需的包
// import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
// import { Handler } from '@netlify/functions';
// import { createClient } from '@supabase/supabase-js';

// // --- 1. 初始化客户端 ---
// const supabaseUrl = process.env.SUPABASE_URL as string;
// const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
// const supabase = createClient(supabaseUrl, supabaseKey);

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY as string
// });

// // --- 2. 定义数据结构 (TypeScript 接口) ---
// interface Company {
//   name: string;
// }

// interface EnrichedCompany {
//   name: string;
//   address: string | null;
//   phone: string | null;
//   email: string | null;
//   website: string | null;
//   facebook: string | null;
//   instagram: string | null;
//   youtube: string | null;
//   linkedin: string | null;
//   "交易数据": {
//     "出口国家": string[];
//     "进口国家": string[];
//     "产品类别": string[];
//     "年份": number[];
//     "总值": number | null;
//   };
// }

// // --- 3. Netlify 无服务器函数处理器 ---
// export const handler: Handler = async (event, context) => {
//   if (event.httpMethod !== 'POST') {
//     return { statusCode: 405, body: 'Method Not Allowed' };
//   }

//   try {
//     // ... 用户验证和数据库查询逻辑保持不变 ...
//     const { user_id, companies }: { user_id: string, companies: Company[] } = JSON.parse(event.body as string);

//     if (!user_id || !companies || !Array.isArray(companies) || companies.length === 0) {
//       return { statusCode: 400, body: JSON.stringify({ success: false, message: '请求参数不正确，需要 user_id 和一个非空的公司数组。' }) };
//     }
//     const { data: user, error: userError } = await supabase
//       .from('user_accounts')
//       .select('is_ai_authorized, ai_tokens_remaining')
//       .eq('id', user_id)
//       .single();

//     if (userError || !user) {
//       return { statusCode: 404, body: JSON.stringify({ success: false, message: '用户不存在' }) };
//     }
//     if (!user.is_ai_authorized) {
//       return { statusCode: 403, body: JSON.stringify({ success: false, message: 'AI功能未授权' }) };
//     }
//     const tokens_needed = companies.length;
//     if (user.ai_tokens_remaining < tokens_needed) {
//       return { statusCode: 402, body: JSON.stringify({ success: false, message: 'AI点数余额不足' }) };
//     }


//     // --- 构建 Prompt (保持不变) ---
//     const companiesListString = JSON.stringify(companies.map(c => c.name), null, 2);
//     const prompt = `
// 您是一个专业的数据查询与情报采集专家。请根据我提供的公司列表，使用全网互联网搜索查询它们的完整联系信息和贸易数据。
// 严格按照以下 JSON 模板返回，所有公司放在同一个数组中，所有字段必须包含，即使值为 null。
// 除 JSON 外不得输出任何额外说明。

// JSON模板:
// {
//   "公司": [
//     {
//       "name": "公司全名",
//       "address": "公司地址",
//       "phone": "主要电话",
//       "email": "电子邮箱",
//       "website": "官方网站链接",
//       "facebook": "Facebook页面链接",
//       "instagram": "Instagram 页面链接",
//       "youtube": "YouTube 频道链接",
//       "linkedin": "LinkedIn页面链接",
//       "交易数据": {
//         "出口国家": [], "进口国家": [], "产品类别": [], "年份": [], "总值": null
//       }
//     }
//   ]
// }

// 公司列表:
// ${companiesListString}
// `;

//     // --- 调用 Gemini 模型 ---
//     const modelName = 'gemini-pro';
//     const contents = [{ role: "user", parts: [{ text: prompt }] }];
//     const safetySettings = [
//       { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
//       { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
//       { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
//       { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
//     ];

//     // 【最终修正】
//     // 严格遵循您参考代码的结构，创建一个 'config' 对象来包裹 'tools'。
//     const config = {
//       tools: [{ googleSearch: {} }],
//       // 如果需要，也可以加入 thinkingConfig 等其他配置
//       // thinkingConfig: { thinkingBudget: -1 }, 
//     };

//     // 调用 generateContent。注意：我们使用 generateContent 而非流式版本，因为需要一个完整的 JSON 结果。
//     // 将 model, contents, config, safetySettings 作为顶层参数传入。
//     const result = await ai.models.generateContentStream({
//       model: modelName,
//       contents,
//       config, // <--- 关键修正：传入 'config' 对象
//     });

//     const response = result;

//     if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
//       console.error("AI Response Invalid Structure:", JSON.stringify(response, null, 2));
//       throw new Error("AI未能返回有效的响应内容。");
//     }

//     const aiResponseText = response.candidates[0].content.parts[0].text;

//     if (typeof aiResponseText !== 'string') {
//       console.error("AI未能返回文本内容，实际返回:", JSON.stringify(response.candidates[0].content.parts[0], null, 2));
//       throw new Error("AI未能返回预期的文本格式。");
//     }

//     // --- 后续的 JSON 解析和数据库更新逻辑保持不变 ---
//     let parsedAiResponse;
//     try {
//       parsedAiResponse = JSON.parse(aiResponseText);
//     } catch (e) {
//       const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
//       if (jsonMatch && jsonMatch[0]) {
//         parsedAiResponse = JSON.parse(jsonMatch[0]);
//       } else {
//         console.error("AI Response Text:", aiResponseText);
//         throw new Error("AI未能返回有效的JSON格式。");
//       }
//     }

//     if (!parsedAiResponse["公司"] || !Array.isArray(parsedAiResponse["公司"])) {
//       throw new Error("AI未能返回预期的 { '公司': [...] } JSON结构。");
//     }
//     const enrichedData: EnrichedCompany[] = parsedAiResponse["公司"];

//     const new_tokens_remaining = user.ai_tokens_remaining - tokens_needed;
//     await supabase
//       .from('user_accounts')
//       .update({ ai_tokens_remaining: new_tokens_remaining })
//       .eq('id', user_id);

//     return {
//       statusCode: 200,
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         success: true,
//         data: enrichedData,
//         tokens_used: tokens_needed,
//         tokens_remaining: new_tokens_remaining
//       }),
//     };

//   } catch (error: unknown) {
//     // ... 错误处理逻辑保持不变 ...
//     let message = "处理请求时发生未知错误。";
//     if (error instanceof Error) message = error.message;
//     console.error("在AI处理过程中发生错误:", error);
//     return {
//       statusCode: 500,
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         success: false,
//         message: message,
//       }),
//     };
//   }
// };


// 导入所需的包
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// --- 1. 初始化客户端 ---
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY as string
});

// --- 2. 定义数据结构 (TypeScript 接口) ---
interface Company {
  name: string;
}

interface EnrichedCompany {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  "交易数据": {
    "出口国家": string[];
    "进口国家": string[];
    "产品类别": string[];
    "年份": number[];
    "总值": number | null;
  };
}

// --- 3. Netlify 无服务器函数处理器 ---
export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { user_id, companies }: { user_id: string; companies: Company[] } = JSON.parse(event.body as string);

    if (!user_id || !companies || !Array.isArray(companies) || companies.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: '请求参数不正确，需要 user_id 和一个非空的公司数组。' }) };
    }

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
    if (user.ai_tokens_remaining < tokens_needed) {
      return { statusCode: 402, body: JSON.stringify({ success: false, message: 'AI点数余额不足' }) };
    }

    // --- 构建 Prompt ---
    const companiesListString = JSON.stringify(companies.map(c => c.name), null, 2);
    const prompt = `
您是一个专业的数据查询与情报采集专家。请根据我提供的公司列表，使用全网互联网搜索查询它们的完整联系信息和贸易数据。
严格按照以下 JSON 模板返回，所有公司放在同一个数组中，所有字段必须包含，即使值为 null。
除 JSON 外不得输出任何额外说明。

JSON模板:
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
        "出口国家": [], "进口国家": [], "产品类别": [], "年份": [], "总值": null
      }
    }
  ]
}

公司列表:
${companiesListString}
`;

    // --- 配置模型 ---
    const modelName = 'gemini-2.5-pro';
    const contents = [{ role: "user", parts: [{ text: prompt }] }];

    const config = {
      tools: [{ googleSearch: {} }],
      // thinkingConfig: { thinkingBudget: -1 }, // 可选
    };

    // --- 调用 generateContentStream ---
    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents,
      config
    });

    let aiResponseText = '';
    for await (const chunk of responseStream) {
      if (chunk.text) {
        aiResponseText += chunk.text;
      }
    }

    // --- 解析 AI 返回的 JSON ---
    let parsedAiResponse;
    try {
      parsedAiResponse = JSON.parse(aiResponseText);
    } catch (e) {
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0]) {
        parsedAiResponse = JSON.parse(jsonMatch[0]);
      } else {
        console.error("AI Response Text:", aiResponseText);
        throw new Error("AI未能返回有效的JSON格式。");
      }
    }

    if (!parsedAiResponse["公司"] || !Array.isArray(parsedAiResponse["公司"])) {
      throw new Error("AI未能返回预期的 { '公司': [...] } JSON结构。");
    }

    const enrichedData: EnrichedCompany[] = parsedAiResponse["公司"];

    // --- 更新用户剩余 token ---
    const new_tokens_remaining = user.ai_tokens_remaining - tokens_needed;
    await supabase
      .from('user_accounts')
      .update({ ai_tokens_remaining: new_tokens_remaining })
      .eq('id', user_id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: enrichedData,
        tokens_used: tokens_needed,
        tokens_remaining: new_tokens_remaining
      }),
    };

  } catch (error: unknown) {
    let message = "处理请求时发生未知错误。";
    if (error instanceof Error) message = error.message;
    console.error("在AI处理过程中发生错误:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message,
      }),
    };
  }
};
