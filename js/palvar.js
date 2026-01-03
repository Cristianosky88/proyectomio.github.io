document.addEventListener('DOMContentLoaded', function () {
    // Funciones utilitarias
    const toNumberStringAR = num => num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const parseNumberAR = input => input ? parseFloat(input.replace(/\./g, '').replace(',', '.')) || 0 : 0;
    const formatCurrencyAR = value => new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value);

    // Función para formatear hora en 24h (sin conversión)
    function formatearHora24(hora24) {
        if (!hora24) return '';
        return hora24; // Devuelve la hora tal como está en formato 24h
    }

    // Elementos
    const valorTotal = document.getElementById('valorTotal');
    const montoPagado = document.getElementById('montoPagado');
    const tipoCargo = document.getElementById('tipoCargo');
    const grupoPersonalizado = document.getElementById('grupoPersonalizado');
    const cargoPersonalizado = document.getElementById('cargoPersonalizado');
    const formTickets = document.getElementById('formTickets');
    const avisoMonto = document.getElementById('avisoMonto');
    const reporteDiv = document.getElementById('reporte');
    const historialDiv = document.getElementById('historial');

    // Formateo de campos numéricos
    [valorTotal, montoPagado].forEach(input => {
        input.addEventListener('blur', e => {
            const num = parseNumberAR(e.target.value);
            e.target.value = toNumberStringAR(num);
        });
    });

    // Mostrar/ocultar campo personalizado
    tipoCargo.addEventListener('change', function () {
        const mostrar = this.value === 'personalizado';
        grupoPersonalizado.style.display = mostrar ? 'block' : 'none';
        cargoPersonalizado.required = mostrar;
        if (!mostrar) cargoPersonalizado.value = '';
    });

    // Envío del formulario
    formTickets.addEventListener('submit', function (e) {
        e.preventDefault();

        const nombre = document.getElementById('nombrePersona').value.trim();
        const clienteGenero = document.getElementById('clienteGenero').value;
        const cantidad = Number(document.getElementById('cantidadTickets').value);
        const total = parseNumberAR(valorTotal.value);
        const pagado = parseNumberAR(montoPagado.value);
        const cargo = tipoCargo.value;
        const cargoPers = cargoPersonalizado.value.trim();
        
        // Verificar si existen los campos de hora personalizada
        const horaPrimeraInput = document.getElementById('horaPrimeraOperacion');
        const horaUltimaInput = document.getElementById('horaUltimaFila');
        const horaPrimera = horaPrimeraInput ? horaPrimeraInput.value : null;
        const horaUltima = horaUltimaInput ? horaUltimaInput.value : null;

        // Usa la hora actual como fallback (en formato 24h)
        const fecha = new Date();
        const horaFormateada = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

        if (!nombre || !cantidad || !total || !pagado || !cargo || (cargo === 'personalizado' && !cargoPers)) {
            alert('Por favor complete todos los campos correctamente.');
            return;
        }
        if (!/^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/.test(nombre)) {
            alert('El nombre solo puede contener letras y espacios.');
            return;
        }

        const cargoFinal = cargo === 'personalizado' ? cargoPers : cargo;

        // Determinar las horas para cada línea (manteniendo formato 24h)
        let horaPrimeraLinea, horaSegundaLinea, horaTerceraLinea;
        
        if (horaPrimera) {
            horaPrimeraLinea = formatearHora24(horaPrimera);
            horaSegundaLinea = formatearHora24(horaPrimera);
        } else {
            horaPrimeraLinea = horaFormateada;
            horaSegundaLinea = horaFormateada;
        }
        
        if (horaUltima) {
            horaTerceraLinea = formatearHora24(horaUltima);
        } else {
            horaTerceraLinea = horaFormateada;
        }

        const reporteHTML = `
            <div class="card mt-3">
                <div class="card-body">
                    <p>A las ${horaPrimeraLinea} Hs. CCTV recibe llamada de ${cargoFinal} ${nombre} · , informa que recibió de ${clienteGenero} · ${cantidad} · tickets para cambio por valor de ${formatCurrencyAR(total)} .-</p>
                    <p>A las ${horaSegundaLinea} Hs. ${cargoFinal} ${nombre} · redime ${cantidad} · tickets ·</p>
                    <p>A las ${horaTerceraLinea} Hs. ${cargoFinal} ${nombre} · cancela en ventanilla de caja</p>
                    <p>${formatCurrencyAR(pagado)} a ${clienteGenero} · · -</p>
                </div>
            </div>
        `;
        reporteDiv.innerHTML = reporteHTML;

        if (Math.abs(total - pagado) > 0.009) {
            avisoMonto.innerHTML = `<div class="alert alert-warning mt-3">
                <i class="fas fa-exclamation-triangle"></i>
                ¡Atención! Hay una diferencia de ${formatCurrencyAR(total - pagado)}. El monto pagado debería ser ${formatCurrencyAR(total)}
            </div>`;
        } else {
            avisoMonto.innerHTML = `<div class="alert alert-success mt-3">
                <i class="fas fa-check-circle"></i>
                El monto pagado es correcto.
            </div>`;
        }

        guardarEnHistorial(reporteHTML, fecha);
        actualizarHistorial();
    });

    // Historial
    function guardarEnHistorial(reporte, fecha) {
        let historial = JSON.parse(localStorage.getItem('historialTickets') || '[]');
        historial.unshift({ reporte, fecha });
        localStorage.setItem('historialTickets', JSON.stringify(historial.slice(0, 20)));
    }
    
    function actualizarHistorial() {
        let historial = JSON.parse(localStorage.getItem('historialTickets') || '[]');
        historialDiv.innerHTML = historial.length
            ? historial.map(item => `
                <div class="historial-item mb-3">
                    <div class="small text-muted">${new Date(item.fecha).toLocaleString('es-AR')}</div>
                    ${item.reporte}
                </div>`).join('')
            : '<p class="text-muted">No hay registros en el historial.</p>';
    }
    
    window.borrarHistorial = function () {
        if (confirm('¿Estás seguro que querés borrar todo el historial?')) {
            localStorage.removeItem('historialTickets');
            historialDiv.innerHTML = '<p class="text-muted">No hay registros en el historial.</p>';
            reporteDiv.innerHTML = '';
            avisoMonto.innerHTML = '';
            alert('Historial borrado correctamente.');
        }
    };
    
    actualizarHistorial();

    // --- Modo Oscuro/Claro ---
    const toggleBtn = document.getElementById('modoToggle');
    const body = document.body;
    if (localStorage.getItem('modo') === 'oscuro') {
        body.classList.add('dark-mode');
        toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
    toggleBtn.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('modo', 'oscuro');
            toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            localStorage.setItem('modo', 'claro');
            toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        }
    });

    // Script para copiar reporte
    window.copiarReporte = function () {
        const reporte = document.getElementById('reporte');
        if (reporte) {
            const textoReporte = reporte.innerText.trim();
            if (textoReporte !== "") {
                navigator.clipboard.writeText(textoReporte)
                    .then(() => alert('Reporte copiado al portapapeles'))
                    .catch(() => alert('No se pudo copiar'));
            } else {
                alert('No hay reporte para copiar');
            }
        } else {
            alert('No hay reporte para copiar');
        }
    };
});