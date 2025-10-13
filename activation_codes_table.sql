-- 创建激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    product_type VARCHAR(50) DEFAULT 'mediamingle_pro',
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_activation_codes_product_type ON activation_codes(product_type);
CREATE INDEX IF NOT EXISTS idx_activation_codes_start_date ON activation_codes(start_date);
CREATE INDEX IF NOT EXISTS idx_activation_codes_expiry_date ON activation_codes(expiry_date);

-- 添加注释
COMMENT ON TABLE activation_codes IS 'MediaMingle专业版激活码表';
COMMENT ON COLUMN activation_codes.code IS '激活码';
COMMENT ON COLUMN activation_codes.status IS '状态：active-有效, used-已使用, expired-已过期';
COMMENT ON COLUMN activation_codes.product_type IS '产品类型';
COMMENT ON COLUMN activation_codes.user_email IS '使用者邮箱';
COMMENT ON COLUMN activation_codes.user_name IS '使用者姓名';
COMMENT ON COLUMN activation_codes.created_at IS '创建时间';
COMMENT ON COLUMN activation_codes.start_date IS '激活码开始生效时间';
COMMENT ON COLUMN activation_codes.expiry_date IS '过期时间';
COMMENT ON COLUMN activation_codes.used_at IS '使用时间';
COMMENT ON COLUMN activation_codes.notes IS '备注';
COMMENT ON COLUMN activation_codes.metadata IS '元数据（JSON格式）';
