from rest_framework.decorators import api_view
from rest_framework.response import Response
from sepultados_gestao.models import (
    Sepultado, Exumacao, Translado, ConcessaoContrato, Receita, Tumulo
)
from sepultados_gestao.serializers import (
    SepultadoSerializer, ExumacaoSerializer, TransladoSerializer,
    ConcessaoContratoSerializer, ReceitaSerializer, TumuloSerializer
)

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
