document.addEventListener('DOMContentLoaded', function () {
    // Lógica para esconder/exibir o campo de parcelas
    function atualizarCampoParcelas() {
        const formaPagamento = document.getElementById('id_forma_pagamento');
        const campoParcelas = document.querySelector('[data-show-if-parcelado]');

        if (!formaPagamento || !campoParcelas) return;

        if (formaPagamento.value === 'parcelado') {
            campoParcelas.closest('.form-row, .form-group').style.display = 'block';
        } else {
            campoParcelas.closest('.form-row, .form-group').style.display = 'none';
        }
    }

    const formaPagamento = document.getElementById('id_forma_pagamento');
    if (formaPagamento) {
        formaPagamento.addEventListener('change', atualizarCampoParcelas);
        atualizarCampoParcelas(); // Executa ao carregar a página
    }
});
