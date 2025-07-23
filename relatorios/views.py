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
