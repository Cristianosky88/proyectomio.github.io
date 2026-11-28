/* ==========================================================================
   NÚCLEO FRONTEND UNIFICADO CCTV & SLOTS (js/global.js)
   Tema sincronizado, reloj en vivo y navegador rápido de módulos
   ========================================================================== */
(function () {
    'use strict';

    const THEME_KEY = 'cctv_theme';

    const MODULES = [
        { group: 'General', href: 'index.html', label: 'Menú Principal', desc: 'Centro de Reportes', icon: 'layout-grid' },
        { group: 'General', href: 'bitacora.html', label: 'Bitácora Nube & Local', desc: 'Archivo Central de Reportes CCTV', icon: 'database' },
        { group: 'Pagos y Valores', href: 'palvar.html', label: 'Pal Var', desc: 'Pagos Altos Salas Varias', icon: 'ticket' },
        { group: 'Pagos y Valores', href: 'pagoaltoluxor.html', label: 'Pago Alto Luxor', desc: 'Redención Tickets Sala Luxor', icon: 'building-2' },
        { group: 'Pagos y Valores', href: 'palcap.html', label: 'Pal Cap', desc: 'Pagos y Tickets Caja Capital', icon: 'wallet-cards' },
        { group: 'Pagos y Valores', href: 'ddj.html', label: 'Declaración Jurada', desc: 'Generador de Acta DDJJ', icon: 'file-check-2' },
        { group: 'Pagos y Valores', href: 'iedin.html', label: 'Traslado de Valores', desc: 'Ingreso / Egreso Multidivisa', icon: 'banknote' },
        { group: 'Jackpots', href: 'jackpot.html', label: 'Jackpot Modelo 1', desc: 'Planilla Clásica de Premio Mayor', icon: 'trophy' },
        { group: 'Jackpots', href: 'Jackpot2.html', label: 'Jackpot Modelo 2', desc: 'Acta con Progresivo en Vivo', icon: 'zap' },
        { group: 'Jackpots', href: 'jackpotluxor.html', label: 'Jackpot Sala Luxor', desc: 'Arqueo de Billetes y Variantes', icon: 'coins' },
        { group: 'Seguridad y Accesos', href: 'ingreso.html', label: 'Ingreso Personal Externo', desc: 'Técnicos, Proveedores y Visitas', icon: 'user-plus' },
        { group: 'Seguridad y Accesos', href: 'Inpol.html', label: 'Adicional Policial', desc: 'Ingreso y Relevo Policial', icon: 'shield-check' },
        { group: 'Seguridad y Accesos', href: 'chk_bule.html', label: 'Botones Bulevard', desc: 'Chequeo Pulsadores Antipánico', icon: 'bell-ring' },
        { group: 'Seguridad y Accesos', href: 'chk_luxor.html', label: 'Botones Sala Luxor', desc: 'Chequeo Pulsadores Sala Luxor', icon: 'shield-alert' },
        { group: 'Técnica y Sala', href: 'cerado.html', label: 'Cerado de Máquinas', desc: 'RAM Clear y Asistencia Técnica', icon: 'wrench' },
        { group: 'Técnica y Sala', href: 'corte_luz.html', label: 'Corte de Suministro', desc: 'Cronología de Corte Eléctrico', icon: 'cloud-lightning' },
        { group: 'Técnica y Sala', href: 'audit_maq.html', label: 'Auditoría de Máquinas', desc: 'Bitácora Cronológica CCTV', icon: 'clipboard-check' },
        { group: 'CCTV y Herramientas', href: 'cam.html', label: 'Organizador de Cámaras', desc: 'Cortes de Video y Horarios DVR', icon: 'video' },
        { group: 'CCTV y Herramientas', href: 'desemp.html', label: 'Auditoría de Turno', desc: 'Asistencia, Cámaras y Descansos', icon: 'activity' },
        { group: 'CCTV y Herramientas', href: 'calculadora2.html', label: 'Calculadora Profesional', desc: 'Arqueo, Cuadre y Divisas', icon: 'calculator' }
    ];

    function getSavedTheme() {
        try {
            return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
        } catch (e) {
            return 'light';
        }
    }

    function syncThemeUI(isDark) {
        document.documentElement.classList.toggle('dark', isDark);

        // Sincronizar íconos heredados si existen en la página
        const sunSvg = document.getElementById('themeIconSun');
        const moonSvg = document.getElementById('themeIconMoon');
        const labelEl = document.getElementById('themeLabel');
        if (sunSvg && moonSvg) {
            sunSvg.classList.toggle('hidden', !isDark);
            moonSvg.classList.toggle('hidden', isDark);
        }
        if (labelEl) {
            labelEl.textContent = isDark ? 'Claro' : 'Oscuro';
        }
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        try {
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        } catch (e) { }
        syncThemeUI(isDark);
    }

    function toggleThemeGlobal() {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        applyTheme(next);
    }

    // Exponer globalmente para todos los módulos
    window.CCTVTheme = { apply: applyTheme, toggle: toggleThemeGlobal, get: getSavedTheme };
    window.toggleTheme = toggleThemeGlobal;
    window.toggleDarkMode = toggleThemeGlobal;

    // Sincronizar entre pestañas abiertas
    window.addEventListener('storage', function (e) {
        if (e.key === THEME_KEY) {
            syncThemeUI(e.newValue === 'dark');
        }
    });

    // Reloj universal en tiempo real
    function updateUniversalClocks() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const formatted = `${hh}:${mm}:${ss} Hs.`;

        document.querySelectorAll('[data-cctv-clock]').forEach(function (el) {
            el.textContent = formatted;
        });
    }

    // Menú desplegable universal de módulos
    function renderModuleSwitchers() {
        const rawFile = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0].split('#')[0];
        const currentFile = rawFile || 'index.html';

        document.querySelectorAll('[data-cctv-nav]').forEach(function (container) {
            if (container.dataset.ready === '1') return;
            container.dataset.ready = '1';
            container.classList.add('relative', 'inline-flex', 'items-center', 'gap-2');

            const isBitacoraPage = currentFile.toLowerCase() === 'bitacora.html';
            const bitacoraBtnHtml = isBitacoraPage
                ? ''
                : '<a href="bitacora.html" title="Abrir Bitácora Central de Reportes (Local y Nube)" ' +
                'class="px-3 py-2 bg-slate-800 hover:bg-indigo-600 border border-slate-700 rounded-xl transition text-xs font-semibold text-slate-200 hover:text-white inline-flex items-center gap-1.5">' +
                '<i data-lucide="database" class="w-4 h-4 text-sky-400"></i>' +
                '<span class="hidden xl:inline">Bitácora</span>' +
                '<span data-cctv-bitacora-count class="hidden px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-200 font-mono text-[10px]">0</span>' +
                '</a>';

            const groups = [];
            MODULES.forEach(function (m) {
                let g = groups.find(function (item) { return item.name === m.group; });
                if (!g) {
                    g = { name: m.group, items: [] };
                    groups.push(g);
                }
                g.items.push(m);
            });

            const groupsHtml = groups.map(function (g) {
                const itemsHtml = g.items.map(function (m) {
                    const isActive = m.href.toLowerCase() === currentFile.toLowerCase();
                    const itemCls = isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white';
                    const descCls = isActive ? 'text-indigo-200' : 'text-slate-400';
                    const iconCls = isActive ? 'text-white' : 'text-indigo-400';

                    return (
                        '<a href="' + m.href + '" data-nav-item="' + (m.label + ' ' + m.desc + ' ' + m.group).toLowerCase() + '" ' +
                        'class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition ' + itemCls + '">' +
                        '<span class="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center shrink-0">' +
                        '<i data-lucide="' + m.icon + '" class="w-4 h-4 ' + iconCls + '"></i>' +
                        '</span>' +
                        '<span class="min-w-0 flex-1">' +
                        '<span class="block text-xs font-semibold truncate">' + m.label + '</span>' +
                        '<span class="block text-[10px] truncate ' + descCls + '">' + m.desc + '</span>' +
                        '</span>' +
                        '</a>'
                    );
                }).join('');

                return (
                    '<div data-nav-group class="mb-2 last:mb-0">' +
                    '<div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">' + g.name + '</div>' +
                    '<div class="space-y-0.5">' + itemsHtml + '</div>' +
                    '</div>'
                );
            }).join('');

            container.innerHTML =
                bitacoraBtnHtml +
                '<button type="button" data-cctv-nav-btn title="Cambiar de módulo (Alt+M)" ' +
                'class="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer">' +
                '<i data-lucide="layout-grid" class="w-4 h-4 text-indigo-400"></i>' +
                '<span class="hidden sm:inline">Módulos</span>' +
                '<i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400"></i>' +
                '</button>' +
                '<div data-cctv-nav-panel class="hidden absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden fade-in">' +
                '<div class="p-2.5 border-b border-slate-800 bg-slate-950/60">' +
                '<div class="relative">' +
                '<input type="search" data-cctv-nav-search placeholder="Ir a módulo..." autocomplete="off" ' +
                'class="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500" />' +
                '</div>' +
                '</div>' +
                '<div data-cctv-nav-list class="max-h-80 overflow-y-auto p-2">' +
                groupsHtml +
                '</div>' +
                '<div class="px-3 py-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2 text-[11px]">' +
                '<span class="text-emerald-400 font-mono truncate max-w-[165px]" data-cctv-operator-email>Operador activo</span>' +
                '<button type="button" data-cctv-logout-btn class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-semibold transition cursor-pointer shrink-0">Cerrar Sesión</button>' +
                '</div>' +
                '</div>';

            const logoutBtn = container.querySelector('[data-cctv-logout-btn]');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function () {
                    closePanel();
                    if (window.CCTVAuthGate && typeof window.CCTVAuthGate.logout === 'function') {
                        window.CCTVAuthGate.logout();
                    }
                });
            }

            const btn = container.querySelector('[data-cctv-nav-btn]');
            const panel = container.querySelector('[data-cctv-nav-panel]');
            const search = container.querySelector('[data-cctv-nav-search]');

            function closePanel() {
                panel.classList.add('hidden');
            }

            function togglePanel() {
                const willOpen = panel.classList.contains('hidden');
                document.querySelectorAll('[data-cctv-nav-panel]').forEach(function (p) {
                    p.classList.add('hidden');
                });
                if (willOpen) {
                    panel.classList.remove('hidden');
                    if (search) {
                        search.value = '';
                        filterItems('');
                        setTimeout(function () { search.focus(); }, 20);
                    }
                }
            }

            function filterItems(query) {
                const q = (query || '').trim().toLowerCase();
                container.querySelectorAll('[data-nav-group]').forEach(function (grp) {
                    let visibleInGroup = 0;
                    grp.querySelectorAll('[data-nav-item]').forEach(function (link) {
                        const match = !q || link.getAttribute('data-nav-item').indexOf(q) !== -1;
                        link.classList.toggle('hidden', !match);
                        if (match) visibleInGroup++;
                    });
                    grp.classList.toggle('hidden', visibleInGroup === 0);
                });
            }

            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                togglePanel();
            });

            panel.addEventListener('click', function (e) {
                e.stopPropagation();
            });

            if (search) {
                search.addEventListener('input', function () {
                    filterItems(this.value);
                });
                search.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') {
                        const firstVisible = container.querySelector('[data-nav-item]:not(.hidden)');
                        if (firstVisible) {
                            window.location.href = firstVisible.getAttribute('href');
                        }
                    } else if (e.key === 'Escape') {
                        closePanel();
                    }
                });
            }

            document.addEventListener('click', closePanel);
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    closePanel();
                } else if (e.altKey && e.key.toLowerCase() === 'm') {
                    e.preventDefault();
                    togglePanel();
                }
            });
        });
    }

    function initGlobalUI() {
        syncThemeUI(getSavedTheme() === 'dark');
        renderModuleSwitchers();
        updateUniversalClocks();
        setInterval(updateUniversalClocks, 1000);

        // Enlazar botones de tema que usen data-cctv-theme-btn
        document.querySelectorAll('[data-cctv-theme-btn]').forEach(function (btn) {
            if (btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', toggleThemeGlobal);
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Cargar motor central de Bitácora (Local + Supabase) automáticamente en todas las páginas
    function loadCloudBitacoraEngine() {
        if (window.CCTVBitacora) return;
        const existing = Array.from(document.scripts).some(function (s) {
            return (s.getAttribute('src') || '').indexOf('cloud-bitacora.js') !== -1;
        });
        if (existing) return;
        const script = document.createElement('script');
        script.src = 'js/cloud-bitacora.js';
        script.defer = true;
        document.head.appendChild(script);
    }

    // Inyectar regla crítica anti-caché y verificar si la sesión actual fue validada en este turno
    function injectCriticalAuthLockCSS() {
        if (document.getElementById('cctvCriticalAuthStyle')) return;
        const st = document.createElement('style');
        st.id = 'cctvCriticalAuthStyle';
        st.textContent =
            'html:not(.cctv-auth-unlocked) body{overflow:hidden!important;}' +
            'html:not(.cctv-auth-unlocked) body>*:not(#cctvAuthGateOverlay){visibility:hidden!important;pointer-events:none!important;user-select:none!important;}';
        (document.head || document.documentElement).appendChild(st);
    }

    function preUnlockIfCachedSession() {
        try {
            const tabVerified = sessionStorage.getItem('cctv_auth_tab_verified_v1') === '1';
            const rememberPc = localStorage.getItem('cctv_auth_remember_pc_v1') === '1';
            const shiftUntil = Number(localStorage.getItem('cctv_auth_shift_until_v1') || '0');
            const shiftActive = shiftUntil > Date.now();
            if (!tabVerified && !rememberPc && !shiftActive) return;

            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && /^sb-.*-auth-token$/.test(k)) {
                    const parsed = JSON.parse(localStorage.getItem(k) || 'null');
                    const expMs = parsed && parsed.expires_at ? Number(parsed.expires_at) * 1000 : 0;
                    if (parsed && parsed.access_token && parsed.user && (!expMs || expMs > Date.now() - 30000)) {
                        document.documentElement.classList.add('cctv-auth-unlocked');
                        return;
                    }
                }
            }
        } catch (e) {}
    }

    // Aplicar tema y pre-validación de sesión inmediatamente
    injectCriticalAuthLockCSS();
    syncThemeUI(getSavedTheme() === 'dark');
    preUnlockIfCachedSession();
    loadCloudBitacoraEngine();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalUI);
    } else {
        initGlobalUI();
    }
})();
