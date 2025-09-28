/**
 * 推广链接追踪系统
 * 用于官网识别和追踪代理推广链接
 */

class ReferralTracker {
    constructor() {
        this.apiBaseUrl = 'https://google-maps-backend-master.netlify.app/api'; // 代理系统API地址
        this.referralData = null;
        this.init();
    }

    init() {
        this.parseReferralFromURL();
        this.trackReferralClick();
        this.setupPurchaseTracking();
    }

    /**
     * 从URL解析推广信息
     */
    parseReferralFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        
        if (refCode) {
            try {
                // 解析推广码: AGENT_CODE_PRODUCT_TYPE_TIMESTAMP_RANDOM
                const parts = refCode.split('_');
                if (parts.length >= 4) {
                    this.referralData = {
                        agentCode: parts[0],
                        productType: parts[1],
                        timestamp: parts[2],
                        random: parts[3],
                        fullCode: refCode,
                        source: 'url'
                    };

                    // 存储到localStorage和Cookie
                    this.storeReferralData();
                    
                    console.log('推广信息解析成功:', this.referralData);
                }
            } catch (error) {
                console.error('推广码解析失败:', error);
            }
        } else {
            // 尝试从localStorage恢复推广信息
            this.loadStoredReferralData();
        }
    }

    /**
     * 存储推广信息
     */
    storeReferralData() {
        if (!this.referralData) return;

        // 存储到localStorage (30天)
        localStorage.setItem('referral_data', JSON.stringify({
            ...this.referralData,
            storedAt: Date.now()
        }));

        // 存储到Cookie (30天)
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        document.cookie = `referral_data=${JSON.stringify(this.referralData)}; expires=${expires.toUTCString()}; path=/`;
    }

    /**
     * 从存储中加载推广信息
     */
    loadStoredReferralData() {
        try {
            // 优先从localStorage读取
            const stored = localStorage.getItem('referral_data');
            if (stored) {
                const data = JSON.parse(stored);
                // 检查是否过期 (30天)
                if (Date.now() - data.storedAt < 30 * 24 * 60 * 60 * 1000) {
                    this.referralData = data;
                    return;
                }
            }

            // 从Cookie读取
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'referral_data') {
                    this.referralData = JSON.parse(decodeURIComponent(value));
                    break;
                }
            }
        } catch (error) {
            console.error('加载推广信息失败:', error);
        }
    }

    /**
     * 追踪推广点击
     */
    async trackReferralClick() {
        if (!this.referralData) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/trackReferralClick`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    promotionCode: this.referralData.fullCode,
                    agentCode: this.referralData.agentCode,
                    productType: this.referralData.productType,
                    pageUrl: window.location.href,
                    userAgent: navigator.userAgent,
                    referrer: document.referrer,
                    timestamp: Date.now()
                })
            });

            if (response.ok) {
                console.log('推广点击记录成功');
            }
        } catch (error) {
            console.error('推广点击记录失败:', error);
        }
    }

    /**
     * 设置购买追踪
     */
    setupPurchaseTracking() {
        // 监听支付按钮点击
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target.matches('.checkout-btn, .buy-btn, .purchase-btn, [data-action="checkout"]')) {
                this.trackPurchaseIntent();
            }
        });

        // 监听表单提交
        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (form.matches('.checkout-form, .payment-form')) {
                this.addReferralToForm(form);
            }
        });
    }

    /**
     * 追踪购买意图
     */
    trackPurchaseIntent() {
        if (!this.referralData) return;

        // 在支付页面URL中添加推广参数
        const currentUrl = new URL(window.location.href);
        if (currentUrl.pathname.includes('checkout') || currentUrl.pathname.includes('payment')) {
            currentUrl.searchParams.set('ref', this.referralData.fullCode);
            window.history.replaceState({}, '', currentUrl.toString());
        }
    }

    /**
     * 向表单添加推广信息
     */
    addReferralToForm(form) {
        if (!this.referralData) return;

        // 检查是否已有推广字段
        let refInput = form.querySelector('input[name="referral_code"]');
        if (!refInput) {
            refInput = document.createElement('input');
            refInput.type = 'hidden';
            refInput.name = 'referral_code';
            form.appendChild(refInput);
        }
        refInput.value = this.referralData.fullCode;

        // 添加代理信息
        let agentInput = form.querySelector('input[name="agent_code"]');
        if (!agentInput) {
            agentInput = document.createElement('input');
            agentInput.type = 'hidden';
            agentInput.name = 'agent_code';
            form.appendChild(agentInput);
        }
        agentInput.value = this.referralData.agentCode;
    }

    /**
     * 获取当前推广信息
     */
    getReferralData() {
        return this.referralData;
    }

    /**
     * 检查是否有推广信息
     */
    hasReferral() {
        return this.referralData !== null;
    }

    /**
     * 获取产品类型映射
     */
    getProductTypeMapping() {
        return {
            'maps-scraper': 'google-maps',
            'email-validator': 'email-filter',
            'whatsapp-validator': 'whatsapp-filter'
        };
    }

    /**
     * 根据当前页面确定产品类型
     */
    getCurrentProductType() {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        const mapping = this.getProductTypeMapping();
        return mapping[productId] || null;
    }

    /**
     * 显示推广信息（可选）
     */
    showReferralInfo() {
        if (!this.referralData) return;

        const info = document.createElement('div');
        info.className = 'referral-info';
        info.innerHTML = `
            <div style="background: #e8f5e8; padding: 10px; border-radius: 5px; margin: 10px 0; font-size: 14px;">
                <strong>🎉 您通过代理推荐访问</strong><br>
                代理代码: ${this.referralData.agentCode}
            </div>
        `;
        
        // 插入到页面顶部
        const container = document.querySelector('.container, main, .content') || document.body;
        container.insertBefore(info, container.firstChild);
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    window.referralTracker = new ReferralTracker();
    
    // 可选：显示推广信息
    // window.referralTracker.showReferralInfo();
});

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReferralTracker;
}
