// Remove globalmente os botões extras do Django Admin
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        const btnAddAnother = document.querySelector('input[name="_addanother"]');
        const btnContinue = document.querySelector('input[name="_continue"]');

        if (btnAddAnother) btnAddAnother.style.display = 'none';
        if (btnContinue) btnContinue.style.display = 'none';
    }, 300); // aguarda 300ms para garantir que os botões existam
});
