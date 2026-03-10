document.addEventListener('DOMContentLoaded', function() {
    console.log('Documento cargado - Iniciando aplicación Jackpot');
    
    // --- 1. SELECCIÓN DE ELEMENTOS DEL DOM ---
    const form = document.getElementById('formJackpot');
    const resumenDiv = document.getElementById('resumen');
    const inputFotos = document.getElementById('fotos');
    const previewFotos = document.getElementById('previewFotos');
    const btnGenerarResumen = document.getElementById('btnGenerarResumen');
    const btnAutocompletar = document.getElementById('btnAutocompletar');
    const btnExportarTodo = document.getElementById('btnExportarTodo');
    const btnDarkMode = document.getElementById('btnDarkMode');
    const btnLimpiarTodo = document.getElementById('btnLimpiarTodo');
    const inputNroMaq = document.getElementById('nro_maquina');

    // --- 2. CONSTANTES Y CONFIGURACIÓN ---
    const MAX_FOTOS = 12;
    const MAX_MB = 5;

    // --- 3. FUNCIONES UTILITARIAS ---
    const normalizarTexto = str => str.trim().replace(/\s+/g, ' ');
    
    const moneyFmt = v => {
        if (v === null || v === '' || isNaN(v)) return '-';
        return Number(v).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };
    
    const nowISO = () => new Date().toISOString();
    
    const uid = () => {
        return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    };

    // --- 4. VALIDACIÓN ---
    function setupValidacionNroMaquina() {
        if (!inputNroMaq) return;
        
        inputNroMaq.addEventListener('input', () => {
            const original = inputNroMaq.value;
            inputNroMaq.value = original.replace(/\D/g, '').slice(0, 6);
            if (inputNroMaq.value.length !== 6) {
                inputNroMaq.setCustomValidity('Ingrese exactamente 6 dígitos (0-9).');
            } else {
                inputNroMaq.setCustomValidity('');
            }
        });
    }

    function toMinutes(hhmm) {
        if (!hhmm) return null;
        const parts = hhmm.split(':');
        if (parts.length < 2) return null;
        const H = Number(parts[0]);
        const m = Number(parts[1]);
        if (isNaN(H) || isNaN(m)) return null;
        return H * 60 + m;
    }

    function formatHoraSinSegundos(hhmm) {
        if (!hhmm) return '';
        const parts = hhmm.split(':');
        if (parts.length >= 2) {
            return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
        return hhmm;
    }

    function validarHoras(data) {
        const tC = toMinutes(data.hora_cctv);
        const tR = toMinutes(data.hora_revision);
        const tP = toMinutes(data.hora_pago);
        const tD = toMinutes(data.hora_descarga);
        
        if ([tC, tR, tP, tD].some(v => v === null)) {
            return { ok: false, msg: 'Una o más horas no son válidas.' };
        }
        return { ok: true };
    }

    function formatearNumeroCampo(el) {
        if (!el || !el.value) return;
        
        let val = el.value;
        val = val.replace(/[^\d.,]/g, '');
        
        let lastDot = val.lastIndexOf('.');
        let lastComma = val.lastIndexOf(',');
        let decimalPos = Math.max(lastDot, lastComma);
        
        if (decimalPos !== -1) {
            let integerPart = val.substring(0, decimalPos).replace(/[.,]/g, '');
            let decimalPart = val.substring(decimalPos + 1).replace(/[.,]/g, '');
            val = integerPart + '.' + decimalPart;
        } else {
            val = val.replace(/[.,]/g, '');
        }
        
        const n = Number(val);
        if (!isNaN(n) && val !== '') {
            el.value = n.toFixed(2).replace('.', ',');
        }
    }

    function recolectarDatos() {
        if (!form) return {};
        const fd = new FormData(form);
        const data = {};
        for (const [k, v] of fd.entries()) {
            let val = (typeof v === 'string') ? normalizarTexto(v) : v;
            if (k.startsWith('hora_') && typeof val === 'string') {
                val = formatHoraSinSegundos(val);
            }
            data[k] = val;
        }
        return data;
    }

    // --- 5. NARRATIVA ---
    function construirNarrativaFormatoSolicitado(data) {
        const lineas = [];
        let importeFmt = '-';
        let pagoManualFmt = null;
        
        try {
            if (data.importe) {
                const importeNum = parseFloat(String(data.importe).replace(',', '.'));
                importeFmt = moneyFmt(importeNum);
            }
            
            if (data.pago_manual) {
                const pagoManualNum = parseFloat(String(data.pago_manual).replace(',', '.'));
                pagoManualFmt = moneyFmt(pagoManualNum);
            }
        } catch (e) {
            console.error('Error al formatear importes:', e);
        }
        
        const honorifico = data.tipo_cliente === 'clienta' ? 'la Sra.' : 'al Sr.';

        if (data.hora_cctv) {
            const hCctv = formatHoraSinSegundos(data.hora_cctv);
            lineas.push(`A las ${hCctv} Hs. CCTV recibe llamada de ${data.quien_llama || ''} ${data.nombre_llama || ''}, informa Jackpot en Máq. ${data.nro_maquina || ''} por un valor de $${importeFmt}.-`);
        }
        
        if (data.hora_revision) {
            const hRev = formatHoraSinSegundos(data.hora_revision);
            lineas.push(`(A las ${hRev} Hs.) Revisión muestra que ${data.tipo_cliente || 'cliente'} juega en Máq. ${data.nro_maquina || ''}.-`);
        }
        
        if (data.hora_pago) {
            const hPago = formatHoraSinSegundos(data.hora_pago);
            lineas.push(`A las ${hPago} Hs. ${data.quien_paga || ''} ${data.nombre_paga || ''}, cancela $${importeFmt} ${honorifico} ${data.nombre_cliente || ''}.-`);
        }
        
        if (data.hora_descarga) {
            const hDescarga = formatHoraSinSegundos(data.hora_descarga);
            lineas.push(`A las ${hDescarga} Hs. ${data.quien_llama || ''} ${data.nombre_llama || ''} registra y descarga el premio.-`);
        }

        if (data.maquina_independiente) {
            lineas.push(`Máquina: ${data.maquina_independiente}.-`);
        }
        
        if (data.juego) {
            lineas.push(`Juego: ${data.juego}.-`);
        }
        
        if (pagoManualFmt) {
            lineas.push(`Pago Manual: $${pagoManualFmt}.-`);
        }

        if (data.observaciones) {
            lineas.push(`Observaciones: ${data.observaciones}.-`);
        }

        return lineas;
    }

    function renderNarrativaSolicitada(lineas) {
        return lineas.join('\n');
    }

    // --- 6. FUNCIONES PRINCIPALES ---
    function generarResumen() {
        console.log('Generando resumen...');
        const data = recolectarDatos();
        const lineas = construirNarrativaFormatoSolicitado(data);
        if (resumenDiv) {
            resumenDiv.textContent = renderNarrativaSolicitada(lineas);
        }
    }

    function construirObjetoFinal(data, fotosMeta) {
        return {
            id: uid(),
            timestamp_guardado: nowISO(),
            contacto: { 
                hora_cctv: data.hora_cctv || '', 
                rol: data.quien_llama || '', 
                nombre: data.nombre_llama || '' 
            },
            jackpot: { 
                nro_maquina: data.nro_maquina || '', 
                importe: data.importe || '', 
                hora_revision: data.hora_revision || '' 
            },
            cliente: { 
                tipo: data.tipo_cliente || '', 
                nombre: data.nombre_cliente || '' 
            },
            pago: { 
                hora_pago: data.hora_pago || '', 
                rol_paga: data.quien_paga || '', 
                nombre_paga: data.nombre_paga || '', 
                hora_descarga: data.hora_descarga || '' 
            },
            adicional: { 
                juego: data.juego || '', 
                pago_manual: data.pago_manual || '', 
                unidad: data.maquina_independiente || '',
                observaciones: data.observaciones || ''
            },
            fotosMeta: fotosMeta || []
        };
    }

    function autocompletar() {
        console.log('Autocompletando formulario...');
        if (!form) return;
        
        const campos = {
            'hora_cctv': '12:00',
            'quien_llama': 'Enc.',
            'nombre_llama': 'Juan Pérez',
            'nro_maquina': '123456',
            'importe': '1000,00',
            'hora_revision': '12:10',
            'tipo_cliente': 'cliente',
            'nombre_cliente': 'Carlos López',
            'hora_pago': '12:15',
            'quien_paga': 'Cajera',
            'nombre_paga': 'Ana Torres',
            'hora_descarga': '12:20',
            'juego': '88 FORTUNE',
            'maquina_independiente': 'BALLY',
            'pago_manual': '304144,00'
        };

        Object.entries(campos).forEach(([id, valor]) => {
            const campo = document.getElementById(id);
            if (campo) campo.value = valor;
        });
    }

    // Función para manejar el modo oscuro
    function toggleDarkMode() {
        console.log('Cambiando modo oscuro/claro...');
        document.documentElement.classList.toggle('dark-mode');
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem('dark_mode', isDarkMode ? 'true' : 'false');
        
        // Actualizar icono del botón
        if (btnDarkMode) {
            const icon = btnDarkMode.querySelector('i');
            if (icon) {
                icon.className = isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
        }
    }

    // Función para limpiar el formulario
    function limpiarFormulario() {
        console.log('Limpiando formulario...');
        if (form) {
            form.reset();
            if (resumenDiv) {
                resumenDiv.textContent = '';
            }
            if (previewFotos) {
                previewFotos.innerHTML = '';
            }
        }
    }

    // Función para manejar la vista previa de fotos
    function handleFileSelect() {
        console.log('Seleccionando archivos...');
        if (!previewFotos || !inputFotos) return;
        
        previewFotos.innerHTML = '';
        
        const files = inputFotos.files;
        if (!files || files.length === 0) return;
        
        if (files.length > MAX_FOTOS) {
            alert(`Máximo ${MAX_FOTOS} fotos permitidas. Se mostrarán solo las primeras ${MAX_FOTOS}.`);
        }
        
        for (let i = 0; i < Math.min(files.length, MAX_FOTOS); i++) {
            const file = files[i];
            
            // Verificar tamaño
            if (file.size > MAX_MB * 1024 * 1024) {
                alert(`La imagen "${file.name}" excede el tamaño máximo de ${MAX_MB}MB.`);
                continue;
            }
            
            // Verificar tipo
            if (!file.type.match('image.*')) {
                alert(`El archivo "${file.name}" no es una imagen válida.`);
                continue;
            }
            
            const reader = new FileReader();
            reader.onload = (function(theFile) {
                return function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.title = theFile.name;
                    img.alt = theFile.name;
                    previewFotos.appendChild(img);
                };
            })(file);
            
            reader.readAsDataURL(file);
        }
    }

    // --- 7. CONFIGURACIÓN DE EVENTOS ---
    function setupEventListeners() {
        console.log('Configurando event listeners...');
        
        // Configurar eventos de botones
        if (btnGenerarResumen) {
            btnGenerarResumen.addEventListener('click', generarResumen);
        }
        
        if (btnAutocompletar) {
            btnAutocompletar.addEventListener('click', autocompletar);
        }
        
        if (btnDarkMode) {
            btnDarkMode.addEventListener('click', toggleDarkMode);
        }
        
        if (btnLimpiarTodo) {
            btnLimpiarTodo.addEventListener('click', limpiarFormulario);
        }
        
        if (inputFotos) {
            inputFotos.addEventListener('change', handleFileSelect);
        }
    }
    
    // --- 8. INICIALIZACIÓN ---
    function init() {
        console.log('Inicializando aplicación...');
        setupValidacionNroMaquina();
        setupEventListeners();
        
        // Iniciar con modo oscuro si estaba guardado
        if (localStorage.getItem('dark_mode') === 'true') {
            toggleDarkMode();
        }
    }
    
    // Iniciar la aplicación
    init();
});
