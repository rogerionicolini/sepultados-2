from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from sepultados_gestao.models import Sepultado
from sepultados_gestao.utils import render_to_pdf
from datetime import datetime




@staff_member_required
def relatorio_sepultados(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    sepultados = Sepultado.objects.filter(tumulo__quadra__cemiterio_id=cemiterio_id)

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
            pass  # ignora erro de data inválida

    context = {
        "sepultados": sepultados,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "status": status,
    }
    return render(request, "relatorios/relatorio_sepultados.html", context)


from django.shortcuts import render
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML


def relatorio_sepultados_pdf(request):
    prefeitura = request.prefeitura_ativa
    cemiterio = request.cemiterio_ativo

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")
    status = request.GET.get("status")

    sepultados = Sepultado.objects.filter(
        tumulo__cemiterio__prefeitura=prefeitura,
        tumulo__cemiterio=cemiterio
    )

    # Filtros por data
    try:
        if data_inicio:
            data_inicio_formatada = datetime.strptime(data_inicio, "%Y-%m-%d").date()
            sepultados = sepultados.filter(data_sepultamento__gte=data_inicio_formatada)
    except (ValueError, TypeError):
        data_inicio = None

    try:
        if data_fim:
            data_fim_formatada = datetime.strptime(data_fim, "%Y-%m-%d").date()
            sepultados = sepultados.filter(data_sepultamento__lte=data_fim_formatada)
    except (ValueError, TypeError):
        data_fim = None

    # Filtro por status calculado
    if status:
        status = status.lower()
        if status == "exumado":
            sepultados = sepultados.filter(data_exumacao__isnull=False, data_translado__isnull=True)
        elif status == "transladado":
            sepultados = sepultados.filter(data_translado__isnull=False)
        elif status == "sepultado":
            sepultados = sepultados.filter(data_exumacao__isnull=True, data_translado__isnull=True)

    # URL do brasão
    brasao_url = None
    if prefeitura and prefeitura.brasao:
        brasao_url = request.build_absolute_uri(prefeitura.brasao.url)

    # Renderiza o HTML com os dados
    html_string = render_to_string("pdf/relatorio_sepultados_pdf.html", {
        "sepultados": sepultados,
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "status": status,
        "brasao_url": brasao_url,
    })

    html = HTML(string=html_string)
    pdf = html.write_pdf()

    return HttpResponse(pdf, content_type='application/pdf')


from sepultados_gestao.models import Exumacao

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


@staff_member_required
def relatorio_exumacoes_pdf(request):
    prefeitura = request.prefeitura_ativa
    cemiterio = request.cemiterio_ativo

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    exumacoes = Exumacao.objects.filter(
        prefeitura=prefeitura,
        tumulo__quadra__cemiterio=cemiterio
    )

    try:
        if data_inicio:
            data_inicio_formatada = datetime.strptime(data_inicio, "%Y-%m-%d").date()
            exumacoes = exumacoes.filter(data__gte=data_inicio_formatada)
    except (ValueError, TypeError):
        data_inicio = None

    try:
        if data_fim:
            data_fim_formatada = datetime.strptime(data_fim, "%Y-%m-%d").date()
            exumacoes = exumacoes.filter(data__lte=data_fim_formatada)
    except (ValueError, TypeError):
        data_fim = None

    brasao_url = None
    if prefeitura and prefeitura.brasao:
        brasao_url = request.build_absolute_uri(prefeitura.brasao.url)

    html_string = render_to_string("pdf/relatorio_exumacoes_pdf.html", {
        "exumacoes": exumacoes,
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "brasao_url": brasao_url,
    })

    html = HTML(string=html_string)
    pdf = html.write_pdf()

    return HttpResponse(pdf, content_type='application/pdf')

from sepultados_gestao.models import Translado
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.utils.dateparse import parse_date
from django.template.loader import render_to_string
from weasyprint import HTML
from django.http import HttpResponse

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

from django.contrib.admin.views.decorators import staff_member_required
from django.template.loader import render_to_string
from django.http import HttpResponse
from weasyprint import HTML
from django.utils.dateparse import parse_date
from sepultados_gestao.models import Translado, Prefeitura, Cemiterio

@staff_member_required
def relatorio_translados_pdf(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    prefeitura = Prefeitura.objects.filter(id=prefeitura_id).first()
    cemiterio = Cemiterio.objects.filter(id=cemiterio_id).first()

    translados = Translado.objects.filter(
        sepultado__tumulo__quadra__cemiterio_id=cemiterio_id,
        sepultado__tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id,
    )

    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    if data_inicio and data_fim:
        try:
            dt_ini = parse_date(data_inicio)
            dt_fim = parse_date(data_fim)
            translados = translados.filter(data_translado__range=(dt_ini, dt_fim))
        except Exception:
            pass

    brasao_url = None
    if prefeitura and prefeitura.brasao:
        brasao_url = request.build_absolute_uri(prefeitura.brasao.url)

    context = {
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "translados": translados,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "brasao_url": brasao_url,
    }

    html_string = render_to_string("pdf/relatorio_translados_pdf.html", context)
    pdf_file = HTML(string=html_string).write_pdf()
    return HttpResponse(pdf_file, content_type="application/pdf")


# relatorio/views.py
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.utils.dateparse import parse_date
from django.template.loader import render_to_string
from weasyprint import HTML
from django.http import HttpResponse
from sepultados_gestao.models import ConcessaoContrato, Prefeitura, Cemiterio


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


from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.utils.dateparse import parse_date
from django.template.loader import render_to_string
from weasyprint import HTML
from django.http import HttpResponse
from sepultados_gestao.models import ConcessaoContrato, Prefeitura, Cemiterio


@staff_member_required
def relatorio_contratos_pdf(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    prefeitura = Prefeitura.objects.filter(id=prefeitura_id).first()
    cemiterio = Cemiterio.objects.filter(id=cemiterio_id).first()

    contratos = ConcessaoContrato.objects.filter(
        tumulo__quadra__cemiterio_id=cemiterio_id,
        tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id
    )

    # Corrigido: tratamento seguro dos parâmetros
    data_inicio = request.GET.get("data_inicio")
    data_fim = request.GET.get("data_fim")

    dt_ini = parse_date(data_inicio) if data_inicio and data_inicio != "None" else None
    dt_fim = parse_date(data_fim) if data_fim and data_fim != "None" else None

    if dt_ini and dt_fim:
        contratos = contratos.filter(data_contrato__range=(dt_ini, dt_fim))

    brasao_url = None
    if prefeitura and prefeitura.brasao:
        brasao_url = request.build_absolute_uri(prefeitura.brasao.url)

    context = {
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "contratos": contratos,
        "data_inicio": dt_ini,
        "data_fim": dt_fim,
        "brasao_url": brasao_url,
    }

    html_string = render_to_string("pdf/relatorio_contratos_pdf.html", context)
    pdf_file = HTML(string=html_string).write_pdf()
    return HttpResponse(pdf_file, content_type="application/pdf")


from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.utils.dateparse import parse_date
from django.template.loader import render_to_string
from weasyprint import HTML
from django.http import HttpResponse
from sepultados_gestao.models import Receita, Prefeitura, Cemiterio
from django.db.models import Q


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
            Q(contrato__isnull=True, sepultado__isnull=True, exumacao__isnull=True, translado__isnull=True)  # receitas gerais
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


@staff_member_required
def relatorio_receitas_pdf(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    prefeitura = Prefeitura.objects.filter(id=prefeitura_id).first()
    cemiterio = Cemiterio.objects.filter(id=cemiterio_id).first()

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

    brasao_url = None
    if prefeitura and prefeitura.brasao:
        brasao_url = request.build_absolute_uri(prefeitura.brasao.url)

    context = {
        "prefeitura": prefeitura,
        "cemiterio": cemiterio,
        "receitas": receitas,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "brasao_url": brasao_url,
    }

    html_string = render_to_string("pdf/relatorio_receitas_pdf.html", context)
    pdf_file = HTML(string=html_string).write_pdf()
    return HttpResponse(pdf_file, content_type="application/pdf")


from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.template.loader import render_to_string
from django.utils.dateparse import parse_date
from weasyprint import HTML
from django.http import HttpResponse
from sepultados_gestao.models import Tumulo, Prefeitura, Cemiterio, ConcessaoContrato


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


from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils.dateparse import parse_date
from weasyprint import HTML
from datetime import date

from sepultados_gestao.models import Tumulo, Prefeitura, Cemiterio, ConcessaoContrato, Sepultado

@staff_member_required
def relatorio_tumulos_pdf(request):
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    cemiterio_id = request.session.get("cemiterio_ativo_id")

    prefeitura = Prefeitura.objects.filter(id=prefeitura_id).first()
    cemiterio = Cemiterio.objects.filter(id=cemiterio_id).first()

    tumulos = Tumulo.objects.filter(cemiterio_id=cemiterio_id).prefetch_related("sepultado_set")

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

    brasao_url = None
    if prefeitura and prefeitura.brasao:
        brasao_url = request.build_absolute_uri(prefeitura.brasao.url)

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
    pdf_file = HTML(string=html_string).write_pdf()
    return HttpResponse(pdf_file, content_type="application/pdf")
