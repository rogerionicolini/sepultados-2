# relatorios/views.py
from datetime import datetime, date
from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse

from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Q
from django.http import HttpResponse, HttpResponseBadRequest
from django.shortcuts import render
from django.template.loader import render_to_string
from django.utils.dateparse import parse_date

from weasyprint import HTML

from sepultados_gestao.models import (
    Sepultado, Exumacao, Translado, ConcessaoContrato,
    Receita, Tumulo, Prefeitura, Cemiterio
)

# =============================================================================
# Helpers STATeless (funcionam com frontend sem sessão do admin)
# =============================================================================
def _get_prefeitura_id(request):
    """
    Ordem de resolução:
    1) Querystring: ?prefeitura_id= ou ?prefeitura=
    2) Headers: X-Prefeitura-Id
    3) Sessão (fallback admin): request.session['prefeitura_ativa_id']
    """
    pref_id = (
        request.GET.get("prefeitura_id")
        or request.GET.get("prefeitura")
        or request.headers.get("X-Prefeitura-Id")
        or request.session.get("prefeitura_ativa_id")
    )
    return pref_id


# no topo já existe: from sepultados_gestao.models import Prefeitura, Cemiterio

def _get_cemiterio_id(request):
    """
    Ordem de resolução:
    1) Querystring: ?cemiterio_id= ou ?cemiterio=
    2) Headers: X-Cemiterio-Id
    3) Sessão (fallback admin): request.session['cemiterio_ativo_id']
    """
    cem_id = (
        request.GET.get("cemiterio_id")
        or request.GET.get("cemiterio")          # alias aceito
        or request.headers.get("X-Cemiterio-Id")
        or request.session.get("cemiterio_ativo_id")
    )
    return cem_id


def _get_prefeitura_id(request):
    """
    Ordem de resolução:
    1) Querystring: ?prefeitura_id= ou ?prefeitura=
    2) Headers: X-Prefeitura-Id
    3) Sessão (fallback admin): request.session['prefeitura_ativa_id']
    4) Derivação pelo cemitério (se só veio cemiterio[_id])
    5) request.prefeitura_ativa (admin), se existir
    """
    pref_id = (
        request.GET.get("prefeitura_id")
        or request.GET.get("prefeitura")
        or request.headers.get("X-Prefeitura-Id")
        or request.session.get("prefeitura_ativa_id")
    )

    if not pref_id:
        cem_id = _get_cemiterio_id(request)
        if cem_id:
            pref_id = (
                Cemiterio.objects
                .filter(id=cem_id)
                .values_list("prefeitura_id", flat=True)
                .first()
            )

    if not pref_id:
        pref_obj = getattr(request, "prefeitura_ativa", None)
        if pref_obj:
            pref_id = getattr(pref_obj, "id", None)

    return pref_id




def _build_brasao_url(request, prefeitura):
    if prefeitura and getattr(prefeitura, "brasao", None):
        try:
            return request.build_absolute_uri(prefeitura.brasao.url)
        except Exception:
            return None
    return None


# =============================================================================
# RELATÓRIO DE SEPULTADOS (HTML - admin)  |  PDF (stateless)
# =============================================================================
@staff_member_required
def relatorio_sepultados(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    sepultados = Sepultado.objects.filter(
        tumulo__quadra__cemiterio_id=cemiterio_id
    )

    status = request.GET.get("status")
    if status == "sepultado":
        sepultados = sepultados.filter(exumado=False, trasladado=False)
    elif status == "exumado":
        sepultados = sepultados.filter(exumado=True)
    elif status == "trasladado":
        sepultados = sepultados.filter(trasladado=True)

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")
    if data_inicio and data_fim:
        try:
            dt_ini = datetime.strptime(data_inicio, "%Y-%m-%d").date()
            dt_fim = datetime.strptime(data_fim, "%Y-%m-%d").date()
            sepultados = sepultados.filter(data_sepultamento__range=(dt_ini, dt_fim))
        except ValueError:
            pass

    context = {
        "sepultados": sepultados,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "status": status,
    }
    return render(request, "relatorios/relatorio_sepultados.html", context)


def relatorio_sepultados_pdf(request):
    pref_id = _get_prefeitura_id(request)
    cem_id = _get_cemiterio_id(request)

    if not pref_id:
        return HttpResponseBadRequest("Informe prefeitura_id (querystring ou header X-Prefeitura-Id).")

    prefeitura = Prefeitura.objects.filter(id=pref_id).first()
    cemiterio = Cemiterio.objects.filter(id=cem_id).first() if cem_id else None

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")
    status_val = request.GET.get("status")

    sepultados = Sepultado.objects.filter(
        tumulo__quadra__cemiterio__prefeitura_id=pref_id
    )
    if cem_id:
        sepultados = sepultados.filter(tumulo__quadra__cemiterio_id=cem_id)

    # Filtros por data de sepultamento
    if data_inicio:
        try:
            dt_ini = datetime.strptime(data_inicio, "%Y-%m-%d").date()
            sepultados = sepultados.filter(data_sepultamento__gte=dt_ini)
        except (ValueError, TypeError):
            data_inicio = None
    if data_fim:
        try:
            dt_fim = datetime.strptime(data_fim, "%Y-%m-%d").date()
            sepultados = sepultados.filter(data_sepultamento__lte=dt_fim)
        except (ValueError, TypeError):
            data_fim = None

    # Status
    if status_val:
        s = status_val.lower()
        if s == "exumado":
            sepultados = sepultados.filter(exumado=True)
        elif s in ("transladado", "trasladado"):  # tolera ambas grafias
            sepultados = sepultados.filter(trasladado=True)
        elif s == "sepultado":
            sepultados = sepultados.filter(exumado=False, trasladado=False)

    brasao_url = _build_brasao_url(request, prefeitura)

    html_string = render_to_string("pdf/relatorio_sepultados_pdf.html", {
        "sepultados": sepultados.select_related(
            "tumulo", "tumulo__quadra", "tumulo__quadra__cemiterio"
        ),
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "status": status_val,
        "brasao_url": brasao_url,
    })

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="relatorio_sepultados.pdf"'
    HTML(string=html_string, base_url=request.build_absolute_uri("/")).write_pdf(response)
    return response


# =============================================================================
# RELATÓRIO DE EXUMAÇÕES
# =============================================================================
@staff_member_required
def relatorio_exumacoes(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    exumacoes = Exumacao.objects.filter(tumulo__quadra__cemiterio_id=cemiterio_id)

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    if data_inicio and data_fim:
        try:
            dt_ini = datetime.strptime(data_inicio, "%Y-%m-%d").date()
            dt_fim = datetime.strptime(data_fim, "%Y-%m-%d").date()
            exumacoes = exumacoes.filter(data__range=(dt_ini, dt_fim))
        except ValueError:
            pass

    context = {
        "exumacoes": exumacoes,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }
    return render(request, "relatorios/relatorio_exumacoes.html", context)


def relatorio_exumacoes_pdf(request):
    pref_id = _get_prefeitura_id(request)
    cem_id = _get_cemiterio_id(request)
    if not pref_id:
        return HttpResponseBadRequest("Informe prefeitura_id (querystring ou header X-Prefeitura-Id).")

    prefeitura = Prefeitura.objects.filter(id=pref_id).first()
    cemiterio = Cemiterio.objects.filter(id=cem_id).first() if cem_id else None

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    exumacoes = Exumacao.objects.filter(
        tumulo__quadra__cemiterio__prefeitura_id=pref_id
    )
    if cem_id:
        exumacoes = exumacoes.filter(tumulo__quadra__cemiterio_id=cem_id)

    if data_inicio:
        try:
            dt_ini = datetime.strptime(data_inicio, "%Y-%m-%d").date()
            exumacoes = exumacoes.filter(data__gte=dt_ini)
        except (ValueError, TypeError):
            data_inicio = None
    if data_fim:
        try:
            dt_fim = datetime.strptime(data_fim, "%Y-%m-%d").date()
            exumacoes = exumacoes.filter(data__lte=dt_fim)
        except (ValueError, TypeError):
            data_fim = None

    brasao_url = _build_brasao_url(request, prefeitura)

    html_string = render_to_string("pdf/relatorio_exumacoes_pdf.html", {
        "exumacoes": exumacoes.select_related(
            "tumulo", "tumulo__quadra", "tumulo__quadra__cemiterio"
        ),
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "brasao_url": brasao_url,
    })
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="relatorio_exumacoes.pdf"'
    HTML(string=html_string, base_url=request.build_absolute_uri("/")).write_pdf(response)
    return response


# =============================================================================
# RELATÓRIO DE TRANSLADOS
# =============================================================================
@staff_member_required
def relatorio_translados(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    translados = Translado.objects.filter(
        sepultado__tumulo__quadra__cemiterio__id=cemiterio_id,
        sepultado__tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id
    )

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    if data_inicio and data_fim:
        try:
            dt_ini = parse_date(data_inicio)
            dt_fim = parse_date(data_fim)
            translados = translados.filter(data__range=(dt_ini, dt_fim))
        except (ValueError, TypeError):
            dt_ini = dt_fim = None

    context = {
        "translados": translados,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }
    return render(request, "relatorios/relatorio_translados.html", context)


def relatorio_translados_pdf(request):
    pref_id = _get_prefeitura_id(request)
    cem_id = _get_cemiterio_id(request)
    if not pref_id:
        return HttpResponseBadRequest("Informe prefeitura_id (querystring ou header X-Prefeitura-Id).")

    prefeitura = Prefeitura.objects.filter(id=pref_id).first()
    cemiterio = Cemiterio.objects.filter(id=cem_id).first() if cem_id else None

    translados = Translado.objects.filter(
        sepultado__tumulo__quadra__cemiterio__prefeitura_id=pref_id
    )
    if cem_id:
        translados = translados.filter(sepultado__tumulo__quadra__cemiterio_id=cem_id)

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    if data_inicio and data_fim:
        try:
            dt_ini = parse_date(data_inicio)
            dt_fim = parse_date(data_fim)
            # campo de data pode variar; preservo o seu uso anterior:
            translados = translados.filter(data_translado__range=(dt_ini, dt_fim))
        except Exception:
            pass

    brasao_url = _build_brasao_url(request, prefeitura)

    context = {
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "translados": translados.select_related(
            "sepultado", "sepultado__tumulo", "sepultado__tumulo__quadra",
            "sepultado__tumulo__quadra__cemiterio"
        ),
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "brasao_url": brasao_url,
    }

    html_string = render_to_string("pdf/relatorio_translados_pdf.html", context)
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="relatorio_translados.pdf"'
    HTML(string=html_string, base_url=request.build_absolute_uri("/")).write_pdf(response)
    return response


# =============================================================================
# RELATÓRIO DE CONTRATOS
# =============================================================================
@staff_member_required
def relatorio_contratos(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    contratos = ConcessaoContrato.objects.filter(
        tumulo__quadra__cemiterio_id=cemiterio_id,
        tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id
    )

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    if data_inicio and data_fim:
        try:
            dt_ini = parse_date(data_inicio)
            dt_fim = parse_date(data_fim)
            contratos = contratos.filter(data_contrato__range=(dt_ini, dt_fim))
        except Exception:
            pass

    context = {
        "contratos": contratos,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }
    return render(request, "relatorios/relatorio_contratos.html", context)


def relatorio_contratos_pdf(request):
    pref_id = _get_prefeitura_id(request)
    cem_id = _get_cemiterio_id(request)
    if not pref_id:
        return HttpResponseBadRequest("Informe prefeitura_id (querystring ou header X-Prefeitura-Id).")

    prefeitura = Prefeitura.objects.filter(id=pref_id).first()
    cemiterio = Cemiterio.objects.filter(id=cem_id).first() if cem_id else None

    contratos = ConcessaoContrato.objects.filter(
        tumulo__quadra__cemiterio__prefeitura_id=pref_id
    )
    if cem_id:
        contratos = contratos.filter(tumulo__quadra__cemiterio_id=cem_id)

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    dt_ini = parse_date(data_inicio) if data_inicio and data_inicio != "None" else None
    dt_fim = parse_date(data_fim) if data_fim and data_fim != "None" else None

    if dt_ini and dt_fim:
        contratos = contratos.filter(data_contrato__range=(dt_ini, dt_fim))

    brasao_url = _build_brasao_url(request, prefeitura)

    context = {
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "contratos": contratos.select_related(
            "tumulo", "tumulo__quadra", "tumulo__quadra__cemiterio"
        ),
        "data_inicio": dt_ini,
        "data_fim": dt_fim,
        "brasao_url": brasao_url,
    }

    html_string = render_to_string("pdf/relatorio_contratos_pdf.html", context)
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="relatorio_contratos.pdf"'
    HTML(string=html_string, base_url=request.build_absolute_uri("/")).write_pdf(response)
    return response


# =============================================================================
# RELATÓRIO DE RECEITAS
# =============================================================================
@staff_member_required
def relatorio_receitas(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    receitas = Receita.objects.filter(prefeitura_id=prefeitura_id)

    if cemiterio_id:
        receitas = receitas.filter(
            Q(contrato__tumulo__quadra__cemiterio_id=cemiterio_id) |
            Q(sepultado__tumulo__quadra__cemiterio_id=cemiterio_id) |
            Q(exumacao__tumulo__quadra__cemiterio_id=cemiterio_id) |
            Q(translado__tumulo_destino__quadra__cemiterio_id=cemiterio_id) |
            Q(contrato__isnull=True, sepultado__isnull=True, exumacao__isnull=True, translado__isnull=True)
        ).distinct()

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    if data_inicio:
        try:
            dt_ini = parse_date(data_inicio)
            receitas = receitas.filter(data_vencimento__gte=dt_ini)
        except Exception:
            pass

    if data_fim:
        try:
            dt_fim = parse_date(data_fim)
            receitas = receitas.filter(data_vencimento__lte=dt_fim)
        except Exception:
            pass

    context = {
        "receitas": receitas,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }
    return render(request, "relatorios/relatorio_receitas.html", context)


def relatorio_receitas_pdf(request):
    pref_id = _get_prefeitura_id(request)
    cem_id = _get_cemiterio_id(request)
    if not pref_id:
        return HttpResponseBadRequest("Informe prefeitura_id (querystring ou header X-Prefeitura-Id).")

    prefeitura = Prefeitura.objects.filter(id=pref_id).first()
    cemiterio = Cemiterio.objects.filter(id=cem_id).first() if cem_id else None

    receitas = Receita.objects.filter(prefeitura_id=pref_id)

    if cem_id:
        receitas = receitas.filter(
            Q(contrato__tumulo__quadra__cemiterio_id=cem_id) |
            Q(sepultado__tumulo__quadra__cemiterio_id=cem_id) |
            Q(exumacao__tumulo__quadra__cemiterio_id=cem_id) |
            Q(translado__tumulo_destino__quadra__cemiterio_id=cem_id) |
            Q(contrato__isnull=True, sepultado__isnull=True, exumacao__isnull=True, translado__isnull=True)
        ).distinct()

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    if data_inicio:
        try:
            dt_ini = parse_date(data_inicio)
            receitas = receitas.filter(data_vencimento__gte=dt_ini)
        except Exception:
            pass

    if data_fim:
        try:
            dt_fim = parse_date(data_fim)
            receitas = receitas.filter(data_vencimento__lte=dt_fim)
        except Exception:
            pass

    brasao_url = _build_brasao_url(request, prefeitura)

    context = {
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "receitas": receitas.select_related(
            "contrato", "sepultado", "exumacao", "translado"
        ),
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "brasao_url": brasao_url,
    }

    html_string = render_to_string("pdf/relatorio_receitas_pdf.html", context)
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="relatorio_receitas.pdf"'
    HTML(string=html_string, base_url=request.build_absolute_uri("/")).write_pdf(response)
    return response


# =============================================================================
# RELATÓRIO DE TÚMULOS
# =============================================================================
@staff_member_required
def relatorio_tumulos(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    tumulos = Tumulo.objects.filter(cemiterio_id=cemiterio_id)

    status_filtro = request.GET.get("status")
    tipo_filtro = request.GET.get("tipo")

    if status_filtro:
        tumulos = tumulos.filter(status=status_filtro)
    if tipo_filtro:
        tumulos = tumulos.filter(tipo_estrutura=tipo_filtro)

    contratos = ConcessaoContrato.objects.filter(tumulo__in=tumulos)
    tumulo_contrato = {c.tumulo_id: c for c in contratos}

    context = {
        "tumulos": tumulos,
        "status_filtro": status_filtro,
        "tipo_filtro": tipo_filtro,
        "tumulo_contrato": tumulo_contrato,
    }
    return render(request, "relatorios/relatorio_tumulos.html", context)


def relatorio_tumulos_pdf(request):
    pref_id = _get_prefeitura_id(request)
    cem_id = _get_cemiterio_id(request)
    if not pref_id:
        return HttpResponseBadRequest("Informe prefeitura_id (querystring ou header X-Prefeitura-Id).")

    prefeitura = Prefeitura.objects.filter(id=pref_id).first()
    cemiterio = Cemiterio.objects.filter(id=cem_id).first() if cem_id else None

    tumulos = Tumulo.objects.filter(
        cemiterio_id=cem_id if cem_id else None
    ).prefetch_related("sepultado_set")

    status_filtro = request.GET.get("status")
    tipo_filtro = request.GET.get("tipo")

    if not status_filtro or status_filtro in ["None", "Todos", ""]:
        status_filtro = None
    if not tipo_filtro or tipo_filtro in ["None", "Todos", ""]:
        tipo_filtro = None

    if status_filtro:
        if status_filtro == "Reservado":
            tumulos = tumulos.filter(reservado=True)
        elif status_filtro == "Livre":
            tumulos = tumulos.filter(reservado=False)

    if tipo_filtro:
        tumulos = tumulos.filter(tipo_estrutura=tipo_filtro)

    contratos = ConcessaoContrato.objects.filter(tumulo__in=tumulos)
    tumulo_contrato = {c.tumulo_id: c for c in contratos}

    brasao_url = _build_brasao_url(request, prefeitura)

    context = {
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "tumulos": tumulos,
        "status_filtro": status_filtro or "Todos",
        "tipo_filtro": tipo_filtro or "Todos",
        "tumulo_contrato": tumulo_contrato,
        "brasao_url": brasao_url,
        "hoje": date.today(),
    }

    html_string = render_to_string("pdf/relatorio_tumulos_pdf.html", context)
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="relatorio_tumulos.pdf"'
    HTML(string=html_string, base_url=request.build_absolute_uri("/")).write_pdf(response)
    return response
