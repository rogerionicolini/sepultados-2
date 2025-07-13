document.addEventListener("DOMContentLoaded", function () {
    // === 1. Atualiza campos visuais por tipo ===
    function atualizarCamposPorTipo() {
        const tipo = document.querySelector("#id_tipo").value;

        const campos_destino = [
            "id_destino_tipo",
            "id_tumulo_destino",
            "id_cemiterio_destino_nome",
            "id_cidade_destino",
            "id_estado_destino"
        ];

        campos_destino.forEach(id => {
            const div = document.querySelector(`#${id}`)?.closest(".form-row") || document.querySelector(`#${id}`)?.closest(".form-group");
            if (div) div.style.display = (tipo === "TRANSLADO") ? "block" : "none";
        });
    }

    const campoTipo = document.querySelector("#id_tipo");
    if (campoTipo) {
        campoTipo.addEventListener("change", atualizarCamposPorTipo);
        atualizarCamposPorTipo();  // Executa ao carregar
    }

    // === 2. Estilo do campo de sepultado ===
    function aplicarBordaSepultado() {
        const campo = document.getElementById("id_sepultado");
        if (campo) {
            campo.style.border = "2px solid black";
            campo.style.boxShadow = "none";
            campo.style.outline = "none";
            campo.style.backgroundColor = "#fff";
        }
    }

    aplicarBordaSepultado();
    document.addEventListener("click", aplicarBordaSepultado);
    document.addEventListener("focusin", aplicarBordaSepultado);
    document.addEventListener("change", aplicarBordaSepultado);

    // === 3. Atualiza o campo 'tumulo_origem_exibicao' ao selecionar sepultado ===
    const sepultadoField = document.querySelector("#id_sepultado");
    const campoTumulo = document.querySelector("#id_tumulo_origem_exibicao");

    function atualizarTumuloOrigem(sepultadoId) {
        if (!sepultadoId) {
            campoTumulo.value = "-";
            mostrarCampoTumulo();
            return;
        }

        fetch(`/ajax/tumulo-do-sepultado/?sepultado_id=${sepultadoId}`)
            .then(response => response.json())
            .then(data => {
                campoTumulo.value = data.tumulo || "-";
                mostrarCampoTumulo();
            })
            .catch(() => {
                campoTumulo.value = "-";
                mostrarCampoTumulo();
            });
    }

    function mostrarCampoTumulo() {
        const wrapper = campoTumulo.closest(".form-row") || campoTumulo.closest(".form-group");
        if (wrapper) wrapper.style.display = "block";
    }

    if (sepultadoField && campoTumulo) {
        sepultadoField.addEventListener("change", function () {
            atualizarTumuloOrigem(this.value);
        });

        // Executa no carregamento da página
        if (sepultadoField.value) {
            atualizarTumuloOrigem(sepultadoField.value);
        }
    }
});
