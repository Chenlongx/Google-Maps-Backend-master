const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase 配置缺失');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function createAdminUser() {
  try {
    // 创建用户（自动哈希密码）
    const { data: user, error: createUserError } = await supabase.auth.admin.createUser({
      email: '2231401652@qq.com', // 你管理员的邮箱
      password: 'abcd1234',       // 明文密码，Supabase 自动哈希
      email_confirm: true         // 如果需要跳过邮件确认
    });

    if (createUserError) {
      console.error('创建用户失败:', createUserError);
      return;
    }

    console.log('用户创建成功:', user);

    // 在 profiles 表插入扩展信息，id 要用用户的 id
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: user.user.id,     // 必须是刚创建用户的id
          username: 'admin',
          user_type: 'administrator',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ]);

    if (profileError) {
      console.error('插入 profiles 失败:', profileError);
      return;
    }

    console.log('成功插入 profiles:', profileData);

  } catch (err) {
    console.error('操作异常:', err);
  }
}

createAdminUser();
