document.addEventListener("DOMContentLoaded", function () {
    const cemiterioSelect = document.querySelector("#id_cemiterio");
    const quadraSelect = document.querySelector("#id_quadra");

    function atualizarQuadras(cemiterioId, quadraSelecionada = null) {
        fetch(`/admin/quadras-do-cemiterio/?cemiterio_id=${cemiterioId}`)
            .then(response => response.json())
            .then(data => {
                quadraSelect.innerHTML = "";

                const emptyOption = document.createElement("option");
                emptyOption.value = "";
                emptyOption.textContent = "---------";
                quadraSelect.appendChild(emptyOption);

                data.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item.id;
                    option.textContent = item.codigo;

                    if (quadraSelecionada && quadraSelecionada === item.id.toString()) {
                        option.selected = true;
                    }

                    quadraSelect.appendChild(option);
                });
            });
    }

    if (cemiterioSelect && quadraSelect) {
        cemiterioSelect.addEventListener("change", function () {
            const cemiterioId = this.value.replace(/\D/g, '');  // <-- CORRIGIDO
            if (cemiterioId) {
                atualizarQuadras(cemiterioId);
            } else {
                quadraSelect.innerHTML = "";
                const emptyOption = document.createElement("option");
                emptyOption.value = "";
                emptyOption.textContent = "---------";
                quadraSelect.appendChild(emptyOption);
            }
        });

        // Executa na abertura da página
        const selectedCemiterio = cemiterioSelect.value.replace(/\D/g, ''); // <-- CORRIGIDO
        const quadraDataSelected = quadraSelect.getAttribute("data-selected");

        if (selectedCemiterio) {
            atualizarQuadras(selectedCemiterio, quadraDataSelected);
        }
    }
});
