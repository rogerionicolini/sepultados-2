# relatorios/api_views.py
from django.urls import reverse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse

from sepultados_gestao.models import (
    Sepultado, Exumacao, Translado, ConcessaoContrato, Receita, Tumulo
)
from sepultados_gestao.serializers import (
    SepultadoSerializer, ExumacaoSerializer, TransladoSerializer,
    ConcessaoContratoSerializer, ReceitaSerializer, TumuloSerializer
)

# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
def _append_query(url: str, extra: dict) -> str:
    """Anexa/mescla querystring na URL."""
    parts = urlparse(url)
    base_qs = dict(parse_qsl(parts.query))
    base_qs.update({k: v for k, v in extra.items() if v not in (None, "", [], {})})
    new_qs = urlencode(base_qs, doseq=True)
    return urlunparse(parts._replace(query=new_qs))


def _get_prefeitura_id(request):
    """
    Resolve a prefeitura de forma stateless:
    1) Querystring: ?prefeitura_id= ou ?prefeitura=
    2) Header: X-Prefeitura-Id
    3) Sessão do admin (se existir): request.prefeitura_ativa.id
    Retorna o ID (str/int) ou None.
    """
    pref_id = (
        request.query_params.get("prefeitura_id")
        or request.query_params.get("prefeitura")
        or request.headers.get("X-Prefeitura-Id")
    )
    if not pref_id:
        pref_obj = getattr(request, "prefeitura_ativa", None)
        if pref_obj:
            pref_id = getattr(pref_obj, "id", None)
    return pref_id


def _pdf_url_with_params(request, name_candidates, fallback_path="/"):
    """
    Resolve a URL absoluta do endpoint de PDF e propaga parâmetros da requisição,
    incluindo prefeitura_id (se ainda não estiver na query).
    """
    # 1) resolve rota
    url = None
    for name in name_candidates:
        try:
            url = request.build_absolute_uri(reverse(name))
            break
        except Exception:
            pass
    if not url:
        url = request.build_absolute_uri(fallback_path)

    # 2) coleta parâmetros recebidos + prefeitura_id (stateless)
    params = request.query_params.dict()
    pref_id = _get_prefeitura_id(request)
    if pref_id and ("prefeitura_id" not in params and "prefeitura" not in params):
        params["prefeitura_id"] = pref_id

    # 3) devolve URL com querystring mesclada
    return _append_query(url, params)


# ---------------------------------------------------------------------
# Listagens (JSON) usadas pelos relatórios
# ---------------------------------------------------------------------
@api_view(['GET'])
def relatorio_sepultados_api(request):
    pref_id = _get_prefeitura_id(request)
    if not pref_id:
        return Response({"detail": "Informe prefeitura_id (querystring ou header X-Prefeitura-Id)."},
                        status=status.HTTP_400_BAD_REQUEST)
    qs = Sepultado.objects.filter(tumulo__quadra__cemiterio__prefeitura_id=pref_id)
    return Response(SepultadoSerializer(qs, many=True, context={"request": request}).data)


@api_view(['GET'])
def relatorio_exumacoes_api(request):
    pref_id = _get_prefeitura_id(request)
    if not pref_id:
        return Response({"detail": "Informe prefeitura_id (querystring ou header X-Prefeitura-Id)."},
                        status=status.HTTP_400_BAD_REQUEST)
    qs = Exumacao.objects.filter(tumulo__quadra__cemiterio__prefeitura_id=pref_id)
    return Response(ExumacaoSerializer(qs, many=True, context={"request": request}).data)


@api_view(['GET'])
def relatorio_translados_api(request):
    pref_id = _get_prefeitura_id(request)
    if not pref_id:
        return Response({"detail": "Informe prefeitura_id (querystring ou header X-Prefeitura-Id)."},
                        status=status.HTTP_400_BAD_REQUEST)
    qs = (Translado.objects.filter(tumulo_destino__quadra__cemiterio__prefeitura_id=pref_id)
          | Translado.objects.filter(sepultado__tumulo__quadra__cemiterio__prefeitura_id=pref_id))
    return Response(TransladoSerializer(qs, many=True, context={"request": request}).data)


@api_view(['GET'])
def relatorio_contratos_api(request):
    pref_id = _get_prefeitura_id(request)
    if not pref_id:
        return Response({"detail": "Informe prefeitura_id (querystring ou header X-Prefeitura-Id)."},
                        status=status.HTTP_400_BAD_REQUEST)
    qs = ConcessaoContrato.objects.filter(tumulo__quadra__cemiterio__prefeitura_id=pref_id)
    return Response(ConcessaoContratoSerializer(qs, many=True, context={"request": request}).data)


@api_view(['GET'])
def relatorio_receitas_api(request):
    """
    Lista receitas. Aceita ?prefeitura=<id> (ou ?prefeitura_id=) ou header X-Prefeitura-Id.
    Sem prefeitura => 400.
    """
    pref_id = _get_prefeitura_id(request)
    if not pref_id:
        return Response({"detail": "Informe prefeitura_id (querystring ou header X-Prefeitura-Id)."},
                        status=status.HTTP_400_BAD_REQUEST)
    qs = Receita.objects.filter(prefeitura_id=pref_id).order_by("-id")
    return Response(ReceitaSerializer(qs, many=True, context={"request": request}).data)


@api_view(['GET'])
def relatorio_tumulos_api(request):
    pref_id = _get_prefeitura_id(request)
    if not pref_id:
        return Response({"detail": "Informe prefeitura_id (querystring ou header X-Prefeitura-Id)."},
                        status=status.HTTP_400_BAD_REQUEST)
    qs = Tumulo.objects.filter(quadra__cemiterio__prefeitura_id=pref_id)
    return Response(TumuloSerializer(qs, many=True, context={"request": request}).data)


# ---------------------------------------------------------------------
# Endpoints que devolvem a URL ABSOLUTA dos PDFs (com query propagada)
# ---------------------------------------------------------------------
@api_view(['GET'])
def relatorio_sepultados_pdf_url(request):
    url = _pdf_url_with_params(
        request,
        ["relatorio_sepultados_pdf", "relatorios:relatorio_sepultados_pdf"],
        "/relatorios/sepultados/pdf/",
    )
    return Response({"pdf_url": url})


@api_view(['GET'])
def relatorio_exumacoes_pdf_url(request):
    url = _pdf_url_with_params(
        request,
        ["relatorio_exumacoes_pdf", "relatorios:relatorio_exumacoes_pdf"],
        "/relatorios/exumacoes/pdf/",
    )
    return Response({"pdf_url": url})


@api_view(['GET'])
def relatorio_translados_pdf_url(request):
    url = _pdf_url_with_params(
        request,
        ["relatorio_translados_pdf", "relatorios:relatorio_translados_pdf"],
        "/relatorios/translados/pdf/",
    )
    return Response({"pdf_url": url})


@api_view(['GET'])
def relatorio_contratos_pdf_url(request):
    url = _pdf_url_with_params(
        request,
        ["relatorio_contratos_pdf", "relatorios:relatorio_contratos_pdf"],
        "/relatorios/contratos/pdf/",
    )
    return Response({"pdf_url": url})


@api_view(['GET'])
def relatorio_receitas_pdf_url(request):
    url = _pdf_url_with_params(
        request,
        ["relatorio_receitas_pdf", "relatorios:relatorio_receitas_pdf"],
        "/relatorios/receitas/pdf/",
    )
    return Response({"pdf_url": url})


@api_view(['GET'])
def relatorio_tumulos_pdf_url(request):
    url = _pdf_url_with_params(
        request,
        ["relatorio_tumulos_pdf", "relatorios:relatorio_tumulos_pdf"],
        "/relatorios/tumulos/pdf/",
    )
    return Response({"pdf_url": url})
