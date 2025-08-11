// // const { createClient } = require('@supabase/supabase-js');


// // const supabaseUrl = process.env.SUPABASE_URL;
// // const supabaseKey = process.env.SUPABASE_ANON_KEY;
// // const supabase = createClient(supabaseUrl, supabaseKey);

// // // 计算到期日期的函数 (逻辑保持不变)
// // function calculateExpirationDate(timeLimit) {
// //     const currentDate = new Date();
// //     let expirationDate;

// //     switch (timeLimit) {
// //         case '1day':
// //             expirationDate = new Date(currentDate);
// //             expirationDate.setDate(expirationDate.getDate() + 1);
// //             break;
// //         case '1week':
// //             expirationDate = new Date(currentDate);
// //             expirationDate.setDate(expirationDate.getDate() + 7);
// //             break;
// //         case '1month':
// //             expirationDate = new Date(currentDate);
// //             expirationDate.setMonth(expirationDate.getMonth() + 1);
// //             break;
// //         case '1year':
// //             expirationDate = new Date(currentDate);
// //             expirationDate.setFullYear(expirationDate.getFullYear() + 1);
// //             break;
// //         case 'permanent':
// //             expirationDate = null; // 永久用户没有到期日期
// //             break;
// //         default:
// //             expirationDate = null; // 无效或未提供时间限制
// //     }
// //     // 返回 ISO 格式的日期字符串，Supabase 更易于处理
// //     return expirationDate ? expirationDate.toISOString() : null;
// // }

// // // Netlify 函数主处理逻辑
// // exports.handler = async (event) => {
// //     if (event.httpMethod !== 'POST') {
// //         return {
// //             statusCode: 405,
// //             body: JSON.stringify({ message: '只支持 POST 请求' }),
// //         };
// //     }

// //     const { account, password, user_type, time_limit } = JSON.parse(event.body);
// //     const userType = user_type;
// //     const timeLimit = time_limit;

// //     if (!account || !password || !userType) {
// //         return {
// //             statusCode: 400,
// //             body: JSON.stringify({ message: '账号、密码和用户类型不能为空' }),
// //         };
// //     }

// //     if (userType === 'regular' && !timeLimit) {
// //         return {
// //             statusCode: 400,
// //             body: JSON.stringify({ message: '正式用户必须提供时间限制' }),
// //         };
// //     }

// //     try {
// //         // 步骤 1: 检查账号是否已在 'user_accounts' 表中存在
// //         const { data: existingUser, error: findError } = await supabase
// //             .from('user_accounts')
// //             .select('account')
// //             .eq('account', account)
// //             .single();

// //         if (findError && findError.code !== 'PGRST116') {
// //             throw findError;
// //         }

// //         if (existingUser) {
// //             return {
// //                 statusCode: 409,
// //                 body: JSON.stringify({ message: '此账号已存在' }),
// //             };
// //         }

// //         // 步骤 2: 直接使用原始密码，不进行哈希处理
// //         const rawPassword = password; 

// //         // 步骤 3: 在 'user_accounts' 表中存储新用户信息
// //         const expirationDate = userType === 'regular' ? calculateExpirationDate(timeLimit) : null;

// //         // 准备要插入的数据
// //         const newUser = {
// //             account: account,
// //             password: rawPassword, // <-- 存储原始密码
// //             user_type: userType,
// //             expiry_at: expirationDate,
// //             status: 'active'       // 为新用户设置默认状态为 'active'
// //         };

// //         const { error: insertError } = await supabase
// //             .from('user_accounts')
// //             .insert(newUser);

// //         if (insertError) {
// //             throw insertError;
// //         }

// //         // 返回成功响应
// //         return {
// //             statusCode: 201,
// //             body: JSON.stringify({ success: true, message: '用户添加成功' }),
// //         };

// //     } catch (error) {
// //         console.error('添加用户失败:', error);
// //         return {
// //             statusCode: error.status || 500,
// //             body: JSON.stringify({ message: error.message || '服务器错误，请稍后再试' }),
// //         };
// //     }
// // };



// const { createClient } = require('@supabase/supabase-js');
// const jwt = require('jsonwebtoken');

// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// const jwtSecret = process.env.JWT_SECRET;

// const supabase = createClient(supabaseUrl, supabaseKey);

// exports.handler = async (event) => {
//     if (event.httpMethod !== 'POST') {
//         return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
//     }

//     try {
//         const { account, password, userType, timeLimit } = JSON.parse(event.body);

//         if (!account || !password || !userType) {
//             return { statusCode: 400, body: JSON.stringify({ message: '账号、密码和用户类型不能为空' }) };
//         }

//         // 检查是否已存在账号
//         const { data: existingUser, error: fetchError } = await supabase
//             .from('user_accounts')
//             .select('*')
//             .eq('account', account)
//             .single();

//         if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
//         if (existingUser) {
//             return { statusCode: 400, body: JSON.stringify({ message: '账号已存在' }) };
//         }

//         // 计算到期时间
//         let expiry_at = null;
//         if (timeLimit && !isNaN(timeLimit)) {
//             expiry_at = new Date();
//             expiry_at.setDate(expiry_at.getDate() + parseInt(timeLimit));
//         }

//         // 插入新用户
//         const { data, error: insertError } = await supabase
//             .from('user_accounts')
//             .insert([{ account, password, user_type: userType, expiry_at }]);

//         if (insertError) throw insertError;

//         // 生成 JWT
//         const token = jwt.sign({ account, userType }, jwtSecret, { expiresIn: '7d' });

//         return {
//             statusCode: 200,
//             body: JSON.stringify({ message: '用户添加成功', token }),
//         };

//     } catch (error) {
//         console.error('添加用户失败:', error);
//         return { statusCode: 500, body: JSON.stringify({ message: '服务器错误', error: error.message }) };
//     }
// };



// netlify/functions/createUser.js
const { createClient } = require('@supabase/supabase-js');

// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; // 取任意其中一个 env 名
// if (!SUPABASE_URL || !SUPABASE_KEY) {
//   console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env');
// }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
// // const supabase = createClient(supabaseUrl, supabaseKey);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 将 timeLimit（快捷选项）转换为毫秒或天数
function timeLimitToDate(timeLimit) {
  if (!timeLimit) return null;
  const now = new Date();
  switch (timeLimit) {
    case '1day':
      now.setDate(now.getDate() + 1); break;
    case '1week':
      now.setDate(now.getDate() + 7); break;
    case '1month':
      now.setMonth(now.getMonth() + 1); break;
    case '1year':
      now.setFullYear(now.getFullYear() + 1); break;
    default:
      return null;
  }
  return now;
}

// 如果数据库要求 expiry_at 非空，permanent 的处理：设置一个远期时间（比如 9999-12-31）
function permanentExpiryDate() {
  return new Date('9999-12-31T23:59:59Z');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success:false, message: '只支持 POST' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const account = (body.account || '').trim();
    const password = body.password || '';
    const userType = body.userType || body.user_type || ''; // 兼容下划线或驼峰
    const timeLimit = body.timeLimit || body.time_limit || null;
    const startDateRaw = body.startDate || body.start_date || null;
    const expiryDateRaw = body.expiryDate || body.expiry_date || null;

    if (!account || !password || !userType) {
      return { statusCode: 400, body: JSON.stringify({ success:false, message:'账号、密码和用户类型不能为空' }) };
    }

    // 1) 检查账号是否已存在
    const { data: exists, error: fetchErr } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('account', account)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error('Supabase select error:', fetchErr);
      return { statusCode: 500, body: JSON.stringify({ success:false, message: '查询账号失败', error: fetchErr.message }) };
    }
    if (exists) {
      return { statusCode: 409, body: JSON.stringify({ success:false, message: '账号已存在' }) };
    }

    // 2) 计算 expiry_at（优先级：前端 expiryDate > timeLimit 算出 > userType 默认 > permanent）
    let expiryAt = null;

    if (expiryDateRaw) {
      // 前端传了明确的到期时间（ISO）
      expiryAt = new Date(expiryDateRaw);
      if (isNaN(expiryAt.getTime())) expiryAt = null;
    }

    if (!expiryAt && timeLimit) {
      const fromTimeLimit = timeLimitToDate(timeLimit);
      if (fromTimeLimit) expiryAt = fromTimeLimit;
    }

    // 用户类型默认逻辑
    if (!expiryAt) {
      if (userType === 'trial') {
        // 如果是试用，默认 30 天
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expiryAt = d;
      } else if (userType === 'permanent') {
        // 永久用户 -> 远期时间（因为你的表不允许 NULL）
        expiryAt = permanentExpiryDate();
      } else if (userType === 'regular') {
        // 正式用户但未提供任何时间 -> 默认 1 年
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        expiryAt = d;
      } else {
        // 兜底：30 天
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expiryAt = d;
      }
    }

    // created_at: 当前时间
    const createdAt = new Date();

    // 建立插入对象（确保字段名和 DB 一致）
    const newUser = {
      account: account,
      password: password,        // 注意：生产应当加密/哈希，这里保留原文按你的要求
      user_type: userType,
      created_at: createdAt.toISOString(),
      expiry_at: expiryAt.toISOString(),
      status: 'active'
    };

    const { data: insertData, error: insertErr } = await supabase
      .from('user_accounts')
      .insert(newUser)
      .select('id, account');

    if (insertErr) {
      console.error('Supabase insert error:', insertErr);
      return { statusCode: 500, body: JSON.stringify({ success:false, message: '插入用户失败', error: insertErr.message }) };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ success:true, message: '用户添加成功', data: insertData })
    };

  } catch (err) {
    console.error('createUser handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ success:false, message: '服务器内部错误', error: err.message }) };
  }
};
