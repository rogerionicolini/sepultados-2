# relatorios/api_views.py
from django.urls import reverse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from sepultados_gestao.models import (
    Sepultado, Exumacao, Translado, ConcessaoContrato, Receita, Tumulo
)
from sepultados_gestao.serializers import (
    SepultadoSerializer, ExumacaoSerializer, TransladoSerializer,
    ConcessaoContratoSerializer, ReceitaSerializer, TumuloSerializer
)

# ---------------------------------------------------------------------
# Helper para construir URL absoluta do PDF
# ---------------------------------------------------------------------
def _build_pdf_url(request, name_candidates, fallback_path="/"):
    """
    Tenta resolver por 'reverse' usando os nomes em name_candidates.
    Se não conseguir, usa o 'fallback_path'.
    Retorna URL ABSOLUTA (com domínio/porta do backend).
    """
    for name in name_candidates:
        try:
            url = reverse(name)
            return request.build_absolute_uri(url)
        except Exception:
            pass
    return request.build_absolute_uri(fallback_path)

# ---------------------------------------------------------------------
# Listagens (JSON) usadas pelos relatórios
# ---------------------------------------------------------------------
@api_view(['GET'])
def relatorio_sepultados_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        qs = Sepultado.objects.filter(tumulo__quadra__cemiterio__prefeitura=prefeitura)
    else:
        qs = Sepultado.objects.none()
    return Response(SepultadoSerializer(qs, many=True, context={"request": request}).data)

@api_view(['GET'])
def relatorio_exumacoes_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        qs = Exumacao.objects.filter(tumulo__quadra__cemiterio__prefeitura=prefeitura)
    else:
        qs = Exumacao.objects.none()
    return Response(ExumacaoSerializer(qs, many=True, context={"request": request}).data)

@api_view(['GET'])
def relatorio_translados_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        qs = Translado.objects.filter(
            tumulo_destino__quadra__cemiterio__prefeitura=prefeitura
        ) | Translado.objects.filter(
            sepultado__tumulo__quadra__cemiterio__prefeitura=prefeitura
        )
    else:
        qs = Translado.objects.none()
    return Response(TransladoSerializer(qs, many=True, context={"request": request}).data)

@api_view(['GET'])
def relatorio_contratos_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        qs = ConcessaoContrato.objects.filter(tumulo__quadra__cemiterio__prefeitura=prefeitura)
    else:
        qs = ConcessaoContrato.objects.none()
    return Response(ConcessaoContratoSerializer(qs, many=True, context={"request": request}).data)

@api_view(['GET'])
def relatorio_receitas_api(request):
    """
    Lista receitas. Aceita ?prefeitura=<id> (ou ?prefeitura_id=).
    Senão, usa request.prefeitura_ativa. Sem escopo => vazio.
    """
    pref_id = request.query_params.get("prefeitura") or request.query_params.get("prefeitura_id")
    pref_ativa = getattr(request, "prefeitura_ativa", None)

    if pref_id:
        qs = Receita.objects.filter(prefeitura_id=pref_id).order_by("-id")
    elif pref_ativa:
        qs = Receita.objects.filter(prefeitura=pref_ativa).order_by("-id")
    else:
        qs = Receita.objects.none()

    return Response(ReceitaSerializer(qs, many=True, context={"request": request}).data)

@api_view(['GET'])
def relatorio_tumulos_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        qs = Tumulo.objects.filter(quadra__cemiterio__prefeitura=prefeitura)
    else:
        qs = Tumulo.objects.none()
    return Response(TumuloSerializer(qs, many=True, context={"request": request}).data)

# ---------------------------------------------------------------------
# Endpoints que devolvem a URL ABSOLUTA dos PDFs
# ---------------------------------------------------------------------
@api_view(['GET'])
def relatorio_sepultados_pdf_url(request):
    url = _build_pdf_url(
        request,
        name_candidates=["relatorio_sepultados_pdf", "relatorios:relatorio_sepultados_pdf"],
        fallback_path="/relatorios/sepultados/pdf/",
    )
    return Response({"pdf_url": url})

@api_view(['GET'])
def relatorio_exumacoes_pdf_url(request):
    url = _build_pdf_url(
        request,
        name_candidates=["relatorio_exumacoes_pdf", "relatorios:relatorio_exumacoes_pdf"],
        fallback_path="/relatorios/exumacoes/pdf/",
    )
    return Response({"pdf_url": url})

@api_view(['GET'])
def relatorio_translados_pdf_url(request):
    url = _build_pdf_url(
        request,
        name_candidates=["relatorio_translados_pdf", "relatorios:relatorio_translados_pdf"],
        fallback_path="/relatorios/translados/pdf/",
    )
    return Response({"pdf_url": url})

@api_view(['GET'])
def relatorio_contratos_pdf_url(request):
    url = _build_pdf_url(
        request,
        name_candidates=["relatorio_contratos_pdf", "relatorios:relatorio_contratos_pdf"],
        fallback_path="/relatorios/contratos/pdf/",
    )
    return Response({"pdf_url": url})

@api_view(['GET'])
def relatorio_receitas_pdf_url(request):
    url = _build_pdf_url(
        request,
        name_candidates=["relatorio_receitas_pdf", "relatorios:relatorio_receitas_pdf"],
        fallback_path="/relatorios/receitas/pdf/",
    )
    return Response({"pdf_url": url})

@api_view(['GET'])
def relatorio_tumulos_pdf_url(request):
    url = _build_pdf_url(
        request,
        name_candidates=["relatorio_tumulos_pdf", "relatorios:relatorio_tumulos_pdf"],
        fallback_path="/relatorios/tumulos/pdf/",
    )
    return Response({"pdf_url": url})
