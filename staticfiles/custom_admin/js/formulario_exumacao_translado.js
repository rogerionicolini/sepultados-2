document.addEventListener('DOMContentLoaded', function () {
    const formaPagamento = document.getElementById('id_forma_pagamento');
    const campoParcelas = document.getElementById('id_quantidade_parcelas');
    const rowParcelas = campoParcelas ? campoParcelas.closest('.form-row') : null;
    const campoCPF = document.querySelector('.cpf');
    const campoValor = document.querySelector('.moeda');

    function aplicarMascaraCPF(input) {
        input.addEventListener('input', function () {
            let v = input.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            input.value = v;
        });
    }

    function aplicarMascaraMoeda(input) {
        input.addEventListener('input', function () {
            let v = input.value.replace(/\D/g, '');
            v = (v / 100).toFixed(2) + '';
            v = v.replace('.', ',');
            v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            input.value = v;
        });
    }

    function atualizarParcelas() {
        if (formaPagamento && rowParcelas) {
            const mostrar = formaPagamento.value === 'Parcelado';
            rowParcelas.style.display = mostrar ? 'block' : 'none';
            if (!mostrar) campoParcelas.value = '';
        }
    }

    if (formaPagamento) {
        formaPagamento.addEventListener('change', atualizarParcelas);
        atualizarParcelas();
    }

    if (campoCPF) aplicarMascaraCPF(campoCPF);
    if (campoValor) aplicarMascaraMoeda(campoValor);
});
