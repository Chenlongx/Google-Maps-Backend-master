const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 生成随机激活码
function generateActivationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 20; i++) {
    if (i > 0 && i % 5 === 0) {
      code += '-';
    }
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

exports.handler = async (event) => {
  // 只允许 POST 请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    const { 
      quantity = 1, 
      validDays = 365, 
      notes = '',
      startDate = null,
      endDate = null
    } = JSON.parse(event.body);

    // 验证参数
    if (quantity < 1 || quantity > 100) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: '数量必须在1-100之间' })
      };
    }

    // 处理时间参数
    let startTime, endTime;
    
    if (startDate && endDate) {
      // 使用自定义开始和结束时间
      startTime = new Date(startDate);
      endTime = new Date(endDate);
      
      // 验证时间
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, message: '无效的时间格式' })
        };
      }
      
      if (startTime >= endTime) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, message: '开始时间必须早于结束时间' })
        };
      }
      
      // 检查时间范围（最多10年）
      const maxDuration = 10 * 365 * 24 * 60 * 60 * 1000; // 10年
      if (endTime.getTime() - startTime.getTime() > maxDuration) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, message: '激活码有效期不能超过10年' })
        };
      }
      
    } else if (validDays) {
      // 使用传统的天数计算方式
      if (validDays < 1 || validDays > 3650) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, message: '有效期必须在1-3650天之间' })
        };
      }
      
      const now = new Date();
      startTime = now;
      endTime = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: '必须提供有效期天数或开始/结束时间' })
      };
    }

    // 生成激活码
    const codes = [];
    const now = new Date();

    for (let i = 0; i < quantity; i++) {
      const code = generateActivationCode();
      codes.push({
        code,
        status: 'active',
        created_at: now.toISOString(),
        start_date: startTime.toISOString(),
        expiry_date: endTime.toISOString(),
        notes,
        product_type: 'mediamingle_pro'
      });
    }

    // 保存到数据库
    const { data, error } = await supabase
      .from('activation_codes')
      .insert(codes)
      .select();

    if (error) {
      console.error('保存激活码失败:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: '保存激活码失败' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        codes: data,
        message: `成功生成 ${quantity} 个激活码`
      })
    };

  } catch (error) {
    console.error('生成激活码失败:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: '生成激活码失败' })
    };
  }
};
