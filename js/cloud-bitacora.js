/* ==========================================================================
   MOTOR CENTRAL DE BITÁCORA Y CONTROL DE ACCESO (SUPABASE AUTH + CLOUD)
   Archivo: js/cloud-bitacora.js
   - Protege todas las páginas solicitando Usuario y Contraseña (Supabase Auth)
   - Comparte una única instancia de cliente Supabase en todo el sitio
   - Sincroniza automáticamente cada reporte generado con public.reportes_cctv
   ========================================================================== */
(function () {
    'use strict';

    if (window.CCTVBitacora) return;

    const LOCAL_BITACORA_KEY = 'cctv_bitacora_central_v1';
    const STORAGE_SUPA_CREDS_KEY = 'auditoria_cctv_supabase_creds_v1';
    const SHARE_PREF_KEY = 'cctv_bitacora_share_pref_v1';
    const TAB_VERIFIED_KEY = 'cctv_auth_tab_verified_v1';
    const REMEMBER_PC_KEY = 'cctv_auth_remember_pc_v1';
    const SHIFT_UNTIL_KEY = 'cctv_auth_shift_until_v1';
    const SUPABASE_TABLE = 'reportes_cctv';
    const MAX_LOCAL_ITEMS = 250;

    // Asegurar estilos de bloqueo aun si css/global.css estaba en caché del navegador
    (function ensureCriticalLockStyle() {
        if (document.getElementById('cctvCriticalAuthStyle')) return;
        const st = document.createElement('style');
        st.id = 'cctvCriticalAuthStyle';
        st.textContent =
            'html:not(.cctv-auth-unlocked) body{overflow:hidden!important;}' +
            'html:not(.cctv-auth-unlocked) body>*:not(#cctvAuthGateOverlay){visibility:hidden!important;pointer-events:none!important;user-select:none!important;}';
        (document.head || document.documentElement).appendChild(st);
    })();

    const HISTORY_WATCH_MAP = {
        jackpot_m1_history: { modulo: 'Jackpot · Modelo 1', categoria: 'Jackpots', archivo: 'jackpot.html' },
        jackpot_m2_history_v1: { modulo: 'Jackpot · Modelo 2', categoria: 'Jackpots', archivo: 'Jackpot2.html' },
        jackpot_luxor_history_v1: { modulo: 'Jackpot · Sala Luxor', categoria: 'Jackpots', archivo: 'jackpotluxor.html', salaDefault: 'Sala Luxor' },
        ticketHistorial: { modulo: 'Pal Var · Pagos Altos', categoria: 'Pagos y Valores', archivo: 'palvar.html' },
        cctv_luxor_history: { modulo: 'Pago Alto · Sala Luxor', categoria: 'Pagos y Valores', archivo: 'pagoaltoluxor.html', salaDefault: 'Sala Luxor' },
        cctv_palcap_historial_v2: { modulo: 'Pal Cap · Caja Capital', categoria: 'Pagos y Valores', archivo: 'palcap.html', salaDefault: 'Casino Boulevard' },
        cctv_ddjj_historial_v2: { modulo: 'Declaración Jurada (DDJJ)', categoria: 'Pagos y Valores', archivo: 'ddj.html' },
        cctv_iedin_historial_v2: { modulo: 'Traslado de Valores', categoria: 'Pagos y Valores', archivo: 'iedin.html', salaDefault: 'Tesorería' },
        ingresoHistorial: { modulo: 'Ingreso Personal Externo', categoria: 'Seguridad y Accesos', archivo: 'ingreso.html' },
        cctv_policial_historial: { modulo: 'Adicional Policial', categoria: 'Seguridad y Accesos', archivo: 'Inpol.html' },
        chkBuleHistorial: { modulo: 'Botones Bulevard', categoria: 'Seguridad y Accesos', archivo: 'chk_bule.html', salaDefault: 'Casino Boulevard' },
        chkLuxorHistorial: { modulo: 'Botones Sala Luxor', categoria: 'Seguridad y Accesos', archivo: 'chk_luxor.html', salaDefault: 'Sala Luxor' },
        auditArchivedSessions_v1: { modulo: 'Auditoría de Máquinas', categoria: 'Técnica y Sala', archivo: 'audit_maq.html' }
    };

    const rawSetItem = Storage.prototype.setItem;
    let supabaseClient = window.__cctvSupabaseClientSingleton || null;
    let currentSession = null;
    let initPromise = null;
    let isSyncingQueue = false;
    const listeners = [];

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isGateTrustedInBrowser() {
        try {
            const shiftUntil = Number(localStorage.getItem(SHIFT_UNTIL_KEY) || '0');
            return (
                sessionStorage.getItem(TAB_VERIFIED_KEY) === '1' ||
                localStorage.getItem(REMEMBER_PC_KEY) === '1' ||
                shiftUntil > Date.now()
            );
        } catch (e) {
            return false;
        }
    }

    // Lectura rápida del token en localStorage para evitar parpadeos al cambiar de página
    function getCachedSessionUser() {
        if (!isGateTrustedInBrowser()) return null;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && /^sb-.*-auth-token$/.test(k)) {
                    const parsed = JSON.parse(localStorage.getItem(k) || 'null');
                    const expMs = parsed && parsed.expires_at ? Number(parsed.expires_at) * 1000 : 0;
                    if (parsed && parsed.access_token && parsed.user && (!expMs || expMs > Date.now() - 30000)) {
                        return parsed.user;
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    function updateOperatorLabels(email) {
        const cleanEmail = email || '';
        const shortUser = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
        document.querySelectorAll('[data-cctv-operator-email]').forEach(el => {
            el.textContent = cleanEmail || 'Sin sesión';
        });
        document.querySelectorAll('[data-cctv-operator-short]').forEach(el => {
            el.textContent = shortUser || 'Operador';
        });
    }

    function translateAuthError(msg) {
        const m = String(msg || '');
        if (/invalid login credentials/i.test(m)) {
            return 'Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente.';
        }
        if (/email not confirmed/i.test(m)) {
            return 'Tu cuenta aún no fue confirmada por correo electrónico.';
        }
        if (/too many requests|rate limit/i.test(m)) {
            return 'Demasiados intentos seguidos. Aguarda unos segundos antes de reintentar.';
        }
        if (/fetch|network|failed to load/i.test(m)) {
            return 'Sin conexión con el servidor de autenticación. Verifica tu acceso a internet.';
        }
        return m || 'No se pudo iniciar sesión.';
    }

    // =========================================================================
    // PORTÓN GLOBAL DE AUTENTICACIÓN (#cctvAuthGateOverlay)
    // =========================================================================
    function ensureAuthOverlayMounted() {
        let overlay = document.getElementById('cctvAuthGateOverlay');
        if (overlay) return overlay;
        if (!document.body) return null;

        overlay = document.createElement('div');
        overlay.id = 'cctvAuthGateOverlay';
        overlay.className = 'no-print fixed inset-0 z-[9999] bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-200';
        overlay.innerHTML =
            '<div class="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">' +
                '<div class="bg-slate-900 dark:bg-slate-950 border-b border-slate-800 px-6 py-5 flex items-center justify-between gap-3 text-white">' +
                    '<div class="flex items-center gap-3">' +
                        '<div class="bg-indigo-600 p-2.5 rounded-xl shadow-sm shrink-0 flex items-center justify-center">' +
                            '<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>' +
                        '</div>' +
                        '<div>' +
                            '<h2 class="text-base sm:text-lg font-bold leading-tight text-white">Centro de Reportes CCTV</h2>' +
                            '<p class="text-[11px] text-slate-400 uppercase tracking-wider">Acceso exclusivo para operadores</p>' +
                        '</div>' +
                    '</div>' +
                    '<button type="button" id="cctvGateThemeBtn" title="Cambiar modo claro / oscuro" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>' +
                    '</button>' +
                '</div>' +
                '<form id="cctvGateForm" class="p-6 space-y-4">' +
                    '<div id="cctvGateError" class="hidden p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"></div>' +
                    '<div>' +
                        '<label for="cctvGateEmail" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Usuario (Correo registrado)</label>' +
                        '<input type="email" id="cctvGateEmail" autocomplete="username" required placeholder="operador@correo.com" ' +
                        'class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition" />' +
                    '</div>' +
                    '<div>' +
                        '<div class="flex items-center justify-between mb-1.5">' +
                            '<label for="cctvGatePass" class="text-xs font-semibold text-slate-700 dark:text-slate-300">Contraseña</label>' +
                            '<button type="button" id="cctvGateTogglePass" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">Mostrar</button>' +
                        '</div>' +
                        '<input type="password" id="cctvGatePass" autocomplete="current-password" required placeholder="••••••••" ' +
                        'class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 outline-none transition" />' +
                    '</div>' +
                    '<label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">' +
                        '<input type="checkbox" id="cctvGateRemember" class="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500" />' +
                        '<span>Mantener sesión iniciada al cerrar el navegador</span>' +
                    '</label>' +
                    '<button type="submit" id="cctvGateSubmitBtn" class="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer">' +
                        '<span>Ingresar al Sistema</span>' +
                    '</button>' +
                    '<p class="text-[11px] text-center text-slate-400 dark:text-slate-500 pt-1">Autenticación cifrada mediante Supabase Auth · Sesión sincronizada</p>' +
                '</form>' +
            '</div>';

        document.body.appendChild(overlay);

        const themeBtn = document.getElementById('cctvGateThemeBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', function () {
                if (window.CCTVTheme && typeof window.CCTVTheme.toggle === 'function') {
                    window.CCTVTheme.toggle();
                }
            });
        }

        const passInput = document.getElementById('cctvGatePass');
        const togglePassBtn = document.getElementById('cctvGateTogglePass');
        if (passInput && togglePassBtn) {
            togglePassBtn.addEventListener('click', function () {
                const isHidden = passInput.type === 'password';
                passInput.type = isHidden ? 'text' : 'password';
                togglePassBtn.textContent = isHidden ? 'Ocultar' : 'Mostrar';
                passInput.focus();
            });
        }

        const form = document.getElementById('cctvGateForm');
        if (form) {
            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                const errBox = document.getElementById('cctvGateError');
                const submitBtn = document.getElementById('cctvGateSubmitBtn');
                const email = (document.getElementById('cctvGateEmail').value || '').trim();
                const password = document.getElementById('cctvGatePass').value || '';

                errBox.classList.add('hidden');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Verificando credenciales...</span>';

                const client = await ensureSupabaseReady();
                if (!client) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>Ingresar al Sistema</span>';
                    errBox.textContent = 'No se pudo conectar con el servicio de autenticación. Verifica tu conexión a internet.';
                    errBox.classList.remove('hidden');
                    return;
                }

                const { data, error } = await client.auth.signInWithPassword({ email, password });
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Ingresar al Sistema</span>';

                if (error || !data?.session) {
                    errBox.textContent = translateAuthError(error ? error.message : '');
                    errBox.classList.remove('hidden');
                    return;
                }

                currentSession = data.session;
                try {
                    sessionStorage.setItem(TAB_VERIFIED_KEY, '1');
                    rawSetItem.call(localStorage, SHIFT_UNTIL_KEY, String(Date.now() + 12 * 3600 * 1000));
                    const remember = Boolean(document.getElementById('cctvGateRemember')?.checked);
                    rawSetItem.call(localStorage, REMEMBER_PC_KEY, remember ? '1' : '0');
                } catch (errStorage) {}
                document.getElementById('cctvGatePass').value = '';
                applyGateState(true, data.session.user?.email || email);
                syncPendingToCloud();
            });
        }

        return overlay;
    }

    function applyGateState(unlocked, email) {
        if (unlocked) {
            document.documentElement.classList.add('cctv-auth-unlocked');
            const overlay = document.getElementById('cctvAuthGateOverlay');
            if (overlay) overlay.classList.add('hidden');
            updateOperatorLabels(email || '');
        } else {
            document.documentElement.classList.remove('cctv-auth-unlocked');
            updateOperatorLabels('');
            const overlay = ensureAuthOverlayMounted();
            if (overlay) {
                overlay.classList.remove('hidden');
                setTimeout(() => {
                    const emailInp = document.getElementById('cctvGateEmail');
                    if (emailInp && !emailInp.value) emailInp.focus();
                }, 40);
            }
        }
    }

    async function logoutGlobal() {
        try {
            sessionStorage.removeItem(TAB_VERIFIED_KEY);
            localStorage.removeItem(REMEMBER_PC_KEY);
            localStorage.removeItem(SHIFT_UNTIL_KEY);
        } catch (e) {}
        try {
            const client = await ensureSupabaseReady();
            if (client) {
                await client.auth.signOut();
            }
        } catch (e) {}
        currentSession = null;
        applyGateState(false, '');
        notifyListeners();
    }

    // Pre-desbloqueo instantáneo si ya existe un token vigente en localStorage
    const initialCachedUser = getCachedSessionUser();
    if (initialCachedUser) {
        document.documentElement.classList.add('cctv-auth-unlocked');
    }

    // =========================================================================
    // UTILIDADES Y MOTOR DE BITÁCORA
    // =========================================================================
    function genClientUid() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'cctv-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
    }

    function todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function nowHHMM() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function getSharePreference() {
        try {
            const v = localStorage.getItem(SHARE_PREF_KEY);
            return v === null ? true : v === '1';
        } catch (e) {
            return true;
        }
    }

    function setSharePreference(shared) {
        try {
            rawSetItem.call(localStorage, SHARE_PREF_KEY, shared ? '1' : '0');
        } catch (e) {}
    }

    function getLocalEntries() {
        try {
            const raw = localStorage.getItem(LOCAL_BITACORA_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function saveLocalEntries(list) {
        const trimmed = list.slice(0, MAX_LOCAL_ITEMS);
        try {
            rawSetItem.call(localStorage, LOCAL_BITACORA_KEY, JSON.stringify(trimmed));
        } catch (e) {}
        updateHeaderBadges();
        notifyListeners();
    }

    function getPendingCount() {
        return getLocalEntries().filter(it => !it.synced).length;
    }

    function updateHeaderBadges() {
        const allLocal = getLocalEntries();
        const countStr = String(allLocal.length);
        document.querySelectorAll('[data-cctv-bitacora-count]').forEach(el => {
            el.textContent = countStr;
            el.classList.toggle('hidden', allLocal.length === 0);
        });
    }

    function notifyListeners() {
        const state = {
            localEntries: getLocalEntries(),
            pendingCount: getPendingCount(),
            session: currentSession,
            ready: Boolean(supabaseClient)
        };
        listeners.forEach(fn => {
            try { fn(state); } catch (e) {}
        });
    }

    function extractTextFromModuleEntry(entry) {
        if (!entry || typeof entry !== 'object') return '';
        return String(
            entry.texto ||
            entry.fullText ||
            entry.text ||
            entry.contenido ||
            entry.resumenTexto ||
            ''
        ).trim();
    }

    function inferSalaFromText(text, fallback) {
        if (fallback) return fallback;
        const t = String(text || '');
        if (/luxor/i.test(t)) return 'Sala Luxor';
        if (/boulevard|bulevard/i.test(t)) return 'Casino Boulevard';
        if (/salvador\s+mazza/i.test(t)) return 'Slots Salvador Mazza';
        if (/lajitas/i.test(t)) return 'Slots Lajitas';
        if (/mosconi/i.test(t)) return 'Slots Mosconi';
        if (/refinor/i.test(t)) return 'Slots Refinor';
        if (/tesoro|tesorer[ií]a/i.test(t)) return 'Tesorería';
        return 'General';
    }

    function extractHoraFromEntry(entry, text) {
        const direct = entry.horaAviso || entry.hora || entry.horaInicio || entry.horaReg || entry.time1 || entry.hora1 || '';
        if (direct && /^\d{1,2}:\d{2}/.test(String(direct))) return String(direct).slice(0, 5);
        const m = String(text || '').match(/A las\s+(\d{1,2}:\d{2})\s*Hs/i);
        return m ? m[1] : nowHHMM();
    }

    function buildReferenciaFromEntry(entry, meta) {
        const parts = [];
        if (entry.maquina) parts.push(`Máq. ${entry.maquina}`);
        if (entry.monto || entry.importe || entry.total || entry.divisas) {
            const rawVal = entry.monto || entry.importe || entry.divisas || entry.total;
            const valStr = typeof rawVal === 'number'
                ? `$${rawVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : String(rawVal);
            parts.push(valStr.startsWith('$') || /USD|EUR/i.test(valStr) ? valStr : `$${valStr}`);
        }
        if (entry.cliente && entry.cliente !== 'Sin especificar' && entry.cliente !== 'Sin nombre') {
            parts.push(String(entry.cliente));
        } else if (entry.policia) {
            parts.push(String(entry.policia));
        } else if (entry.worker1 || entry.company1) {
            parts.push([entry.company1, entry.worker1].filter(Boolean).join(' · '));
        } else if (entry.responsable) {
            parts.push(String(entry.responsable));
        } else if (entry.summary) {
            return String(entry.summary).slice(0, 90);
        } else if (entry.sala && entry.cantidad) {
            parts.push(`${entry.sala} (${entry.cantidad} ev.)`);
        }
        if (parts.length > 0) return parts.join(' · ').slice(0, 110);
        return meta.modulo;
    }

    function showCapturePill(cloudSaved) {
        const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (page === 'bitacora.html') return;

        let pill = document.getElementById('cctvBitacoraAutoPill');
        if (!pill) {
            pill = document.createElement('div');
            pill.id = 'cctvBitacoraAutoPill';
            pill.className = 'no-print fixed bottom-4 left-4 z-50 transition-all duration-300 opacity-0 translate-y-4 pointer-events-auto';
            document.body.appendChild(pill);
        }

        const badgeTxt = cloudSaved ? '☁️ Guardado en Bitácora Nube' : '💾 Guardado en Bitácora de Turno';
        pill.innerHTML =
            '<div class="bg-slate-900 text-white border border-slate-700 px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs">' +
                '<span class="font-semibold text-emerald-400">' + escapeHtml(badgeTxt) + '</span>' +
                '<a href="bitacora.html" class="underline text-indigo-300 hover:text-white font-semibold">Ver Bitácora</a>' +
            '</div>';

        requestAnimationFrame(() => {
            pill.classList.remove('opacity-0', 'translate-y-4');
            pill.classList.add('opacity-100', 'translate-y-0');
        });

        clearTimeout(pill._hideTimer);
        pill._hideTimer = setTimeout(() => {
            pill.classList.remove('opacity-100', 'translate-y-0');
            pill.classList.add('opacity-0', 'translate-y-4');
        }, 3200);
    }

    function loadScriptOnce(src) {
        return new Promise((resolve, reject) => {
            const existing = Array.from(document.scripts).find(s => (s.getAttribute('src') || '').indexOf(src) !== -1);
            if (existing) {
                if (src.indexOf('supabase-config.js') !== -1 && window.SUPABASE_CONFIG) return resolve();
                if (src.indexOf('supabase-js') !== -1 && window.supabase) return resolve();
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('No se pudo cargar ' + src)));
                setTimeout(resolve, 600);
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('No se pudo cargar ' + src));
            document.head.appendChild(s);
        });
    }

    function getSupabaseCreds() {
        try {
            const raw = localStorage.getItem(STORAGE_SUPA_CREDS_KEY);
            if (raw) {
                const p = JSON.parse(raw);
                if (p && p.url && p.anonKey) return { url: p.url, anonKey: p.anonKey };
            }
        } catch (e) {}
        if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
            return { url: window.SUPABASE_CONFIG.url, anonKey: window.SUPABASE_CONFIG.anonKey };
        }
        return { url: '', anonKey: '' };
    }

    async function ensureSupabaseReady() {
        if (supabaseClient) return supabaseClient;
        if (window.__cctvSupabaseClientSingleton) {
            supabaseClient = window.__cctvSupabaseClientSingleton;
            return supabaseClient;
        }
        if (initPromise) return initPromise;

        initPromise = (async function () {
            try {
                if (!window.SUPABASE_CONFIG) {
                    await loadScriptOnce('js/supabase-config.js').catch(() => {});
                }
                const creds = getSupabaseCreds();
                if (!creds.url || !creds.anonKey) {
                    if (!getCachedSessionUser()) applyGateState(false, '');
                    return null;
                }

                if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                    await loadScriptOnce('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
                }
                if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                    if (!getCachedSessionUser()) applyGateState(false, '');
                    return null;
                }

                supabaseClient = window.__cctvSupabaseClientSingleton || window.supabase.createClient(creds.url, creds.anonKey);
                window.__cctvSupabaseClientSingleton = supabaseClient;

                const { data } = await supabaseClient.auth.getSession();
                currentSession = data?.session || null;

                if (currentSession?.user && isGateTrustedInBrowser()) {
                    applyGateState(true, currentSession.user.email || '');
                } else {
                    // Si había una sesión vieja de días anteriores sin marcar "Mantener sesión", exigir login explícito
                    applyGateState(false, '');
                }

                supabaseClient.auth.onAuthStateChange((_eventName, session) => {
                    currentSession = session || null;
                    if (currentSession?.user && isGateTrustedInBrowser()) {
                        applyGateState(true, currentSession.user.email || '');
                        syncPendingToCloud();
                    } else {
                        applyGateState(false, '');
                    }
                    notifyListeners();
                });

                notifyListeners();
                if (currentSession?.user) {
                    syncPendingToCloud();
                }
                return supabaseClient;
            } catch (e) {
                const cached = getCachedSessionUser();
                if (cached) {
                    applyGateState(true, cached.email || '');
                } else {
                    applyGateState(false, '');
                }
                return null;
            } finally {
                initPromise = null;
            }
        })();

        return initPromise;
    }

    async function pushSingleItemToCloud(item) {
        const client = await ensureSupabaseReady();
        if (!client || !currentSession?.user) return false;

        const payload = {
            created_by: currentSession.user.id,
            operator_email: currentSession.user.email || '',
            client_uid: item.client_uid,
            fecha_reporte: item.fecha_reporte || todayISO(),
            hora_evento: item.hora_evento || '',
            categoria: item.categoria || 'General',
            modulo: item.modulo || '',
            origen_archivo: item.origen_archivo || '',
            sala: item.sala || 'General',
            referencia: item.referencia || '',
            acta_texto: item.acta_texto || '',
            notas: item.notas || '',
            es_compartido: item.es_compartido !== false,
            datos_extra: item.datos_extra || {}
        };

        try {
            const { data, error } = await client
                .from(SUPABASE_TABLE)
                .upsert(payload, { onConflict: 'created_by,client_uid' })
                .select('id')
                .single();

            if (error || !data) return false;

            const list = getLocalEntries();
            const idx = list.findIndex(x => x.client_uid === item.client_uid);
            if (idx !== -1) {
                list[idx].synced = true;
                list[idx].cloud_id = data.id;
                list[idx].operator_email = currentSession.user.email || '';
                saveLocalEntries(list);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    async function syncPendingToCloud() {
        if (isSyncingQueue || !navigator.onLine) return { uploaded: 0 };
        const client = await ensureSupabaseReady();
        if (!client || !currentSession?.user) return { uploaded: 0 };

        const list = getLocalEntries();
        const pending = list.filter(x => !x.synced && x.acta_texto);
        if (pending.length === 0) return { uploaded: 0 };

        isSyncingQueue = true;
        let uploaded = 0;
        try {
            const payloads = pending.map(item => ({
                created_by: currentSession.user.id,
                operator_email: currentSession.user.email || '',
                client_uid: item.client_uid,
                fecha_reporte: item.fecha_reporte || todayISO(),
                hora_evento: item.hora_evento || '',
                categoria: item.categoria || 'General',
                modulo: item.modulo || '',
                origen_archivo: item.origen_archivo || '',
                sala: item.sala || 'General',
                referencia: item.referencia || '',
                acta_texto: item.acta_texto || '',
                notas: item.notas || '',
                es_compartido: item.es_compartido !== false,
                datos_extra: item.datos_extra || {}
            }));

            const { data, error } = await client
                .from(SUPABASE_TABLE)
                .upsert(payloads, { onConflict: 'created_by,client_uid' })
                .select('id,client_uid');

            if (!error && Array.isArray(data)) {
                const mapByUid = {};
                data.forEach(r => { mapByUid[r.client_uid] = r.id; });
                const updatedList = getLocalEntries().map(entry => {
                    if (mapByUid[entry.client_uid]) {
                        uploaded++;
                        return Object.assign({}, entry, {
                            synced: true,
                            cloud_id: mapByUid[entry.client_uid],
                            operator_email: currentSession.user.email || entry.operator_email || ''
                        });
                    }
                    return entry;
                });
                saveLocalEntries(updatedList);
            }
        } catch (e) {
            // Reintento automático cuando vuelva internet
        } finally {
            isSyncingQueue = false;
        }
        return { uploaded };
    }

    async function registrar(datos, silentPill) {
        if (!datos || !datos.acta_texto || !String(datos.acta_texto).trim()) return null;

        const actaLimpia = String(datos.acta_texto).trim();
        const list = getLocalEntries();

        if (list.length > 0 && list[0].acta_texto === actaLimpia && (Date.now() - (list[0].timestamp_ms || 0)) < 90000) {
            return list[0];
        }

        const record = {
            client_uid: datos.client_uid || genClientUid(),
            cloud_id: null,
            synced: false,
            timestamp_ms: Date.now(),
            created_at: new Date().toISOString(),
            fecha_reporte: datos.fecha_reporte || todayISO(),
            hora_evento: datos.hora_evento || extractHoraFromEntry({}, actaLimpia),
            categoria: datos.categoria || 'General',
            modulo: datos.modulo || 'Reporte CCTV',
            origen_archivo: datos.origen_archivo || (window.location.pathname.split('/').pop() || ''),
            sala: inferSalaFromText(actaLimpia, datos.sala || ''),
            referencia: datos.referencia || datos.modulo || 'Reporte CCTV',
            acta_texto: actaLimpia,
            notas: datos.notas || '',
            es_compartido: datos.es_compartido !== undefined ? Boolean(datos.es_compartido) : getSharePreference(),
            operator_email: currentSession?.user?.email || '',
            datos_extra: datos.datos_extra || {}
        };

        list.unshift(record);
        saveLocalEntries(list);

        const cloudOk = await pushSingleItemToCloud(record);
        if (!silentPill) {
            showCapturePill(cloudOk);
        }
        return record;
    }

    Storage.prototype.setItem = function (key, value) {
        const watchMeta = (this === window.localStorage) ? HISTORY_WATCH_MAP[key] : null;
        let prevTexts = null;

        if (watchMeta) {
            try {
                const prevRaw = this.getItem(key);
                const prevArr = prevRaw ? JSON.parse(prevRaw) : [];
                if (Array.isArray(prevArr)) {
                    prevTexts = new Set(prevArr.map(extractTextFromModuleEntry).filter(Boolean));
                }
            } catch (e) {
                prevTexts = new Set();
            }
        }

        rawSetItem.apply(this, arguments);

        if (watchMeta) {
            try {
                const nextArr = JSON.parse(value);
                if (Array.isArray(nextArr) && nextArr.length > 0) {
                    const newest = nextArr[0];
                    const newestText = extractTextFromModuleEntry(newest);
                    if (newestText && (!prevTexts || !prevTexts.has(newestText))) {
                        registrar({
                            categoria: watchMeta.categoria,
                            modulo: watchMeta.modulo,
                            origen_archivo: watchMeta.archivo,
                            sala: newest.sala || newest.salaObjetivo || newest.lugar || watchMeta.salaDefault || '',
                            hora_evento: extractHoraFromEntry(newest, newestText),
                            referencia: buildReferenciaFromEntry(newest, watchMeta),
                            acta_texto: newestText,
                            datos_extra: { sourceKey: key }
                        });
                    }
                }
            } catch (e) {}
        }
    };

    window.addEventListener('online', () => {
        syncPendingToCloud();
    });

    // Sincronizar cierre/inicio de sesión entre pestañas abiertas
    window.addEventListener('storage', (e) => {
        if (e.key && /^sb-.*-auth-token$/.test(e.key)) {
            const cached = getCachedSessionUser();
            if (cached) {
                applyGateState(true, cached.email || '');
            } else {
                currentSession = null;
                applyGateState(false, '');
            }
        }
    });

    window.CCTVAuthGate = {
        logout: logoutGlobal,
        isUnlocked: () => document.documentElement.classList.contains('cctv-auth-unlocked')
    };

    window.CCTVBitacora = {
        SUPABASE_TABLE,
        LOCAL_BITACORA_KEY,
        registrar,
        getLocalEntries,
        saveLocalEntries,
        getPendingCount,
        getSharePreference,
        setSharePreference,
        ensureSupabaseReady,
        syncPendingToCloud,
        logout: logoutGlobal,
        getSession: () => currentSession,
        getClient: () => supabaseClient,
        onChange: (fn) => {
            if (typeof fn === 'function') listeners.push(fn);
        }
    };

    function bootGateAndBitacora() {
        const cached = getCachedSessionUser();
        if (cached) {
            applyGateState(true, cached.email || '');
        } else {
            ensureAuthOverlayMounted();
        }
        updateHeaderBadges();
        ensureSupabaseReady();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootGateAndBitacora);
    } else {
        bootGateAndBitacora();
    }
})();
