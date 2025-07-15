function mostrarCampoOutroSexo(select) {
    const outroCampo = document.querySelector('[name="sexo_outro_descricao"]')?.closest('.form-row');
    if (outroCampo) {
        if (select.value === 'O') {
            outroCampo.style.display = '';
        } else {
            outroCampo.style.display = 'none';
            document.querySelector('[name="sexo_outro_descricao"]').value = '';
        }
    }
}

function mostrarCampoConjuge(select) {
    const conjugeCampo = document.querySelector('[name="nome_conjuge"]')?.closest('.form-row');
    if (conjugeCampo) {
        if (['CASADO', 'VIUVO'].includes(select.value)) {
            conjugeCampo.style.display = '';
        } else {
            conjugeCampo.style.display = 'none';
            document.querySelector('[name="nome_conjuge"]').value = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const sexoSelect = document.querySelector('[name="sexo"]');
    if (sexoSelect) {
        mostrarCampoOutroSexo(sexoSelect);
        sexoSelect.addEventListener('change', function () {
            mostrarCampoOutroSexo(this);
        });
    }

    const estadoCivilSelect = document.querySelector('[name="estado_civil"]');
    if (estadoCivilSelect) {
        mostrarCampoConjuge(estadoCivilSelect);
        estadoCivilSelect.addEventListener('change', function () {
            mostrarCampoConjuge(this);
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const cpfFields = document.querySelectorAll('[data-mask-cpf]');
    cpfFields.forEach(input => {
        input.addEventListener('input', function () {
            let value = input.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');

            input.value = value;
        });
    });
});
