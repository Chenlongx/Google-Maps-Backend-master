// functions/activate.js
const { createClient } = require('@supabase/supabase-js');

// 在Netlify后台设置这些环境变量，而不是硬编码
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async function(event, context) {
  // 只接受POST请求
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { licenseKey, machineId } = JSON.parse(event.body);

    if (!licenseKey || !machineId) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: '缺少激活码或机器码。' }) };
    }

    // 1. 查询激活码是否存在
    const { data: license, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('key', licenseKey)
      .single();

    if (error || !license) {
      return { statusCode: 404, body: JSON.stringify({ success: false, message: '无效的激活码。' }) };
    }

    // 2. 检查激活码状态
    if (license.status === 'revoked' || license.status === 'expired') {
      return { statusCode: 403, body: JSON.stringify({ success: false, message: `此激活码已${license.status === 'revoked' ? '被吊销' : '过期'}。` }) };
    }
    
    // 3. 检查是否已被其他机器使用
    if (license.machine_id && license.machine_id !== machineId) {
      return { statusCode: 403, body: JSON.stringify({ success: false, message: '此激活码已在另一台设备上激活。' }) };
    }

    // 4. (可选) 检查是否过期
    if (license.expiry_date && new Date(license.expiry_date) < new Date()) {
       await supabase
        .from('licenses')
        .update({ status: 'expired' })
        .eq('key', licenseKey);
      return { statusCode: 403, body: JSON.stringify({ success: false, message: '此激活码已过期。' }) };
    }

    // 5. 所有验证通过，执行激活（绑定机器码）
    if (!license.machine_id) {
        const { error: updateError } = await supabase
            .from('licenses')
            .update({
                machine_id: machineId,
                status: 'active',
                activation_date: new Date().toISOString(),
            })
            .eq('key', licenseKey);

        if (updateError) {
            throw updateError;
        }
    }
    
    // 6. 返回成功响应
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: '激活成功！' })
    };

  } catch (err) {
    console.error('激活过程中发生错误:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: '服务器内部错误，请联系管理员。' })
    };
  }
};