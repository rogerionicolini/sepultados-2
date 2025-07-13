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

        user = authenticate(username=request.user.username, password=senha)
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
from django.template.loader import render_to_string
from django.http import HttpResponse
from weasyprint import HTML
from .models import MovimentacaoSepultado
import os
from django.conf import settings

@staff_member_required
def pdf_exumacao(request, pk):
    movimentacao = get_object_or_404(
        MovimentacaoSepultado.objects.select_related(
            'tumulo_origem__quadra__cemiterio'
        ),
        pk=pk,
        tipo="EXUMACAO"
    )

    prefeitura = movimentacao.tumulo_origem.quadra.cemiterio.prefeitura
    brasao_path = ''
    if prefeitura and prefeitura.brasao:
        brasao_absoluto = os.path.join(settings.MEDIA_ROOT, prefeitura.brasao.name)
        brasao_path = f"file:///{brasao_absoluto.replace(os.sep, '/')}"

    html = render_to_string("pdf/exumacao.html", {
        "movimentacao": movimentacao,
        "brasao_path": brasao_path,
    })

    pdf = HTML(string=html).write_pdf()
    return HttpResponse(pdf, content_type='application/pdf')


@staff_member_required
def pdf_translado(request, pk):
    movimentacao = get_object_or_404(
        MovimentacaoSepultado.objects.select_related(
            'tumulo_origem__quadra__cemiterio'
        ),
        pk=pk,
        tipo="TRANSLADO"
    )

    prefeitura = movimentacao.tumulo_origem.quadra.cemiterio.prefeitura
    brasao_path = ''
    if prefeitura and prefeitura.brasao:
        brasao_absoluto = os.path.join(settings.MEDIA_ROOT, prefeitura.brasao.name)
        brasao_path = f"file:///{brasao_absoluto.replace(os.sep, '/')}"

    html = render_to_string("pdf/translado.html", {
        "movimentacao": movimentacao,
        "brasao_path": brasao_path,
    })

    pdf = HTML(string=html).write_pdf()
    return HttpResponse(pdf, content_type='application/pdf')
