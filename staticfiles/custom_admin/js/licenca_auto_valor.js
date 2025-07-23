document.addEventListener('DOMContentLoaded', function () {
    const planoSelect = document.getElementById('id_plano');
    const valorMensalInput = document.getElementById('id_valor_mensal_atual');

    if (planoSelect && valorMensalInput) {
        planoSelect.addEventListener('change', function () {
            const planoId = this.value;
            if (!planoId) return;

            fetch(`/admin/sepultados_gestao/plano/${planoId}/json/`)
                .then(response => response.json())
                .then(data => {
                    if (data.preco_mensal !== undefined) {
                        valorMensalInput.value = data.preco_mensal;
                    }
                });
        });
    }
});
