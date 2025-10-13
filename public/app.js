document.addEventListener('DOMContentLoaded', () => {
    // --- 核心元素获取 ---
    const mainContent = document.getElementById('main-content');
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const layout = document.getElementById('admin-layout');
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const sidebar = document.getElementById('sidebar');

    const notificationCenter = document.getElementById('notification-center');
    const notificationBellBtn = document.getElementById('notification-bell-btn');
    const notificationPanel = document.getElementById('notification-panel');
    const notificationDot = document.getElementById('notification-dot');
    
    // --- 深色模式逻辑 ---
    const themeToggle = document.getElementById('theme-toggle-checkbox');
    const currentTheme = localStorage.getItem('theme');

    // 初始化主题
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if(themeToggle) themeToggle.checked = true;
    }


    // 监听切换事件
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode');
            let theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
            localStorage.setItem('theme', theme);
        });
    }

    // --- 通知中心逻辑 ---
    if (notificationBellBtn) {
        notificationBellBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止点击事件冒泡到 body 关闭自身
            notificationPanel.classList.toggle('show');
            notificationDot.style.display = 'none'; // 点击后清除红点
        });
    }

    // 点击页面其他地方关闭通知面板
    document.body.addEventListener('click', () => {
        if (notificationPanel && notificationPanel.classList.contains('show')) {
            notificationPanel.classList.remove('show');
        }
    });

    // 模拟获取通知
    function fetchNotifications() {
        // 在这里，您应该发起一个API请求到后端获取真实通知
        const mockNotifications = [ /* ... */ ]; 
        if (mockNotifications.length > 0) {
            notificationDot.style.display = 'block';
            // ... 渲染通知列表 ...
        }
    }
    fetchNotifications(); // 页面加载时获取一次


    // --- 侧边栏伸缩逻辑 ---
    // 检查 localStorage 中保存的状态，刷新后保持
    if (localStorage.getItem('sidebarState') === 'collapsed') {
        if (layout) layout.classList.add('sidebar-collapsed');
    }

    // --- 统一的侧边栏控制逻辑 ---
    const handleSidebarToggle = () => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            sidebar.classList.toggle('is-open');
        } else {
            layout.classList.toggle('sidebar-collapsed');
            const isCollapsed = layout.classList.contains('sidebar-collapsed');
            localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
        }
    };

    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', (e) => {
        // 关键：调用 stopPropagation() 来阻止事件冒泡到父元素
            e.stopPropagation(); 
            handleSidebarToggle();
        });
    }
    
    if (window.innerWidth > 768 && localStorage.getItem('sidebarState') === 'collapsed') {
        if (layout) layout.classList.add('sidebar-collapsed');
    }
    
    document.querySelector('.main-wrapper').addEventListener('click', () => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('is-open')) {
            sidebar.classList.remove('is-open');
        }
    });

    // --- 前端路由逻辑 ---
    const routes = {
        '/dashboard': 'pages/dashboard.html',
        '/users': 'pages/users.html',
        '/licenses': 'pages/licenses.html',
        '/analytics': 'pages/analytics.html', 
        '/settings': 'pages/settings.html',
        '/addUser': 'pages/addUser.html',
        '/editUser': 'pages/editUser.html',
        '/whatsapp-licenses': 'pages/whatsapp-licenses.html',
        '/activation-codes': 'pages/activation-codes.html'
    };

    const executeScripts = (container) => {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            // 复制所有属性，例如 type, src, etc.
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            // 复制内联脚本内容
            newScript.textContent = oldScript.textContent;
            // 替换旧脚本以触发执行
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    };

    const loadContent = async (pathWithQuery) => {
        const basePath = pathWithQuery.split('?')[0];
        const contentFile = routes[basePath] || routes['/dashboard'];
        
        console.log('loadContent调用:', {
            pathWithQuery,
            basePath,
            contentFile,
            availableRoutes: Object.keys(routes)
        });
        
        // 页面切换前清理全局变量和函数，避免冲突
        const globalVarsToClean = [
            'userGrowthChartInstance_DASH',
            'userTypeChartInstance_DASH', 
            'renderUserTypeChart_DASH',
            'renderUserGrowthChart_DASH',
            'allActivationCodes',
            'currentPage',
            'itemsPerPage',
            'updateMetrics',
            'updateAllCharts',
            'allLicenses_WhatsAppPage',
            'allUsers',
            'allLicenses'
        ];
        
        globalVarsToClean.forEach(varName => {
            if (typeof window[varName] !== 'undefined') {
                // 如果是图表实例，先销毁
                if (varName.includes('Chart') && window[varName] && typeof window[varName].destroy === 'function') {
                    try {
                        window[varName].destroy();
                    } catch (e) {
                        console.warn('销毁图表实例时出错:', e);
                    }
                }
                delete window[varName];
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === basePath) {
                link.classList.add('active');
            }
        });

        try {
            mainContent.innerHTML = '<div style="text-align: center; padding: 50px; color: #6b7280;">正在加载内容...</div>';
            const response = await fetch(contentFile);
            if (!response.ok) throw new Error(`无法加载页面: ${contentFile}`);
            const html = await response.text();
            mainContent.innerHTML = html;

            executeScripts(mainContent);
            console.log('内容加载成功:', contentFile);
        } catch (error) {
            console.error('内容加载失败:', error);
            mainContent.innerHTML = `<div class="main-card" style="color: #ef4444; text-align:center;"><h1>加载页面失败</h1><p>${error.message}</p></div>`;
        }
    };
    
    const navigate = (path) => {
        if (window.location.pathname + window.location.search !== path) {
            history.pushState({ path }, '', path);
            loadContent(path);
        }
    };

    // 全局事件委托，处理所有内部导航点击
    document.body.addEventListener('click', e => {
        // 查找被点击元素或其父元素中符合条件的导航链接/按钮
        const navTrigger = e.target.closest('a.nav-link, a.nav-link-internal, .edit-button, .cancel-btn');
        
        if (navTrigger) {
            e.preventDefault(); // 阻止默认行为

            let path;
            // 根据被点击元素的class来决定如何构建路径
            if (navTrigger.classList.contains('edit-button')) {
                const userId = navTrigger.getAttribute('data-user-id');
                path = `/editUser?userId=${encodeURIComponent(userId)}`;
            } else if (navTrigger.classList.contains('cancel-btn')) {
                 path = '/users'; // 取消编辑，返回用户列表
            }
            else {
                // 对于普通的 a 标签链接
                path = navTrigger.getAttribute('href');
            }
            
            if (path) {
                navigate(path);
            }
        }
    });

    // 监听由页面片段派发的自定义导航事件 (这是一个备用方案，上面的事件委托更优)
    window.addEventListener('navigate', (e) => {
        navigate(e.detail.path);
    });

    // 监听浏览器的前进和后退事件
    window.addEventListener('popstate', (e) => {
        const path = e.state ? e.state.path : (window.location.pathname + window.location.search);
        loadContent(path);
    });

    // 初始加载
    const initialPath = window.location.pathname + window.location.search;
    const initialBasePath = initialPath.split('?')[0];

    console.log('初始路径:', initialPath);
    console.log('基础路径:', initialBasePath);
    console.log('可用路由:', Object.keys(routes));

    // --- 修改后的逻辑 ---
    // 检查当前路径是否是一个已定义的、有效的路由
    if (routes[initialBasePath]) {
        // 如果是一个有效路由，就加载对应内容
        console.log('匹配到有效路由，加载内容:', initialBasePath);
        loadContent(initialPath);
    } else if (initialBasePath === '/' || initialBasePath === '/index.html' || initialBasePath === '') {
        // 如果是根路径，重定向到dashboard
        console.log('根路径，重定向到dashboard');
        history.replaceState({ path: '/dashboard' }, '', '/dashboard');
        loadContent('/dashboard');
    } else {
        // 如果是其他无效路径，也重定向到dashboard
        console.log('无效路径，重定向到dashboard');
        history.replaceState({ path: '/dashboard' }, '', '/dashboard');
        loadContent('/dashboard');
    }
});