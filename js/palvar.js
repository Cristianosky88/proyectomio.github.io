document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseNumberAR(raw) {
        if (raw === null || raw === undefined) return 0;
        let s = String(raw).trim().replace(/\$/g, '').replace(/\s+/g, '').replace(/[.,]+$/, '');
        if (!s) return 0;
        if (s.includes(',') && s.includes('.')) {
            s = s.lastIndexOf(',') > s.lastIndexOf('.')
                ? s.replace(/\./g, '').replace(',', '.')
                : s.replace(/,/g, '');
        } else if (s.includes(',')) {
            s = s.replace(',', '.');
        } else if (s.includes('.')) {
            const parts = s.split('.');
            if (parts.length > 2 || (parts[1] && parts[1].length === 3 && parts[0] !== '0')) {
                s = parts.join('');
            }
        }
        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
    }

    const toNumberStringAR = num => num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatCurrencyAR = value => new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value);

    const valorTotal = document.getElementById('valorTotal');
    const montoPagado = document.getElementById('montoPagado');
    const tipoCargo = document.getElementById('tipoCargo');
    const grupoPersonalizado = document.getElementById('grupoPersonalizado');
    const cargoPersonalizado = document.getElementById('cargoPersonalizado');
    const formTickets = document.getElementById('formTickets');
    const avisoMonto = document.getElementById('avisoMonto');
    const reporteDiv = document.getElementById('reporte');
    const historialDiv = document.getElementById('historial');

    if (!formTickets) return;

    [valorTotal, montoPagado].forEach(input => {
        if (!input) return;
        input.addEventListener('blur', e => {
            const num = parseNumberAR(e.target.value);
            e.target.value = toNumberStringAR(num);
        });
    });

    if (tipoCargo && grupoPersonalizado && cargoPersonalizado) {
        tipoCargo.addEventListener('change', function () {
            const mostrar = this.value === 'personalizado';
            grupoPersonalizado.style.display = mostrar ? 'block' : 'none';
            cargoPersonalizado.required = mostrar;
            if (!mostrar) cargoPersonalizado.value = '';
        });
    }

    formTickets.addEventListener('submit', function (e) {
        e.preventDefault();

        const nombre = (document.getElementById('nombrePersona')?.value || '').trim();
        const clienteGenero = document.getElementById('clienteGenero')?.value || 'cliente';
        const cantidad = Number(document.getElementById('cantidadTickets')?.value) || 0;
        const total = parseNumberAR(valorTotal?.value);
        const pagado = parseNumberAR(montoPagado?.value);
        const cargo = tipoCargo?.value || '';
        const cargoPers = (cargoPersonalizado?.value || '').trim();

        const horaPrimera = document.getElementById('horaPrimeraOperacion')?.value || '';
        const horaUltima = document.getElementById('horaUltimaFila')?.value || '';

        const fecha = new Date();
        const horaFormateada = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

        if (!nombre || !cantidad || !total || !pagado || !cargo || (cargo === 'personalizado' && !cargoPers)) {
            alert('Por favor complete todos los campos correctamente.');
            return;
        }

        const cargoFinal = cargo === 'personalizado' ? cargoPers : cargo;
        const h1 = horaPrimera || horaFormateada;
        const h2 = horaPrimera || horaFormateada;
        const h3 = horaUltima || horaFormateada;

        const lineas = [
            `A las ${h1} Hs. CCTV recibe llamada de ${cargoFinal} ${nombre} · , informa que recibió de ${clienteGenero} · ${cantidad} · tickets para cambio por valor de ${formatCurrencyAR(total)} .-`,
            `A las ${h2} Hs. ${cargoFinal} ${nombre} · redime ${cantidad} · tickets ·`,
            `A las ${h3} Hs. ${cargoFinal} ${nombre} · cancela en ventanilla de caja`,
            `${formatCurrencyAR(pagado)} a ${clienteGenero} · · -`
        ];

        if (reporteDiv) {
            reporteDiv.innerHTML = `<div class="card mt-3"><div class="card-body">${lineas.map(l => `<p>${escapeHtml(l)}</p>`).join('')}</div></div>`;
        }

        if (avisoMonto) {
            if (Math.abs(total - pagado) > 0.009) {
                avisoMonto.innerHTML = `<div class="alert alert-warning mt-3">¡Atención! Hay una diferencia de ${escapeHtml(formatCurrencyAR(total - pagado))}. El monto pagado debería ser ${escapeHtml(formatCurrencyAR(total))}</div>`;
            } else {
                avisoMonto.innerHTML = '<div class="alert alert-success mt-3">El monto pagado es correcto.</div>';
            }
        }

        guardarEnHistorial(lineas.join('\n'), fecha.toISOString());
        actualizarHistorial();
    });

    function guardarEnHistorial(textoPlano, fecha) {
        let historial = [];
        try { historial = JSON.parse(localStorage.getItem('historialTickets') || '[]'); } catch (e) {}
        historial.unshift({ texto: textoPlano, fecha });
        try { localStorage.setItem('historialTickets', JSON.stringify(historial.slice(0, 20))); } catch (e) {}
    }

    function actualizarHistorial() {
        if (!historialDiv) return;
        let historial = [];
        try { historial = JSON.parse(localStorage.getItem('historialTickets') || '[]'); } catch (e) {}
        historialDiv.innerHTML = historial.length
            ? historial.map(item => {
                const textoSeguro = item.texto
                    ? escapeHtml(item.texto).replace(/\n/g, '<br>')
                    : escapeHtml(String(item.reporte || '').replace(/<[^>]*>/g, ' ').trim());
                return `
                <div class="historial-item mb-3">
                    <div class="small text-muted">${escapeHtml(new Date(item.fecha).toLocaleString('es-AR'))}</div>
                    <div class="mt-1">${textoSeguro}</div>
                </div>`;
            }).join('')
            : '<p class="text-muted">No hay registros en el historial.</p>';
    }

    window.borrarHistorial = function () {
        if (confirm('¿Estás seguro que querés borrar todo el historial?')) {
            try { localStorage.removeItem('historialTickets'); } catch (e) {}
            if (historialDiv) historialDiv.innerHTML = '<p class="text-muted">No hay registros en el historial.</p>';
            if (reporteDiv) reporteDiv.innerHTML = '';
            if (avisoMonto) avisoMonto.innerHTML = '';
        }
    };

    actualizarHistorial();

    const toggleBtn = document.getElementById('modoToggle');
    if (toggleBtn) {
        const isDarkSaved = localStorage.getItem('cctv_theme') === 'dark';
        document.documentElement.classList.toggle('dark', isDarkSaved);
        document.body.classList.toggle('dark-mode', isDarkSaved);
        toggleBtn.addEventListener('click', () => {
            const nextDark = !document.documentElement.classList.contains('dark');
            document.documentElement.classList.toggle('dark', nextDark);
            document.body.classList.toggle('dark-mode', nextDark);
            try { localStorage.setItem('cctv_theme', nextDark ? 'dark' : 'light'); } catch (e) {}
        });
    }

    window.copiarReporte = function () {
        const reporte = document.getElementById('reporte');
        const textoReporte = reporte ? reporte.innerText.trim() : '';
        if (!textoReporte) {
            alert('No hay reporte para copiar');
            return;
        }
        navigator.clipboard.writeText(textoReporte)
            .then(() => alert('Reporte copiado al portapapeles'))
            .catch(() => alert('No se pudo copiar'));
    };
});
