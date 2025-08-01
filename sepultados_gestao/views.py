import os
from django.conf import settings
from weasyprint import HTML
from django.http import HttpResponse, JsonResponse
from django.template.loader import render_to_string
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth import authenticate
from django.shortcuts import render, redirect, get_object_or_404

from .models import ConcessaoContrato, Prefeitura, Quadra, Cemiterio
from django.contrib.admin.views.decorators import staff_member_required



@login_required
def gerar_contrato_pdf(request, contrato_id):
    if not request.session.get("prefeitura_ativa_id"):
        messages.error(request, "Você precisa selecionar uma prefeitura para gerar contratos.")
        return redirect('sepultados_gestao:selecionar_prefeitura_ativa')

    contrato = get_object_or_404(
        ConcessaoContrato.objects.select_related('prefeitura', 'tumulo__quadra__cemiterio'),
        id=contrato_id
    )

    brasao_path = ''
    if contrato.prefeitura.brasao:
        brasao_absoluto = os.path.join(settings.MEDIA_ROOT, contrato.prefeitura.brasao.name)
        brasao_path = f"file:///{brasao_absoluto.replace(os.sep, '/')}"  # Corrigido para WeasyPrint

    html_string = render_to_string('pdf/contrato.html', {
        'contrato': contrato,
        'brasao_path': brasao_path,
    })

    html = HTML(string=html_string)
    pdf_file = html.write_pdf()

    response = HttpResponse(pdf_file, content_type='application/pdf')
    response['Content-Disposition'] = f'filename=contrato_{contrato.numero_contrato}.pdf'
    return response


@staff_member_required
def selecionar_prefeitura_ativa(request):
    if request.method == "POST":
        prefeitura_id = request.POST.get("prefeitura_id")
        senha = request.POST.get("senha")

        if not prefeitura_id:
            messages.error(request, "Selecione uma prefeitura.")
            return redirect("selecionar_prefeitura_ativa")

        if not senha:
            messages.error(request, "Digite sua senha para confirmar.")
            return redirect("selecionar_prefeitura_ativa")

        user = authenticate(email=request.user.email, password=senha)
        if user is None:
            messages.error(request, "Senha incorreta.")
            return redirect("selecionar_prefeitura_ativa")

        try:
            prefeitura = Prefeitura.objects.get(id=int(prefeitura_id))  # <-- converte para inteiro
            request.session["prefeitura_ativa_id"] = prefeitura.id
            request.session["prefeitura_ativa_nome"] = prefeitura.nome

            # Limpa o cemitério da sessão
            request.session.pop("cemiterio_ativo_id", None)
            request.session.pop("cemiterio_ativo_nome", None)

            messages.success(request, f"Prefeitura ativa: {prefeitura.nome}")
            return redirect("admin:index")
        except Prefeitura.DoesNotExist:
            messages.error(request, "Prefeitura não encontrada.")

    prefeituras = Prefeitura.objects.all()
    return render(request, "admin/selecionar_prefeitura_ativa.html", {"prefeituras": prefeituras})


from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render, redirect
from django.contrib import messages
from .models import Cemiterio


from django.contrib.admin.views.decorators import staff_member_required
from django.contrib import messages
from django.shortcuts import redirect, render
from .models import Cemiterio

@staff_member_required
def selecionar_cemiterio_ativo(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")

    if not prefeitura_id:
        messages.error(request, "Selecione uma prefeitura antes de escolher um cemitério.")
        return redirect("admin:index")

    if request.method == "POST":
        cemiterio_id = request.POST.get("cemiterio_id")

        if not cemiterio_id:
            messages.error(request, "Selecione um cemitério válido.")
            return redirect("selecionar_cemiterio_ativo")

        try:
            cemiterio = Cemiterio.objects.get(id=int(cemiterio_id), prefeitura_id=prefeitura_id)
            request.session["cemiterio_ativo_id"] = cemiterio.id
            request.session["cemiterio_ativo_nome"] = cemiterio.nome
            messages.success(request, f"Cemitério ativo: {cemiterio.nome}")
            return redirect("admin:index")
        except (ValueError, Cemiterio.DoesNotExist):
            messages.error(request, "Cemitério não encontrado.")

    cemiterios = Cemiterio.objects.filter(prefeitura_id=prefeitura_id)
    return render(request, "admin/selecionar_cemiterio_ativo.html", {"cemiterios": cemiterios})



@login_required
def quadras_do_cemiterio(request):
    cemiterio_id = request.GET.get('cemiterio_id')
    quadras = Quadra.objects.filter(cemiterio_id=cemiterio_id).values('id', 'codigo')
    return JsonResponse(list(quadras), safe=False)



# sepultados_gestao/views.py

from django.http import JsonResponse
from .models import Sepultado
from django.contrib.admin.views.decorators import staff_member_required

@staff_member_required
def obter_tumulo_origem(request):
    sepultado_id = request.GET.get("sepultado_id")
    try:
        sepultado = Sepultado.objects.get(id=sepultado_id)
        tumulo = sepultado.tumulo
        descricao = f"{tumulo.referencia} ({tumulo.quadra.cemiterio.nome})"
        return JsonResponse({"tumulo": descricao})
    except:
        return JsonResponse({"tumulo": ""})



from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML
import os
from django.conf import settings
from .models import Exumacao

@staff_member_required
def pdf_exumacao(request, pk):
    exumacao = get_object_or_404(
        Exumacao.objects.select_related(
            'tumulo__quadra__cemiterio'
        ),
        pk=pk
    )

    prefeitura = exumacao.tumulo.quadra.cemiterio.prefeitura
    brasao_path = ''
    if prefeitura and prefeitura.brasao:
        brasao_absoluto = os.path.join(settings.MEDIA_ROOT, prefeitura.brasao.name)
        brasao_path = f"file:///{brasao_absoluto.replace(os.sep, '/')}"

    html = render_to_string("pdf/exumacao.html", {
        "exumacao": exumacao,
        "brasao_path": brasao_path,
    })

    pdf = HTML(string=html).write_pdf()
    return HttpResponse(pdf, content_type='application/pdf')



from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML
from django.conf import settings
import os

from .models import Translado  # usa o novo modelo separado

@staff_member_required
def pdf_translado(request, pk):
    translado = get_object_or_404(
        Translado.objects.select_related(
            'tumulo_destino__quadra__cemiterio'
        ),
        pk=pk
    )

    prefeitura = translado.tumulo_destino.quadra.cemiterio.prefeitura
    brasao_path = ''
    if prefeitura and prefeitura.brasao:
        brasao_absoluto = os.path.join(settings.MEDIA_ROOT, prefeitura.brasao.name)
        brasao_path = f"file:///{brasao_absoluto.replace(os.sep, '/')}"

    html = render_to_string("pdf/translado.html", {
        "movimentacao": translado,
        "brasao_path": brasao_path,
    })

    pdf = HTML(string=html).write_pdf()
    return HttpResponse(pdf, content_type='application/pdf')



from django.template.loader import render_to_string
from django.http import HttpResponse
from weasyprint import HTML
import os
from django.conf import settings
from .models import Sepultado
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import get_object_or_404

@staff_member_required
def gerar_guia_sepultamento_pdf(request, pk):
    sepultado = get_object_or_404(
        Sepultado.objects.select_related(
            'tumulo__quadra__cemiterio__prefeitura'
        ),
        pk=pk
    )

    prefeitura = sepultado.tumulo.quadra.cemiterio.prefeitura

    brasao_path = ""
    if prefeitura and prefeitura.brasao:
        brasao_absoluto = os.path.join(settings.MEDIA_ROOT, prefeitura.brasao.name)
        brasao_path = f"file:///{brasao_absoluto.replace(os.sep, '/')}"

    html = render_to_string("pdf/guia_sepultamento.html", {
        "sepultado": sepultado,
        "brasao_path": brasao_path,
    })

    pdf = HTML(string=html).write_pdf()
    return HttpResponse(pdf, content_type='application/pdf')


from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.http import HttpResponse
from weasyprint import HTML, CSS
from datetime import date
from .models import Receita

def gerar_recibo_pdf(request, receita_id):
    receita = get_object_or_404(Receita, id=receita_id)

    html_string = render_to_string('pdf/recibo_pagamento.html', {
        'receita': receita,
        'hoje': date.today(),
    })

    pdf_file = HTML(string=html_string, base_url=request.build_absolute_uri()).write_pdf(
        stylesheets=[CSS(string='body { font-family: Arial, sans-serif; }')]
    )

    response = HttpResponse(pdf_file, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename=recibo_{receita.numero_documento}.pdf'
    return response


# sepultados_gestao/views.py
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.template.loader import get_template
from weasyprint import HTML
from .models import Tumulo

def gerar_pdf_sepultados_tumulo(request, pk):
    tumulo = get_object_or_404(Tumulo, pk=pk)
    sepultados = tumulo.sepultado_set.all().order_by('data_sepultamento')

    brasao_url = tumulo.quadra.cemiterio.prefeitura.brasao.url if tumulo.quadra.cemiterio.prefeitura.brasao else None

    context = {
        'tumulo': tumulo,
        'sepultados': sepultados,
        'cemiterio': tumulo.quadra.cemiterio,
        'prefeitura': tumulo.quadra.cemiterio.prefeitura,
        'brasao_url': brasao_url,
    }

    template = get_template('pdf/sepultados_tumulo.html')  # ✅ aqui estava o erro
    html_content = template.render(context)
    pdf_file = HTML(string=html_content, base_url=request.build_absolute_uri()).write_pdf()

    response = HttpResponse(pdf_file, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="sepultados_tumulo_{tumulo.identificador}.pdf"'
    return response


from django.contrib import messages
from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from sepultados_gestao.models import Quadra
import pandas as pd

@staff_member_required
def importar_quadras(request):
    if not request.session.get("prefeitura_ativa_id") or not request.session.get("cemiterio_ativo_id"):
        messages.error(request, "Você precisa selecionar uma prefeitura e um cemitério antes de importar.")
        return render(request, "admin/importar_base.html", {
            "title": "Importar Quadras",
            "form_content": "",
        })

    total = 0
    if request.method == "POST" and request.FILES.get("arquivo"):
        arquivo = request.FILES["arquivo"]
        extensao = arquivo.name.split(".")[-1].lower()

        try:
            if extensao == "csv":
                df = pd.read_csv(arquivo)
            elif extensao in ["xls", "xlsx"]:
                df = pd.read_excel(arquivo)
            else:
                messages.error(request, "Formato de arquivo não suportado.")
                return render(request, "admin/importar_base.html", {
                    "title": "Importar Quadras",
                    "form_content": "",
                })
        except Exception as e:
            messages.error(request, f"Erro ao ler o arquivo: {str(e)}")
            return render(request, "admin/importar_base.html", {
                "title": "Importar Quadras",
                "form_content": "",
            })

        for _, linha in df.iterrows():
            try:
                codigo = str(linha[0]).strip()
                if not codigo:
                    continue

                Quadra.objects.create(
                    codigo=codigo,
                    cemiterio_id=request.session["cemiterio_ativo_id"]
                )
                total += 1
            except Exception as e:
                print(f"[DEBUG] Erro ao importar linha: {linha}\nMotivo: {e}")
                continue

        messages.success(request, f"{total} quadra(s) importada(s) com sucesso.")

    return render(request, "admin/importar_base.html", {
        "titulo_pagina": "Importar Quadras",
        "link_planilha": "/media/planilhas/Planilha de Quadras.xlsx"
    })


import pandas as pd
from django.contrib import messages
from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from sepultados_gestao.models import Tumulo, Quadra


@staff_member_required
def importar_tumulos(request):
    if not request.session.get("prefeitura_ativa_id") or not request.session.get("cemiterio_ativo_id"):
        messages.error(request, "Você precisa selecionar uma prefeitura e um cemitério antes de importar.")
        return render(request, "admin/importar_base.html", {
            "title": "Importar Túmulos",
            "long_content": "",
        })

    total = 0

    if request.method == "POST" and request.FILES.get("arquivo"):
        arquivo = request.FILES["arquivo"]
        extensao = arquivo.name.split(".")[-1].lower()

        try:
            if extensao == "csv":
                df = pd.read_csv(arquivo)
            elif extensao in ["xls", "xlsx"]:
                df = pd.read_excel(arquivo)
            else:
                messages.error(request, "Formato de arquivo não suportado.")
                return render(request, "admin/importar_base.html", {
                    "title": "Importar Túmulos",
                    "long_content": "",
                })
        except Exception as e:
            messages.error(request, f"Erro ao ler o arquivo: {str(e)}")
            return render(request, "admin/importar_base.html", {
                "title": "Importar Túmulos",
                "long_content": "",
            })

        print(f"[DEBUG] Sessão atual: prefeitura_id={request.session.get('prefeitura_ativa_id')} | cemitério_id={request.session.get('cemiterio_ativo_id')}")

        MAPA_TIPO_ESTRUTURA = {
            'túmulo': 'tumulo',
            'perpétua': 'perpetua',
            'sepultura': 'sepultura',
            'jazigo': 'jazigo',
            'outro': 'outro',
        }

        for _, linha in df.iterrows():
            try:
                quadra_codigo = str(linha["quadra_codigo"]).strip()
                identificador = str(linha["identificador"]).strip()

                tipo_raw = str(linha["tipo_estrutura"]).strip().lower()
                tipo_estrutura = MAPA_TIPO_ESTRUTURA.get(tipo_raw, 'tumulo')

                capacidade = int(float(linha["capacidade"])) if pd.notna(linha["capacidade"]) else 1
                usar_linha = str(linha["usar_linha"]).strip().lower() == "sim" if pd.notna(linha["usar_linha"]) else False
                linha_valor = int(linha["linha"]) if usar_linha and pd.notna(linha["linha"]) else None

                print(f"[DEBUG] Buscando quadra: '{quadra_codigo}' no cemitério ID {request.session['cemiterio_ativo_id']}")

                quadra_id = Quadra.objects.filter(
                    codigo__iexact=quadra_codigo,
                    cemiterio_id=request.session["cemiterio_ativo_id"]
                ).values_list("id", flat=True).first()

                if not quadra_id:
                    print(f"❌ Quadra não encontrada: '{quadra_codigo}'")
                    continue

                print(f"✅ Quadra encontrada com ID: {quadra_id}")

                Tumulo.objects.create(
                    quadra_id=quadra_id,
                    cemiterio_id=request.session["cemiterio_ativo_id"],
                    identificador=identificador,
                    tipo_estrutura=tipo_estrutura,
                    capacidade=capacidade,
                    usar_linha=usar_linha,
                    linha=linha_valor,
                    reservado=False,
                    status="disponivel",
                )
                total += 1

            except Exception as e:
                print(f"❌ Erro ao importar túmulo da linha: {linha}\nMotivo: {e}")
                continue


        messages.success(request, f"{total} túmulo(s) importado(s) com sucesso.")

    return render(request, "admin/importar_base.html", {
        "titulo_pagina": "Importar Túmulos",
        "link_planilha": "/media/planilhas/Planilha de Tumulos.xlsx"
    })



from django.contrib import messages
from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from sepultados_gestao.models import Sepultado, Tumulo, Quadra
import pandas as pd

@staff_member_required
def importar_sepultados(request):
    if not request.session.get("prefeitura_ativa_id") or not request.session.get("cemiterio_ativo_id"):
        messages.error(request, "Você precisa selecionar uma prefeitura e um cemitério antes de importar.")
        return render(request, "admin/importar_base.html", {
            "title": "Importar Sepultados",
            "form_content": "",
        })

    total = 0
    erros = []

    if request.method == "POST" and request.FILES.get("arquivo"):
        try:
            planilha = request.FILES["arquivo"]
            df = pd.read_excel(planilha)

            for i, row in df.iterrows():
                try:
                    identificador_tumulo = str(row.get("identificador_tumulo")).strip()
                    nome_quadra = str(row.get("quadra")).strip()
                    usar_linha = str(row.get("usar_linha", "")).strip().lower()
                    linha = row.get("linha")

                    quadra = Quadra.objects.filter(
                        codigo=nome_quadra,
                        cemiterio_id=request.session["cemiterio_ativo_id"]
                    ).first()

                    if not quadra:
                        erros.append(f"Linha {i+2}: Quadra '{nome_quadra}' não encontrada.")
                        continue

                    tumulo = Tumulo.objects.filter(
                        identificador=identificador_tumulo,
                        quadra=quadra
                    ).first()

                    if not tumulo:
                        erros.append(f"Linha {i+2}: Túmulo '{identificador_tumulo}' não encontrado na quadra '{nome_quadra}'.")
                        continue

                    # Atualiza os campos usar_linha e linha se fornecidos
                    if usar_linha in ["sim", "s", "true", "1"]:
                        tumulo.usar_linha = True
                    elif usar_linha in ["não", "nao", "n", "false", "0"]:
                        tumulo.usar_linha = False

                    if linha and not pd.isna(linha):
                        try:
                            tumulo.linha = int(linha)
                        except ValueError:
                            erros.append(f"Linha {i+2}: valor inválido para linha: {linha}")

                    tumulo.save()

                    sep = Sepultado(
                        nome=row.get("nome") or "",
                        cpf_sepultado=row.get("cpf_sepultado"),
                        data_nascimento=row.get("data_nascimento"),
                        sexo=row.get("sexo") or "NI",
                        local_nascimento=row.get("local_nascimento"),
                        local_falecimento=row.get("local_falecimento"),
                        data_falecimento=row.get("data_falecimento"),
                        data_sepultamento=row.get("data_sepultamento"),
                        nome_pai=row.get("nome_pai"),
                        nome_mae=row.get("nome_mae"),
                        tumulo=tumulo,
                        importado=True
                    )
                    sep.save(ignorar_validacao_contrato=True)
                    total += 1

                except Exception as e:
                    erros.append(f"Linha {i+2}: Erro ao importar - {str(e)}")

            if total:
                messages.success(request, f"{total} sepultado(s) importado(s) com sucesso.")
            if erros:
                for erro in erros:
                    messages.warning(request, erro)

        except Exception as e:
            messages.error(request, f"Erro ao processar a planilha: {str(e)}")

    return render(request, "admin/importar_base.html", {
        "title": "Importar Sepultados",
        "titulo_pagina": "Importar Sepultados",
        "mostrar_formulario": True,
        "link_planilha": "/media/planilhas/Planilha de Sepultados.xlsx"
    })

