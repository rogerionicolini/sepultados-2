document.addEventListener('DOMContentLoaded', function () {
    const aplicarEstilo = () => {
        const campo = document.getElementById('id_sepultado');
        if (campo) {
            campo.style.border = '2px solid black';
            campo.style.boxShadow = 'none';
            campo.style.outline = 'none';
            campo.style.backgroundColor = '#fff';
        }
    };

    // Aplica imediatamente
    aplicarEstilo();

    // Reaplica ao interagir com a página
    document.addEventListener('click', aplicarEstilo);
    document.addEventListener('focusin', aplicarEstilo);
    document.addEventListener('change', aplicarEstilo);
});
