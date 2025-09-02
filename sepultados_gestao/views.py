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


from django.contrib import messages
from django.contrib.auth import authenticate
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render, redirect
from sepultados_gestao.models import Prefeitura

@staff_member_required
def selecionar_prefeitura_ativa(request):
    # por padrão, só prefeituras ativas
    qs = Prefeitura.objects.filter(situacao="ativo").order_by("nome")

    # opcional: superusuário pode ver todas com ?todas=1
    if request.user.is_superuser and request.GET.get("todas") == "1":
        qs = Prefeitura.objects.all().order_by("nome")

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
            # importante: buscar a partir do queryset filtrado
            prefeitura = qs.get(id=int(prefeitura_id))

            request.session["prefeitura_ativa_id"] = prefeitura.id
            request.session["prefeitura_ativa_nome"] = prefeitura.nome
            # limpa cemitério ativo
            request.session.pop("cemiterio_ativo_id", None)
            request.session.pop("cemiterio_ativo_nome", None)

            messages.success(request, f"Prefeitura ativa: {prefeitura.nome}")
            return redirect("admin:index")
        except Prefeitura.DoesNotExist:
            messages.error(request, "Prefeitura inválida ou não permitida.")

    return render(
        request,
        "admin/selecionar_prefeitura_ativa.html",
        {"prefeituras": qs},
    )



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



# views.py
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML
from django.conf import settings
import os
from .models import Translado

@staff_member_required
def pdf_translado(request, pk):
    translado = get_object_or_404(
        Translado.objects.select_related(
            "sepultado__tumulo__quadra__cemiterio__prefeitura",
            "tumulo_destino__quadra__cemiterio__prefeitura",
        ),
        pk=pk,
    )

    # usa a prefeitura do destino se existir; senão, a do túmulo de origem do sepultado
    prefeitura = (
        getattr(getattr(getattr(translado, "tumulo_destino", None), "quadra", None), "cemiterio", None)
            and translado.tumulo_destino.quadra.cemiterio.prefeitura
    ) or translado.sepultado.tumulo.quadra.cemiterio.prefeitura

    brasao_path = ""
    if prefeitura and getattr(prefeitura, "brasao", None):
        brasao_absoluto = os.path.join(settings.MEDIA_ROOT, prefeitura.brasao.name)
        brasao_path = f"file:///{brasao_absoluto.replace(os.sep, '/')}"

    html = render_to_string("pdf/translado.html", {
        "movimentacao": translado,  # seu template usa 'movimentacao'
        "brasao_path": brasao_path,
    })
    pdf = HTML(string=html).write_pdf()
    return HttpResponse(pdf, content_type="application/pdf")



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


# helpers e view para importar quadras
import json
import re
import pandas as pd
from django.db import transaction
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib import messages
from django.shortcuts import render
from sepultados_gestao.models import Quadra

# regex de número float
FLOAT_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")
# regex para pares "lat,lng" (com vírgula entre lat e lng; aceita espaços ao redor)
PAIR_RE = re.compile(r'([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)')

# nomes de colunas possíveis para polígono
POLY_COLUMNS = ("poligono_mapa", "limites", "polygon", "wkt", "latlng", "lat_lng")


def _parse_pairs(s: str):
    """
    Encontra TODOS os pares 'lat,lng' na string (ex.: '-23.43,-51.92 -23.44,-51.93').
    Funciona mesmo com quebras de linha; ignora qualquer coisa que não for 'lat,lng'.
    """
    pts = []
    for lat_s, lng_s in PAIR_RE.findall(s or ""):
        lat = float(lat_s)
        lng = float(lng_s)
        pts.append({"lat": lat, "lng": lng})
    return pts


def _parse_wkt(s: str):
    """
    POLYGON ((lng lat, lng lat, ...)) -> [{'lat':..., 'lng':...}, ...]
    """
    inside = s.strip()
    if inside.upper().startswith("POLYGON"):
        inside = inside[inside.find("((") + 2 : inside.rfind("))")]
    pairs = [p.strip() for p in inside.split(",") if p.strip()]
    pts = []
    for p in pairs:
        nums = FLOAT_RE.findall(p)
        if len(nums) >= 2:
            lng = float(nums[0])
            lat = float(nums[1])
            pts.append({"lat": lat, "lng": lng})
    return pts


def parse_polygon_cell(cell):
    """
    Aceita:
      - lista de dicts [{'lat':..,'lng':..}]
      - lista de listas [[lat,lng], ...]
      - JSON str (qualquer dos formatos acima)
      - WKT POLYGON
      - texto com pares 'lat,lng' (separados por espaço/linha)
    """
    if cell is None or (isinstance(cell, float) and pd.isna(cell)):
        return []

    # já é lista
    if isinstance(cell, list):
        if cell and isinstance(cell[0], dict) and "lat" in cell[0] and "lng" in cell[0]:
            return [{"lat": float(p["lat"]), "lng": float(p["lng"])} for p in cell]
        if cell and isinstance(cell[0], (list, tuple)) and len(cell[0]) >= 2:
            return [{"lat": float(p[0]), "lng": float(p[1])} for p in cell]

    # string
    s = str(cell).strip()
    if not s:
        return []

    # JSON
    if s.startswith("[") or s.startswith("{"):
        try:
            j = json.loads(s)
            return parse_polygon_cell(j)
        except Exception:
            pass

    # WKT
    if s.upper().startswith("POLYGON"):
        try:
            return _parse_wkt(s)
        except Exception:
            pass

    # pares "lat,lng" (com espaço entre pares)
    return _parse_pairs(s)


def read_df(uploaded_file):
    name = uploaded_file.name.lower()
    if name.endswith(".csv"):
        df = pd.read_csv(uploaded_file)
    elif name.endswith(".xls") or name.endswith(".xlsx"):
        df = pd.read_excel(uploaded_file)
    else:
        raise ValueError("Formato de arquivo não suportado. Use CSV/XLS/XLSX.")
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def _coerce_angle(v):
    """Converte ângulo para float (0..360) se possível; senão None."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        ang = float(v)
    except (TypeError, ValueError):
        return None
    # opcional: clamp 0..360
    while ang < 0:
        ang += 360.0
    while ang >= 360.0:
        ang -= 360.0
    return ang


def process_quadras_df(df, cemiterio_id: int):
    total, atualizados, erros = 0, 0, []
    for idx, row in df.iterrows():
        try:
            codigo = str(row.get("codigo") or "").strip()
            if not codigo:
                continue

            # coluna do polígono
            pol_cell = None
            for k in POLY_COLUMNS:
                if k in df.columns:
                    pol_cell = row.get(k)
                    if pol_cell is not None and not (isinstance(pol_cell, float) and pd.isna(pol_cell)):
                        break

            poligono = parse_polygon_cell(pol_cell) if pol_cell is not None else []

            # grid/ângulo
            grid = {}

            # aceita 'angulo' OU 'grid_angulo'
            ang = None
            if "angulo" in df.columns:
                ang = _coerce_angle(row.get("angulo"))
            if ang is None and "grid_angulo" in df.columns:
                ang = _coerce_angle(row.get("grid_angulo"))
            if ang is not None:
                grid["angulo"] = ang

            # se você usar cols/rows no futuro
            if "grid_cols" in df.columns and pd.notna(row.get("grid_cols")):
                try:
                    grid["cols"] = int(float(row.get("grid_cols")))
                except Exception:
                    pass
            if "grid_rows" in df.columns and pd.notna(row.get("grid_rows")):
                try:
                    grid["rows"] = int(float(row.get("grid_rows")))
                except Exception:
                    pass

            defaults = {}
            if poligono:
                defaults["poligono_mapa"] = poligono
            if grid:
                defaults["grid_params"] = grid

            with transaction.atomic():
                obj, created = Quadra.objects.update_or_create(
                    cemiterio_id=cemiterio_id,
                    codigo=codigo,
                    defaults=defaults or {},
                )

            total += 1
            if not created and defaults:
                atualizados += 1

        except Exception as e:
            erros.append(f"Linha {idx + 2}: {e}")

    return total, atualizados, erros


@staff_member_required
def importar_quadras(request):
    cem_id = request.session.get("cemiterio_ativo_id")
    if not request.session.get("prefeitura_ativa_id") or not cem_id:
        messages.error(request, "Selecione prefeitura e cemitério antes de importar.")
        return render(
            request,
            "admin/importar_base.html",
            {
                "titulo_pagina": "Importar Quadras",
                "link_planilha": "/media/planilhas/Planilha de Quadras.xlsx",
            },
        )

    if request.method == "POST" and request.FILES.get("arquivo"):
        try:
            df = read_df(request.FILES["arquivo"])
            total, atualizados, erros = process_quadras_df(df, int(cem_id))
            if erros:
                messages.warning(request, f"Importação concluída com avisos. {len(erros)} linha(s) com erro.")
            messages.success(request, f"{total} quadra(s) importada(s). {atualizados} atualizada(s).")
            return render(
                request,
                "admin/importar_base.html",
                {
                    "titulo_pagina": "Importar Quadras",
                    "link_planilha": "/media/planilhas/Planilha de Quadras.xlsx",
                    "mensagens_extra": erros,
                },
            )
        except Exception as e:
            messages.error(request, f"Erro ao importar: {e}")

    return render(
        request,
        "admin/importar_base.html",
        {
            "titulo_pagina": "Importar Quadras",
            "link_planilha": "/media/planilhas/Planilha de Quadras.xlsx",
        },
    )


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



