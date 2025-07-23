document.addEventListener('DOMContentLoaded', function () {
    const campos = document.querySelectorAll('[data-mask-moeda="true"]');

    campos.forEach(function (campo) {
        campo.addEventListener('input', function () {
            let valor = campo.value.replace(/[^\d]/g, '');
            if (valor.length > 0) {
                valor = (parseInt(valor) / 100).toFixed(2);
                campo.value = "R$ " + valor.replace('.', ',');
            }
        });

        // Aplicar máscara ao carregar
        let valor = campo.value.replace(/[^\d]/g, '');
        if (valor.length > 0) {
            valor = (parseInt(valor) / 100).toFixed(2);
            campo.value = "R$ " + valor.replace('.', ',');
        }
    });
});
