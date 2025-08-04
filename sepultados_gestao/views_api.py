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



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from sepultados_gestao.models import Prefeitura, Plano, Licenca
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django.core.files.base import ContentFile
import base64
import uuid

User = get_user_model()

class RegistrarPrefeituraAPIView(APIView):
    permission_classes = []

    def post(self, request):
        try:
            with transaction.atomic():
                dados = request.data

                # Campos obrigatórios
                nome = dados.get("nome")
                cnpj = dados.get("cnpj")
                responsavel = dados.get("responsavel")
                telefone = dados.get("telefone")
                email = dados.get("email")
                senha = dados.get("senha")

                logradouro = dados.get("logradouro")
                numero = dados.get("endereco_numero")
                bairro = dados.get("endereco_bairro")
                cidade = dados.get("endereco_cidade")
                estado = dados.get("endereco_estado")
                cep = dados.get("endereco_cep")

                plano_id = dados.get("plano_id")
                if not plano_id:
                    return Response({"detail": "O plano selecionado é obrigatório."}, status=400)

                if not all([nome, cnpj, responsavel, telefone, email, senha, logradouro, numero, cidade, estado, cep]):
                    return Response({"detail": "Todos os campos obrigatórios devem ser preenchidos."}, status=400)

                if Prefeitura.objects.filter(cnpj=cnpj).exists():
                    return Response({"detail": "Já existe uma prefeitura com esse CNPJ."}, status=400)

                if User.objects.filter(email=email).exists():
                    return Response({"detail": "Já existe um usuário com esse e-mail."}, status=400)

                user = User.objects.create_user(
                    email=email,
                    password=senha,
                    is_active=True,
                    is_staff=True
                )

                prefeitura = Prefeitura.objects.create(
                    usuario=user,
                    nome=nome,
                    cnpj=cnpj,
                    responsavel=responsavel,
                    telefone=telefone,
                    email=email,
                    logradouro=logradouro,
                    endereco_numero=numero,
                    endereco_bairro=bairro,
                    endereco_cidade=cidade,
                    endereco_estado=estado,
                    endereco_cep=cep,
                )

                # Upload opcional
                def salvar_imagem(base64_str):
                    format, imgstr = base64_str.split(';base64,')
                    ext = format.split('/')[-1]
                    nome_arquivo = f"{uuid.uuid4()}.{ext}"
                    return ContentFile(base64.b64decode(imgstr), name=nome_arquivo)

                if dados.get("logo_base64"):
                    prefeitura.logo = salvar_imagem(dados["logo_base64"])
                if dados.get("brasao_base64"):
                    prefeitura.brasao = salvar_imagem(dados["brasao_base64"])
                prefeitura.save()

                # Criar licença com base no plano
                plano = Plano.objects.get(pk=plano_id)
                Licenca.objects.create(
                    prefeitura=prefeitura,
                    plano=plano,
                    valor_mensal_atual=plano.preco_mensal,
                    usuarios_min=plano.usuarios_min,
                    usuarios_max=plano.usuarios_max,
                    sepultados_max=plano.sepultados_max,
                    inclui_api=plano.inclui_api,
                    inclui_erp=plano.inclui_erp,
                    inclui_suporte_prioritario=plano.inclui_suporte_prioritario,
                )


                refresh = RefreshToken.for_user(user)

                return Response({
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "usuario": user.email,
                    "prefeitura": prefeitura.nome
                }, status=201)

        except Exception as e:
            return Response({"detail": str(e)}, status=500)



from rest_framework.views import APIView
from rest_framework.response import Response
from sepultados_gestao.models import Plano
from .serializers import PlanoSerializer

class ListaPlanosAPIView(APIView):
    permission_classes = []

    def get(self, request):
        planos = Plano.objects.all().order_by('preco_mensal')
        serializer = PlanoSerializer(planos, many=True)
        return Response(serializer.data)

# views_api.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from sepultados_gestao.models import Licenca
from .serializers import LicencaSerializer

@api_view(['GET'])
def licenca_da_prefeitura(request, prefeitura_id):
    try:
        licenca = Licenca.objects.get(prefeitura_id=prefeitura_id)
    except Licenca.DoesNotExist:
        return Response({"detail": "Licença não encontrada."}, status=404)

    serializer = LicencaSerializer(licenca)
    return Response(serializer.data)

