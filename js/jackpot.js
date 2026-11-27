/**
 * Utilidades compartidas y respaldo de compatibilidad para los módulos de Jackpot (CCTV).
 * Unificado con `cctv_theme` y parseo seguro de moneda argentina (`es-AR`).
 */
(function () {
    'use strict';

    const SHARED_MACHINES_KEY = 'cctv_jackpot_machines_catalog_v1';

    /**
     * Convierte cualquier entrada monetaria argentina o con punto decimal de teclado numérico
     * a número flotante exacto sin multiplicar por 100 ni truncar miles.
     * Ejemplos:
     *   "250.000"      -> 250000
     *   "250.000,50"   -> 250000.5
     *   "150000.50"    -> 150000.5
     *   "1,250,000.50" -> 1250000.5
     */
    function parseMontoSeguroAR(raw) {
        if (raw === null || raw === undefined) return NaN;
        let s = String(raw).trim().replace(/\$/g, '').replace(/\s+/g, '');
        if (!s) return NaN;
        s = s.replace(/[.,]+$/, '');
        if (!s) return NaN;

        const hasComma = s.includes(',');
        const hasDot = s.includes('.');

        if (hasComma && hasDot) {
            if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                s = s.replace(/,/g, '');
            }
        } else if (hasComma) {
            const parts = s.split(',');
            if (parts.length > 2) {
                const dec = parts.pop();
                s = parts.join('') + '.' + dec;
            } else if (parts[1] && parts[1].length === 3 && /^\d{1,3}$/.test(parts[0])) {
                s = parts[0] + parts[1];
            } else {
                s = parts[0] + '.' + (parts[1] || '');
            }
        } else if (hasDot) {
            const parts = s.split('.');
            if (parts.length > 2) {
                const last = parts[parts.length - 1];
                if (last.length === 3) {
                    s = parts.join('');
                } else {
                    const dec = parts.pop();
                    s = parts.join('') + '.' + dec;
                }
            } else {
                const intPart = parts[0] || '0';
                const fracPart = parts[1] || '';
                if (fracPart.length === 3 && intPart !== '0') {
                    s = intPart + fracPart;
                } else {
                    s = intPart + '.' + fracPart;
                }
            }
        }

        const num = Number(s);
        return Number.isFinite(num) ? num : NaN;
    }

    function formatMontoAR(value) {
        const n = typeof value === 'number' ? value : parseMontoSeguroAR(value);
        if (!Number.isFinite(n)) return '';
        return n.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatHoraSinSegundos(hhmm) {
        if (!hhmm) return '';
        const parts = String(hhmm).split(':');
        if (parts.length >= 2) {
            return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
        return String(hhmm);
    }

    function getSharedMachinesCatalog() {
        try {
            const raw = localStorage.getItem(SHARED_MACHINES_KEY);
            return raw ? JSON.parse(raw) || {} : {};
        } catch (e) {
            return {};
        }
    }

    function saveMachineToSharedCatalog(maquina, marca, juego) {
        const key = String(maquina || '').trim();
        if (!key) return;
        const catalog = getSharedMachinesCatalog();
        const prev = catalog[key] && typeof catalog[key] === 'object' ? catalog[key] : {};
        catalog[key] = {
            marca: String(marca || prev.marca || '').trim(),
            juego: String(juego || prev.juego || '').trim(),
            updatedAt: Date.now()
        };
        try {
            localStorage.setItem(SHARED_MACHINES_KEY, JSON.stringify(catalog));
        } catch (e) {}
    }

    function syncThemeFromStorage() {
        try {
            const isDark = localStorage.getItem('cctv_theme') === 'dark';
            document.documentElement.classList.toggle('dark', isDark);
        } catch (e) {}
    }

    window.CCTVJackpotUtils = {
        SHARED_MACHINES_KEY,
        parseMontoSeguroAR,
        formatMontoAR,
        formatHoraSinSegundos,
        getSharedMachinesCatalog,
        saveMachineToSharedCatalog,
        syncThemeFromStorage
    };
})();
