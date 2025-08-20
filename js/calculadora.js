const montoTicketInput = document.getElementById("montoTicket");
const sugerenciasDiv = document.getElementById("sugerencias");
const resultadoDiv = document.getElementById("resultado");

const denominaciones = [
    { id: 'd20000', valor: 20000 }, { id: 'd10000', valor: 10000 },
    { id: 'd2000', valor: 2000 },   { id: 'd1000', valor: 1000 },
    { id: 'd500', valor: 500 },     { id: 'd200', valor: 200 },
    { id: 'd100', valor: 100 },     { id: 'd50', valor: 50 },
    { id: 'd20', valor: 20 }
];

// ---- Funciones auxiliares ----
const formatCurrency = (num) => {
    return `$ ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const parseCurrency = (str) => {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, "").replace(",", ".").replace("$", "").trim()) || 0;
};

// ---- Calcular total ----
const calcularTotal = (showAlerts = false) => {
    let total = 0;
    denominaciones.forEach(d => {
        const cantidad = Number(document.getElementById(d.id).value) || 0;
        const subtotal = cantidad * d.valor;
        document.getElementById("st" + d.valor).innerText = formatCurrency(subtotal);
        total += subtotal;
    });

    resultadoDiv.innerText = "Total: " + formatCurrency(total);

    // Comparar con montoTicket
    const montoTicket = parseCurrency(montoTicketInput.value);
    if (showAlerts && montoTicket > 0) {
        if (total === montoTicket) {
            alert("✅ El total coincide con el monto del ticket.");
        } else {
            alert("⚠️ Diferencia detectada. Ticket: " + formatCurrency(montoTicket) + " | Calculado: " + formatCurrency(total));
        }
    }
    return total;
};

// ---- Sugerir billetes ----
window.sugerirBilletes = function() {
    const monto = parseCurrency(montoTicketInput.value);
    if (!monto || monto <= 0) {
        alert("Por favor ingrese un monto válido.");
        return;
    }

    let restante = monto;
    let sugerenciaHTML = "<h4>💡 Sugerencia de billetes:</h4><ul>";

    denominaciones.forEach(d => {
        const cantidad = Math.floor(restante / d.valor);
        if (cantidad > 0) {
            sugerenciaHTML += `<li>${cantidad} x ${formatCurrency(d.valor)}</li>`;
            document.getElementById(d.id).value = cantidad;
            restante -= cantidad * d.valor;
        } else {
            document.getElementById(d.id).value = 0;
        }
    });

    sugerenciaHTML += "</ul>";
    sugerenciasDiv.innerHTML = sugerenciaHTML;

    calcularTotal();
};

// ---- Borrar todo ----
window.borrarCampos = function() {
    montoTicketInput.value = "$ 0,00";
    sugerenciasDiv.innerHTML = "";
    denominaciones.forEach(d => {
        document.getElementById(d.id).value = 0;
        document.getElementById("st" + d.valor).innerText = "$ 0,00";
    });
    resultadoDiv.innerText = "Total: $ 0,00";
};

// ---- Event listeners ----
denominaciones.forEach(d => {
    document.getElementById(d.id).addEventListener("input", () => calcularTotal());
});

montoTicketInput.addEventListener("input", () => calcularTotal());
montoTicketInput.addEventListener("blur", (e) => {
    let numberValue = parseCurrency(e.target.value);
    e.target.value = formatCurrency(numberValue);
});
