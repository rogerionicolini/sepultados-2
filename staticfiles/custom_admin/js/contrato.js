document.addEventListener('DOMContentLoaded', function () {
    const forma = document.getElementById('id_forma_pagamento');
    const parcelasInput = document.getElementById('id_quantidade_parcelas');
    const linhaParcelas = parcelasInput ? parcelasInput.closest('div.form-row, tr') : null;

    function toggleParcelas() {
        if (forma.value === 'parcelado') {
            if (linhaParcelas) linhaParcelas.style.display = '';
            if (parcelasInput) parcelasInput.style.display = '';
        } else {
            if (linhaParcelas) linhaParcelas.style.display = 'none';
            if (parcelasInput) parcelasInput.style.display = 'none';
        }
    }

    if (forma && parcelasInput && linhaParcelas) {
        forma.addEventListener('change', toggleParcelas);
        toggleParcelas(); // aplica na carga inicial
    }

    // === Máscara para CPF ou CNPJ ===
    const input = document.querySelector('input[data-mask-cpf-cnpj]');
    if (input) {
        input.addEventListener('input', function () {
            let value = input.value.replace(/\D/g, '');

            if (value.length <= 11) {
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else {
                value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
            }

            input.value = value;
        });
    }

    // === Máscara para campo de valor em moeda ===
    const valorField = document.querySelector('input[data-mask-moeda]');
    if (valorField) {
        function formatarMoeda(valor) {
            const numero = parseInt(valor.replace(/\D/g, '') || '0', 10);
            return (numero / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });
        }

        function aplicarMascaraMoeda(event) {
            const cursor = valorField.selectionStart;
            const valorOriginal = valorField.value;
            valorField.value = formatarMoeda(valorOriginal);
            valorField.setSelectionRange(cursor, cursor);
        }

        valorField.addEventListener('input', aplicarMascaraMoeda);
        valorField.value = formatarMoeda(valorField.value); // Aplica ao carregar
    }
});
