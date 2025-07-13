document.addEventListener('DOMContentLoaded', function () {
    const campoAux = document.getElementById('id_cemiterio_aux');
    const campoReal = document.getElementById('id_cemiterio');

    if (campoAux && campoReal) {
        campoAux.addEventListener('change', function () {
            campoReal.value = campoAux.value;
        });
    }
});
