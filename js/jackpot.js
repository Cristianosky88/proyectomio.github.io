document.addEventListener('DOMContentLoaded', function() {
    console.log('Documento cargado - Iniciando aplicación Jackpot');
    
    // --- 1. SELECCIÓN DE ELEMENTOS DEL DOM ---
    const form = document.getElementById('formJackpot');
    const resumenDiv = document.getElementById('resumen');
    const inputFotos = document.getElementById('fotos');
    const previewFotos = document.getElementById('previewFotos');
    const tbodyRegistros = document.getElementById('tbodyRegistros');
    const tplFila = document.getElementById('tplFilaRegistro');
    const btnGuardar = document.getElementById('btnGuardar');
    const btnGenerarResumen = document.getElementById('btnGenerarResumen');
    const btnAutocompletar = document.getElementById('btnAutocompletar');
    const btnExportarTodo = document.getElementById('btnExportarTodo');
    const btnBorrarRegistros = document.getElementById('btnBorrarRegistros');
    const btnDarkMode = document.getElementById('btnDarkMode');
    const btnLimpiarTodo = document.getElementById('btnLimpiarTodo');
    const inputNroMaq = document.getElementById('nro_maquina');

    // --- 2. CONSTANTES Y CONFIGURACIÓN ---
    const MAX_FOTOS = 12;
    const MAX_MB = 5;
    const STORAGE_KEY = 'jackpots_registros_v2';

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
        if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return null;
        const [H, m] = hhmm.split(':').map(Number);
        return H * 60 + m;
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
        // Reemplazar punto por coma para formato argentino
        const valor = el.value.replace('.', ',');
        const n = Number(valor.replace(',', '.'));
        if (!isNaN(n)) {
            el.value = n.toFixed(2).replace('.', ',');
        }
    }

    function recolectarDatos() {
        if (!form) return {};
        const fd = new FormData(form);
        const data = {};
        for (const [k, v] of fd.entries()) {
            data[k] = (typeof v === 'string') ? normalizarTexto(v) : v;
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
            lineas.push(`A las ${data.hora_cctv} Hs. CCTV recibe llamada de ${data.quien_llama || ''} ${data.nombre_llama || ''}, informa Jackpot en Máq. ${data.nro_maquina || ''} por un valor de $${importeFmt}.-`);
        }
        
        if (data.hora_revision) {
            lineas.push(`(A las ${data.hora_revision} Hs.) Revisión muestra que ${data.tipo_cliente || 'cliente'} juega en Máq. ${data.nro_maquina || ''}.-`);
        }
        
        if (data.hora_pago) {
            lineas.push(`A las ${data.hora_pago} Hs. ${data.quien_paga || ''} ${data.nombre_paga || ''}, cancela $${importeFmt} ${honorifico} ${data.nombre_cliente || ''}.-`);
        }
        
        if (data.hora_descarga) {
            lineas.push(`A las ${data.hora_descarga} Hs. ${data.quien_llama || ''} ${data.nombre_llama || ''} registra y descarga el premio.-`);
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

    function guardarRegistro(e) {
        if (e) e.preventDefault(); // Prevenir el envío del formulario
        console.log('Guardando registro...');
        
        if (!form) {
            console.error('No se encontró el formulario');
            return;
        }
        
        const data = recolectarDatos();
        if (!data.nro_maquina || !data.hora_cctv || !data.importe) {
            alert('Debe completar al menos los campos: Nro. Máquina, Hora CCTV e Importe.');
            return;
        }

        const validacion = validarHoras(data);
        if (!validacion.ok) {
            alert(validacion.msg);
            return;
        }

        const importeEl = document.getElementById('importe');
        const pagoManualEl = document.getElementById('pago_manual');
        
        if (importeEl) formatearNumeroCampo(importeEl);
        if (pagoManualEl && pagoManualEl.value) formatearNumeroCampo(pagoManualEl);

        const fotosMeta = Array.from(inputFotos?.files || []).map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
        }));

        const registro = construirObjetoFinal(data, fotosMeta);
        
        let registros = [];
        try {
            registros = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            console.error('Error al parsear registros:', e);
        }
        
        registros.push(registro);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));

        renderizarTablaRegistros();
        form.reset();
        if (previewFotos) previewFotos.innerHTML = '';
        alert('Registro guardado correctamente.');
    }

    // Función para renderizar la tabla de registros
    function renderizarTablaRegistros() {
        if (!tbodyRegistros) {
            console.error('No se encontró el elemento tbodyRegistros');
            return;
        }
        
        let registros = [];
        try {
            registros = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            console.error('Error al parsear registros:', e);
        }
        
        if (registros.length === 0) {
            tbodyRegistros.innerHTML = '<tr><td colspan="8" class="text-center text-muted small">Sin registros</td></tr>';
            return;
        }
        
        tbodyRegistros.innerHTML = '';
        
        registros.forEach((reg, idx) => {
            const fila = tplFila.content.cloneNode(true);
            
            fila.querySelector('[data-col="idx"]').textContent = idx + 1;
            
            try {
                fila.querySelector('[data-col="ts"]').textContent = new Date(reg.timestamp_guardado).toLocaleString('es-AR');
            } catch (e) {
                fila.querySelector('[data-col="ts"]').textContent = 'Fecha inválida';
            }
            
            fila.querySelector('[data-col="nro"]').textContent = reg.jackpot?.nro_maquina || 'N/A';
            
            let importe = 'N/A';
            try {
                if (reg.jackpot?.importe) {
                    const importeNum = parseFloat(String(reg.jackpot.importe).replace(',', '.'));
                    importe = `$${moneyFmt(importeNum)}`;
                }
            } catch (e) {
                console.error('Error al formatear importe en tabla:', e);
            }
            fila.querySelector('[data-col="imp"]').textContent = importe;
            
            fila.querySelector('[data-col="cliente"]').textContent = reg.cliente?.nombre || 'N/A';
            fila.querySelector('[data-col="pago"]').textContent = reg.pago?.hora_pago || 'N/A';
            fila.querySelector('[data-col="fotos"]').textContent = reg.fotosMeta ? reg.fotosMeta.length : 0;
            
            // Agregar atributo data-id para identificar el registro
            const btnVer = fila.querySelector('[data-col="acciones"] button');
            if (btnVer) btnVer.setAttribute('data-id', reg.id);
            
            tbodyRegistros.appendChild(fila);
        });
    }

    // Función para ver detalle de un registro
    window.verDetalle = function(btn) {
        console.log('Viendo detalle de registro...');
        const id = btn.getAttribute('data-id');
        let registros = [];
        try {
            registros = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            console.error('Error al parsear registros:', e);
            alert('Error al cargar los registros');
            return;
        }
        
        const registro = registros.find(r => r.id === id);
        
        if (!registro) {
            alert('Registro no encontrado');
            return;
        }
        
        // Construir narrativa para mostrar en el resumen
        const data = {
            hora_cctv: registro.contacto?.hora_cctv || '',
            quien_llama: registro.contacto?.rol || '',
            nombre_llama: registro.contacto?.nombre || '',
            nro_maquina: registro.jackpot?.nro_maquina || '',
            importe: registro.jackpot?.importe || '',
            hora_revision: registro.jackpot?.hora_revision || '',
            tipo_cliente: registro.cliente?.tipo || '',
            nombre_cliente: registro.cliente?.nombre || '',
            hora_pago: registro.pago?.hora_pago || '',
            quien_paga: registro.pago?.rol_paga || '',
            nombre_paga: registro.pago?.nombre_paga || '',
            hora_descarga: registro.pago?.hora_descarga || '',
            juego: registro.adicional?.juego || '',
            pago_manual: registro.adicional?.pago_manual || '',
            maquina_independiente: registro.adicional?.unidad || '',
            observaciones: registro.adicional?.observaciones || ''
        };
        
        const lineas = construirNarrativaFormatoSolicitado(data);
        
        if (resumenDiv) {
            resumenDiv.textContent = renderNarrativaSolicitada(lineas);
            resumenDiv.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Función para exportar todos los registros
    function exportarTodosRegistros() {
        console.log('Exportando registros...');
        let registros = [];
        try {
            registros = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            console.error('Error al parsear registros:', e);
            alert('Error al cargar los registros para exportar');
            return;
        }
        
        if (registros.length === 0) {
            alert('No hay registros para exportar');
            return;
        }
        
        const dataStr = JSON.stringify(registros, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportName = `jackpots_export_${new Date().toISOString().slice(0, 10)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportName);
        linkElement.style.display = 'none';
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
    }

    // Función para borrar todos los registros
    function borrarTodosRegistros() {
        console.log('Intentando borrar registros...');
        if (confirm('¿Está seguro que desea borrar TODOS los registros? Esta acción no se puede deshacer.')) {
            // Borrar registros del localStorage
            localStorage.removeItem(STORAGE_KEY);
            
            // Actualizar la tabla de registros
            renderizarTablaRegistros();
            
            // Limpiar el formulario
            if (form) {
                form.reset();
            }
            
            // Limpiar el resumen
            if (resumenDiv) {
                resumenDiv.textContent = '';
            }
            
            // Limpiar la vista previa de fotos
            if (previewFotos) {
                previewFotos.innerHTML = '';
            }
            
            alert('Todos los registros han sido eliminados');
            
            // Recargar la página completa para reiniciar el HTML
            window.location.reload();
        }
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
        
        // Prevenir el envío del formulario y manejar el guardado
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                guardarRegistro();
            });
        }
        
        // Configurar eventos de botones
        if (btnGenerarResumen) {
            btnGenerarResumen.addEventListener('click', generarResumen);
        }
        
        if (btnAutocompletar) {
            btnAutocompletar.addEventListener('click', autocompletar);
        }
        
        if (btnGuardar) {
            btnGuardar.addEventListener('click', function(e) {
                e.preventDefault();
                guardarRegistro();
            });
        }
        
        if (btnExportarTodo) {
            btnExportarTodo.addEventListener('click', exportarTodosRegistros);
        }
        
        if (btnBorrarRegistros) {
            btnBorrarRegistros.addEventListener('click', borrarTodosRegistros);
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
        
        // Cargar registros existentes
        renderizarTablaRegistros();
    }
    
    // Iniciar la aplicación
    init();
});
