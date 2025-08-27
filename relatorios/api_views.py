from urllib.parse import urlencode

from django.urls import reverse, NoReverseMatch
from rest_framework.decorators import api_view
from rest_framework.response import Response

from sepultados_gestao.models import (
    Sepultado, Exumacao, Translado, ConcessaoContrato, Receita, Tumulo
)
from sepultados_gestao.serializers import (
    SepultadoSerializer, ExumacaoSerializer, TransladoSerializer,
    ConcessaoContratoSerializer, ReceitaSerializer, TumuloSerializer
)


# ========================= Helpers p/ PDF URL =========================
def _params_lists(request):
    """Preserva múltiplos valores (doseq=True no urlencode)."""
    return {k: v for k, v in request.query_params.lists()}

def _build_pdf_url(request, name_candidates, fallback_path: str) -> str:
    """
    Tenta reverter pelo nome da rota do PDF; se não achar, usa o caminho fallback.
    Sempre retorna URL ABSOLUTA, com a mesma querystring aplicada.
    """
    path = None
    for name in name_candidates:
        try:
            path = reverse(name)
            break
        except NoReverseMatch:
            continue
        except Exception:
            continue

    if not path:
        path = fallback_path  # Ex.: "/relatorios/sepultados/pdf/"

    qs = urlencode(_params_lists(request), doseq=True)
    if qs:
        path = f"{path}?{qs}"
    return request.build_absolute_uri(path)


# ============================ Listagens ==============================
@api_view(['GET'])
def relatorio_sepultados_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        queryset = Sepultado.objects.filter(tumulo__quadra__cemiterio__prefeitura=prefeitura)
    else:
        queryset = Sepultado.objects.none()
    serializer = SepultadoSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_exumacoes_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        queryset = Exumacao.objects.filter(tumulo__quadra__cemiterio__prefeitura=prefeitura)
    else:
        queryset = Exumacao.objects.none()
    serializer = ExumacaoSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_translados_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        queryset = Translado.objects.filter(tumulo_destino__quadra__cemiterio__prefeitura=prefeitura)
    else:
        queryset = Translado.objects.none()
    serializer = TransladoSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_contratos_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        queryset = ConcessaoContrato.objects.filter(tumulo__quadra__cemiterio__prefeitura=prefeitura)
    else:
        queryset = ConcessaoContrato.objects.none()
    serializer = ConcessaoContratoSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_receitas_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        queryset = Receita.objects.filter(prefeitura=prefeitura)
    else:
        queryset = Receita.objects.none()
    serializer = ReceitaSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_tumulos_api(request):
    prefeitura = getattr(request, "prefeitura_ativa", None)
    if prefeitura:
        queryset = Tumulo.objects.filter(quadra__cemiterio__prefeitura=prefeitura)
    else:
        queryset = Tumulo.objects.none()
    serializer = TumuloSerializer(queryset, many=True)
    return Response(serializer.data)


# ====================== Endpoints de URL do PDF ======================
@api_view(['GET'])
def relatorio_sepultados_pdf_url(request):
    url = _build_pdf_url(
        request,
        # coloque aqui os possíveis nomes da sua rota de PDF
        name_candidates=["relatorio_sepultados_pdf", "relatorios:relatorio_sepultados_pdf"],
        # e o caminho “bruto” que você já usa no backend
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
