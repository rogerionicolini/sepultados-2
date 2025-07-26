from rest_framework import viewsets
from .models import (
    Cemiterio,
    ConcessaoContrato,
    Exumacao,
    Quadra,
    Receita,
    RegistroAuditoria,
    Sepultado,
    Translado,
    Tumulo,
)
from .serializers import (
    CemiterioSerializer,
    ConcessaoContratoSerializer,
    ExumacaoSerializer,
    QuadraSerializer,
    ReceitaSerializer,
    RegistroAuditoriaSerializer,
    SepultadoSerializer,
    TransladoSerializer,
    TumuloSerializer,
)

class CemiterioViewSet(viewsets.ModelViewSet):
    queryset = Cemiterio.objects.all()
    serializer_class = CemiterioSerializer

class ConcessaoContratoViewSet(viewsets.ModelViewSet):
    queryset = ConcessaoContrato.objects.all()
    serializer_class = ConcessaoContratoSerializer

class ExumacaoViewSet(viewsets.ModelViewSet):
    queryset = Exumacao.objects.all()
    serializer_class = ExumacaoSerializer

class QuadraViewSet(viewsets.ModelViewSet):
    queryset = Quadra.objects.all()
    serializer_class = QuadraSerializer

class ReceitaViewSet(viewsets.ModelViewSet):
    queryset = Receita.objects.all()
    serializer_class = ReceitaSerializer

class RegistroAuditoriaViewSet(viewsets.ModelViewSet):
    queryset = RegistroAuditoria.objects.all()
    serializer_class = RegistroAuditoriaSerializer

class SepultadoViewSet(viewsets.ModelViewSet):
    queryset = Sepultado.objects.all()
    serializer_class = SepultadoSerializer

class TransladoViewSet(viewsets.ModelViewSet):
    queryset = Translado.objects.all()
    serializer_class = TransladoSerializer

class TumuloViewSet(viewsets.ModelViewSet):
    queryset = Tumulo.objects.all()
    serializer_class = TumuloSerializer
