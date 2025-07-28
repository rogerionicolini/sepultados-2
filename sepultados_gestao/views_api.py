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

# ✅ Mixin para filtrar os dados pela prefeitura ativa do usuário
class PrefeituraRestritaQuerysetMixin:
    prefeitura_field = "prefeitura"  # valor padrão

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return self.queryset.none()
        prefeitura = getattr(self.request, "prefeitura_ativa", None)
        if not prefeitura:
            return self.queryset.none()
        return self.queryset.filter(**{self.prefeitura_field: prefeitura})

# ✅ Cemitérios
class CemiterioViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Cemiterio.objects.all()
    serializer_class = CemiterioSerializer
    prefeitura_field = "prefeitura"

# ✅ Quadras
class QuadraViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Quadra.objects.all()
    serializer_class = QuadraSerializer
    prefeitura_field = "cemiterio__prefeitura"

# ✅ Túmulos
class TumuloViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Tumulo.objects.all()
    serializer_class = TumuloSerializer
    prefeitura_field = "quadra__cemiterio__prefeitura"

# ✅ Sepultados
class SepultadoViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Sepultado.objects.all()
    serializer_class = SepultadoSerializer
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"

# ✅ Contratos de concessão
class ConcessaoContratoViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = ConcessaoContrato.objects.all()
    serializer_class = ConcessaoContratoSerializer
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"

# ✅ Exumações
class ExumacaoViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Exumacao.objects.all()
    serializer_class = ExumacaoSerializer
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"

# ✅ Translados
class TransladoViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Translado.objects.all()
    serializer_class = TransladoSerializer
    prefeitura_field = "tumulo_destino__quadra__cemiterio__prefeitura"

# ✅ Receitas
class ReceitaViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Receita.objects.all()
    serializer_class = ReceitaSerializer
    prefeitura_field = "prefeitura"

# ✅ Auditoria
class RegistroAuditoriaViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = RegistroAuditoria.objects.all()
    serializer_class = RegistroAuditoriaSerializer
    prefeitura_field = "prefeitura"
