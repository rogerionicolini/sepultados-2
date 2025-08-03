from django.contrib.admin.views.decorators import staff_member_required
from django.http import FileResponse, HttpResponseForbidden
from django.conf import settings
from django.utils.timezone import now
from django.core.management import call_command
import os
import zipfile
import tempfile

@staff_member_required
def backup_completo(request):
    if not request.user.is_superuser:
        return HttpResponseForbidden("Acesso restrito ao superusuário.")

    timestamp = now().strftime('%Y%m%d_%H%M')
    zip_filename = f"backup_completo_{timestamp}.zip"

    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, zip_filename)
    dump_path = os.path.join(temp_dir, "dump.json")

    # Gera o dump dos dados do banco
    with open(dump_path, "w", encoding="utf-8") as dump_file:
        call_command("dumpdata", "--natural-foreign", "--natural-primary", "--indent", "2", stdout=dump_file)

    # Cria o zip com dump + arquivos do MEDIA_ROOT
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Adiciona o dump do banco
        zipf.write(dump_path, "dump.json")

        # Adiciona os arquivos de mídia
        for root, _, files in os.walk(settings.MEDIA_ROOT):
            if "backups" in root.lower():
                continue
            for file in files:
                full_path = os.path.join(root, file)
                arcname = os.path.relpath(full_path, settings.MEDIA_ROOT)
                zipf.write(full_path, f"media/{arcname}")  # coloca dentro da pasta "media" no zip

    return FileResponse(open(zip_path, 'rb'), as_attachment=True, filename=zip_filename)


# views_backup.py

import os
import zipfile
import io
from datetime import datetime
from django.http import HttpResponse
from openpyxl import Workbook
from django.contrib.admin.views.decorators import staff_member_required
from django.conf import settings
from django.db import models
from sepultados_gestao.models import (
    Sepultado, Exumacao, Translado, ConcessaoContrato, Anexo
)


@staff_member_required
def backup_prefeitura_ativa(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    if not prefeitura_id:
        return HttpResponse("Prefeitura ativa não selecionada.", status=400)

    # Coletar dados principais
    sepultados = Sepultado.objects.filter(
        tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id
    ).select_related(
        "tumulo",
        "tumulo__quadra",
        "tumulo__quadra__cemiterio",
    )


    contratos = ConcessaoContrato.objects.filter(prefeitura_id=prefeitura_id)
    exumacoes = Exumacao.objects.filter(prefeitura_id=prefeitura_id)
    translados = Translado.objects.filter(
        tumulo_destino__quadra__cemiterio__prefeitura_id=prefeitura_id
    ).select_related("sepultado", "tumulo_destino", "tumulo_destino__quadra", "tumulo_destino__quadra__cemiterio")


    # Coletar IDs para os anexos
    sepultados_ids = sepultados.values_list("id", flat=True)
    contratos_ids = contratos.values_list("id", flat=True)
    exumacoes_ids = exumacoes.values_list("id", flat=True)
    translados_ids = translados.values_list("id", flat=True)

    # Coletar todos os Anexos relevantes
    anexos = Anexo.objects.filter(
        models.Q(content_type__model="sepultado", object_id__in=sepultados_ids) |
        models.Q(content_type__model="concessaocontrato", object_id__in=contratos_ids) |
        models.Q(content_type__model="exumacao", object_id__in=exumacoes_ids) |
        models.Q(content_type__model="translado", object_id__in=translados_ids)
    ).select_related("content_type")

    # Criar planilha Excel dos sepultados
    wb = Workbook()
    ws = wb.active
    ws.title = "Sepultados"

    headers = [
        "Número do Sepultamento", "Nome", "CPF", "Sexo", "Data Nasc.",
        "Local Nascimento", "Nacionalidade", "Cor da Pele", "Estado Civil",
        "Nome Pai", "Nome Mãe", "Profissão", "Escolaridade",
        "Data Falecimento", "Hora Falecimento", "Local Falecimento", "Causa Morte",
        "Médico", "CRM", "Idade ao Falecer",
        "Cartório Nome", "Número Registro", "Livro", "Folha", "Data Registro",
        "Túmulo", "Quadra", "Linha", "Data Sepultamento", "Observações",
        "Forma Pagamento", "Valor", "Parcelas",
        "Responsável", "CPF Resp.", "Endereço Resp.", "Telefone Resp.",
        "Exumado em", "Trasladado em"
    ]
    ws.append(headers)

    for s in sepultados:
        ws.append([
            s.numero_sepultamento or "",
            s.nome or "",
            s.cpf or "",
            s.get_sexo_display() if s.sexo else "",
            s.data_nascimento.strftime("%d/%m/%Y") if s.data_nascimento else "",
            s.local_nascimento or "",
            s.nacionalidade or "",
            s.cor_pele or "",
            s.get_estado_civil_display() if s.estado_civil else "",
            s.nome_pai or "",
            s.nome_mae or "",
            s.profissao or "",
            s.escolaridade or "",
            s.data_falecimento.strftime("%d/%m/%Y") if s.data_falecimento else "",
            s.hora_falecimento.strftime("%H:%M") if s.hora_falecimento else "",
            s.local_falecimento or "",
            s.causa_morte or "",
            s.medico_responsavel or "",
            s.crm_medico or "",
            s.idade_ao_falecer or "",
            s.cartorio_nome or "",
            s.cartorio_numero_registro or "",
            s.cartorio_livro or "",
            s.cartorio_folha or "",
            s.data_registro_em_cartorio.strftime("%d/%m/%Y") if s.data_registro_em_cartorio else "",
            s.tumulo.identificador if s.tumulo else "",
            s.tumulo.quadra.codigo if s.tumulo and s.tumulo.quadra else "",
            s.tumulo.linha if s.tumulo else "",
            s.data_sepultamento.strftime("%d/%m/%Y") if s.data_sepultamento else "",
            s.observacoes or "",
            s.get_forma_pagamento_display() if s.forma_pagamento else "",
            s.valor_pago or "",
            s.quantidade_parcelas or "",
            s.responsavel_nome or "",
            s.responsavel_cpf or "",
            s.responsavel_endereco or "",
            s.responsavel_telefone or "",
            s.exumado_em.strftime("%d/%m/%Y") if s.exumado_em else "",
            s.trasladado_em.strftime("%d/%m/%Y") if s.trasladado_em else "",
        ])

    # Criar o .zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # Planilha
        xlsx_buffer = io.BytesIO()
        wb.save(xlsx_buffer)
        xlsx_buffer.seek(0)
        zip_file.writestr("sepultados.xlsx", xlsx_buffer.read())

        # Anexos
        for anexo in anexos:
            file_path = anexo.arquivo.path
            if os.path.exists(file_path):
                nome = os.path.basename(file_path)
                pasta = f"{anexo.content_type.model}_{anexo.object_id}"
                zip_file.write(file_path, f"anexos/{pasta}/{nome}")

    zip_buffer.seek(0)
    filename = f"backup_prefeitura_{prefeitura_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return HttpResponse(
        zip_buffer.getvalue(),
        content_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

from django.shortcuts import render

@staff_member_required
def backup_sistema(request):
    return render(request, "admin/backup_sistema.html")
