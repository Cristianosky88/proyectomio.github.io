(function () {
    'use strict';

    const montoTicketInput = document.getElementById('montoTicket');
    const sugerenciasDiv = document.getElementById('sugerencias');
    const resultadoDiv = document.getElementById('resultado');
    if (!montoTicketInput || !sugerenciasDiv || !resultadoDiv) return;

    const denominaciones = [
        { id: 'd20000', valor: 20000 }, { id: 'd10000', valor: 10000 },
        { id: 'd2000', valor: 2000 },   { id: 'd1000', valor: 1000 },
        { id: 'd500', valor: 500 },     { id: 'd200', valor: 200 },
        { id: 'd100', valor: 100 },     { id: 'd50', valor: 50 },
        { id: 'd20', valor: 20 }
    ];

    const formatCurrency = (num) => {
        const safe = Number.isFinite(num) ? num : 0;
        return `$ ${safe.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const parseCurrency = (str) => {
        if (!str) return 0;
        let s = String(str).trim().replace(/\$/g, '').replace(/\s+/g, '').replace(/[.,]+$/, '');
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
    };

    const calcularTotal = (showAlerts = false) => {
        let total = 0;
        denominaciones.forEach(d => {
            const el = document.getElementById(d.id);
            const stEl = document.getElementById('st' + d.valor);
            const cantidad = Math.max(0, Number(el ? el.value : 0) || 0);
            const subtotal = cantidad * d.valor;
            if (stEl) stEl.textContent = formatCurrency(subtotal);
            total += subtotal;
        });

        resultadoDiv.textContent = 'Total: ' + formatCurrency(total);

        const montoTicket = parseCurrency(montoTicketInput.value);
        if (showAlerts && montoTicket > 0) {
            if (Math.abs(total - montoTicket) < 0.01) {
                alert('✅ El total coincide con el monto del ticket.');
            } else {
                alert('⚠️ Diferencia detectada. Ticket: ' + formatCurrency(montoTicket) + ' | Calculado: ' + formatCurrency(total));
            }
        }
        return total;
    };

    window.sugerirBilletes = function () {
        const monto = parseCurrency(montoTicketInput.value);
        if (!monto || monto <= 0) {
            alert('Por favor ingrese un monto válido.');
            return;
        }

        let restante = monto;
        sugerenciasDiv.textContent = '';
        const h4 = document.createElement('h4');
        h4.textContent = '💡 Sugerencia de billetes:';
        const ul = document.createElement('ul');

        denominaciones.forEach(d => {
            const el = document.getElementById(d.id);
            const cantidad = Math.floor((restante + 1e-6) / d.valor);
            if (cantidad > 0) {
                const li = document.createElement('li');
                li.textContent = `${cantidad} x ${formatCurrency(d.valor)}`;
                ul.appendChild(li);
                if (el) el.value = String(cantidad);
                restante -= cantidad * d.valor;
            } else if (el) {
                el.value = '0';
            }
        });

        sugerenciasDiv.appendChild(h4);
        sugerenciasDiv.appendChild(ul);
        calcularTotal();
    };

    window.borrarCampos = function () {
        montoTicketInput.value = '$ 0,00';
        sugerenciasDiv.textContent = '';
        denominaciones.forEach(d => {
            const el = document.getElementById(d.id);
            const stEl = document.getElementById('st' + d.valor);
            if (el) el.value = '0';
            if (stEl) stEl.textContent = '$ 0,00';
        });
        resultadoDiv.textContent = 'Total: $ 0,00';
    };

    denominaciones.forEach(d => {
        const el = document.getElementById(d.id);
        if (el) el.addEventListener('input', () => calcularTotal());
    });

    montoTicketInput.addEventListener('input', () => calcularTotal());
    montoTicketInput.addEventListener('blur', (e) => {
        const numberValue = parseCurrency(e.target.value);
        e.target.value = formatCurrency(numberValue);
    });
})();
