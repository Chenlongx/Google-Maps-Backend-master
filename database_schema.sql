-- 代理系统数据库表结构设计

-- 1. 用户角色表 (扩展现有用户表)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL, -- 'admin', 'agent', 'customer'
  permissions JSONB DEFAULT '{}', -- 权限配置
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 代理信息表
CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_code VARCHAR(20) UNIQUE NOT NULL, -- 代理邀请码
  parent_agent_id UUID REFERENCES agent_profiles(id), -- 上级代理ID
  level INTEGER DEFAULT 1, -- 代理层级
  commission_rate DECIMAL(5,2) DEFAULT 0.00, -- 分佣比例 (0-100)
  total_commission DECIMAL(10,2) DEFAULT 0.00, -- 累计佣金
  available_balance DECIMAL(10,2) DEFAULT 0.00, -- 可提现余额
  alipay_account VARCHAR(100), -- 支付宝账号
  real_name VARCHAR(50), -- 真实姓名
  phone VARCHAR(20), -- 手机号
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 代理关系表 (记录代理层级关系)
CREATE TABLE IF NOT EXISTS agent_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
  parent_agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL, -- 层级深度
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 订单表 (客户下单记录)
-- 4. 订单表 (客户下单记录) - 已根据你的要求修正
CREATE TABLE IF NOT EXISTS orders (
    -- 使用 BIGSERIAL 作为自增主键，更适合订单这种高频创建的场景
    id BIGSERIAL PRIMARY KEY,

    -- 外部交易号，来自支付平台，应唯一且非空
    out_trade_no VARCHAR(128) NOT NULL UNIQUE,

    -- 关联的产品ID
    product_id BIGINT NOT NULL,

    -- 客户的邮箱地址
    customer_email VARCHAR(255) NOT NULL,

    -- 订单状态，默认为 'pending'
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- 记录创建时间，使用带时区的 TIMESTAMP
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. 佣金记录表
-- 5. 佣金记录表 - 已修正与 orders 表的关联
CREATE TABLE IF NOT EXISTS commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE, -- <<< 已确认为 BIGINT，与新的 orders.id 类型匹配
  agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
  commission_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  admin_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 提现申请表
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, -- 提现金额
  alipay_account VARCHAR(100) NOT NULL, -- 提现支付宝账号
  real_name VARCHAR(50) NOT NULL, -- 提现人姓名
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected'
  admin_notes TEXT, -- 管理员备注
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  alipay_transaction_id VARCHAR(100), -- 支付宝交易号
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 系统配置表 (分佣比例等配置)
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 邀请记录表
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
  invitee_email VARCHAR(255) NOT NULL,
  invite_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'expired'
  expires_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 用户-代理关联表 (追踪用户是通过哪个代理注册的)
CREATE TABLE IF NOT EXISTS user_agent_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
  invite_code VARCHAR(50), -- 邀请码
  registration_source VARCHAR(50) DEFAULT 'agent_invite', -- 'agent_invite', 'direct', 'admin'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_agent_profiles_user_id ON agent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_agent_code ON agent_profiles(agent_code);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_parent_agent_id ON agent_profiles(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_hierarchy_agent_id ON agent_hierarchy(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_hierarchy_parent_agent_id ON agent_hierarchy(parent_agent_id);
-- CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_out_trade_no ON orders(out_trade_no);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_commission_records_agent_id ON commission_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_order_id ON commission_records(order_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_agent_id ON withdrawal_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_invitations_inviter_agent_id ON invitations(inviter_agent_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invite_code ON invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_user_agent_relations_user_id ON user_agent_relations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agent_relations_agent_id ON user_agent_relations(agent_id);
CREATE INDEX IF NOT EXISTS idx_user_agent_relations_invite_code ON user_agent_relations(invite_code);

-- 10. 产品推广记录表
CREATE TABLE IF NOT EXISTS product_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
  product_type VARCHAR(50) NOT NULL, -- 'google-maps', 'email-filter', 'whatsapp-filter'
  promotion_code VARCHAR(100) UNIQUE NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL, -- 分佣比例
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'expired'
  clicks_count INTEGER DEFAULT 0, -- 点击次数
  conversions_count INTEGER DEFAULT 0, -- 转化次数
  total_commission DECIMAL(10,2) DEFAULT 0.00, -- 累计佣金
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. 产品订单表
CREATE TABLE IF NOT EXISTS product_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email VARCHAR(255) NOT NULL,
  product_type VARCHAR(50) NOT NULL,
  promotion_code VARCHAR(100), -- 推广码
  order_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) DEFAULT 0.00,
  agent_id UUID REFERENCES agent_profiles(id),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled', 'refunded'
  payment_method VARCHAR(50),
  payment_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. 产品点击记录表
CREATE TABLE IF NOT EXISTS promotion_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_code VARCHAR(100) NOT NULL,
  agent_id UUID REFERENCES agent_profiles(id),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_product_promotions_agent_id ON product_promotions(agent_id);
CREATE INDEX IF NOT EXISTS idx_product_promotions_product_type ON product_promotions(product_type);
CREATE INDEX IF NOT EXISTS idx_product_promotions_promotion_code ON product_promotions(promotion_code);
CREATE INDEX IF NOT EXISTS idx_product_orders_customer_email ON product_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_product_orders_promotion_code ON product_orders(promotion_code);
CREATE INDEX IF NOT EXISTS idx_product_orders_agent_id ON product_orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_promotion_clicks_promotion_code ON promotion_clicks(promotion_code);
CREATE INDEX IF NOT EXISTS idx_promotion_clicks_agent_id ON promotion_clicks(agent_id);

-- 插入默认系统配置
INSERT INTO system_config (config_key, config_value, description) VALUES
('default_commission_rate', '{"rate": 10.00}', '默认分佣比例'),
('min_withdrawal_amount', '{"amount": 100.00}', '最小提现金额'),
('max_withdrawal_amount', '{"amount": 50000.00}', '最大提现金额'),
('withdrawal_fee_rate', '{"rate": 0.00}', '提现手续费比例'),
('agent_levels', '{"levels": [{"level": 1, "rate": 10.00}, {"level": 2, "rate": 5.00}, {"level": 3, "rate": 2.00}]}', '代理层级分佣配置'),
('product_commission_rates', '{"google-maps": 0.20, "email-filter": 0.15, "whatsapp-filter": 0.18}', '产品分佣比例配置')
ON CONFLICT (config_key) DO NOTHING;
