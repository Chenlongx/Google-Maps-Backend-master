-- 产品推广系统数据库表创建脚本
-- 请在Supabase SQL编辑器中执行此脚本

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

-- 插入产品分佣比例配置
INSERT INTO system_config (config_key, config_value, description) VALUES
('product_commission_rates', '{"google-maps": 0.20, "email-filter": 0.15, "whatsapp-filter": 0.18}', '产品分佣比例配置')
ON CONFLICT (config_key) DO NOTHING;
