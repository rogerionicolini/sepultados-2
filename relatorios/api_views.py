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
    queryset = Sepultado.objects.all()
    serializer = SepultadoSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_exumacoes_api(request):
    queryset = Exumacao.objects.all()
    serializer = ExumacaoSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_translados_api(request):
    queryset = Translado.objects.all()
    serializer = TransladoSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_contratos_api(request):
    queryset = ConcessaoContrato.objects.all()
    serializer = ConcessaoContratoSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_receitas_api(request):
    queryset = Receita.objects.all()
    serializer = ReceitaSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def relatorio_tumulos_api(request):
    queryset = Tumulo.objects.all()
    serializer = TumuloSerializer(queryset, many=True)
    return Response(serializer.data)
