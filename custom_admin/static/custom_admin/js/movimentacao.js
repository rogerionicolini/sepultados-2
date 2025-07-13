document.addEventListener("DOMContentLoaded", function () {
    // === 1. Campos de destino visíveis apenas para translado ===
    function atualizarCamposPorTipo() {
        const tipo = document.querySelector("#id_tipo")?.value;

        const campos_destino = [
            "id_destino_tipo",
            "id_tumulo_destino",
            "id_cemiterio_destino_nome",
            "id_cidade_destino",
            "id_estado_destino"
        ];

        campos_destino.forEach(id => {
            const campo = document.querySelector(`#${id}`);
            const wrapper = campo?.closest(".form-row") || campo?.closest(".form-group");
            if (wrapper) {
                wrapper.style.display = (tipo === "TRANSLADO") ? "block" : "none";
            }
        });
    }

    const campoTipo = document.querySelector("#id_tipo");
    if (campoTipo) {
        campoTipo.addEventListener("change", atualizarCamposPorTipo);
        atualizarCamposPorTipo();
    }

    // === 2. Borda personalizada no campo sepultado ===
    function estilizarCampoSepultado() {
        const campo = document.getElementById("id_sepultado");
        if (campo) {
            campo.style.border = "2px solid black";
            campo.style.boxShadow = "none";
            campo.style.outline = "none";
            campo.style.backgroundColor = "#fff";
        }
    }

    estilizarCampoSepultado();
    document.addEventListener("click", estilizarCampoSepultado);
    document.addEventListener("focusin", estilizarCampoSepultado);
    document.addEventListener("change", estilizarCampoSepultado);

    // === 3. Atualiza o campo de exibição do túmulo de origem
    const sepultadoField = document.querySelector("#id_sepultado");
    const campoTumulo = document.querySelector("#id_tumulo_origem_exibicao");

    function atualizarTumuloOrigem(sepultadoId) {
        if (!campoTumulo) return;

        if (!sepultadoId) {
            campoTumulo.value = "-";
            mostrarCampoTumulo();
            return;
        }

        fetch(`/admin/obter-tumulo-origem/?sepultado_id=${sepultadoId}`)
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
        const wrapper = campoTumulo?.closest(".form-row") || campoTumulo?.closest(".form-group");
        if (wrapper) wrapper.style.display = "block";
    }

    if (sepultadoField && campoTumulo) {
        sepultadoField.addEventListener("change", function () {
            atualizarTumuloOrigem(this.value);
        });

        if (sepultadoField.value) {
            atualizarTumuloOrigem(sepultadoField.value);
        }
    }

    const forma = document.getElementById("id_forma_pagamento");
const parcelas = document.getElementById("id_quantidade_parcelas");

function atualizarParcelas() {
    if (!forma || !parcelas) return;
    const linha = parcelas.closest(".form-row") || parcelas.closest(".form-group") || parcelas.closest(".form-inline");
    if (forma.value === "parcelado") {
        if (linha) linha.style.display = "";
    } else {
        if (linha) linha.style.display = "none";
        parcelas.value = "";
    }
}

if (forma && parcelas) {
    forma.addEventListener("change", atualizarParcelas);
    atualizarParcelas();
}


    // === 5. Máscara no campo de valor ===
    const campoValor = document.querySelector("#id_valor");

    function aplicarMascaraMoeda(campo) {
        if (!campo) return;
        campo.addEventListener("input", function () {
            let valor = campo.value.replace(/\D/g, "");
            valor = (parseFloat(valor) / 100).toFixed(2);
            campo.value = "R$ " + valor.replace(".", ",");
        });

        if (campo.value && !campo.value.includes("R$")) {
            let valor = campo.value.replace(/\D/g, "");
            valor = (parseFloat(valor) / 100).toFixed(2);
            campo.value = "R$ " + valor.replace(".", ",");
        }
    }

    aplicarMascaraMoeda(campoValor);
});
