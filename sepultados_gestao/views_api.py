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
from sepultados_gestao.models import EmailConfirmacao, CadastroPrefeituraPendente
from django.db import transaction
from django.core.mail import send_mail
from django.utils import timezone
from django.conf import settings
import uuid

User = get_user_model()

class RegistrarPrefeituraAPIView(APIView):
    permission_classes = []

    def enviar_email_confirmacao(self, email):
        token = uuid.uuid4()
        EmailConfirmacao.objects.update_or_create(
            email=email,
            defaults={
                'token': token,
                'criado_em': timezone.now(),
                'usado': False,
            }
        )
        link = f"{settings.FRONTEND_URL}/verificar-email/{token}"
        from django.template.loader import render_to_string

        html_content = render_to_string("emails/confirmar_email.html", {"link": link})

        send_mail(
            subject="Confirmação de E-mail - Sepultados.com",
            message=f"Olá! Confirme seu e-mail clicando no link: {link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_content,
            fail_silently=False,
        )


    def post(self, request):
        try:
            with transaction.atomic():
                dados = request.data

                # Dados principais
                campos = {
                    "nome": dados.get("nome"),
                    "cnpj": dados.get("cnpj"),
                    "responsavel": dados.get("responsavel"),
                    "telefone": dados.get("telefone"),
                    "email": dados.get("email"),
                    "senha": dados.get("senha"),
                    "logradouro": dados.get("logradouro"),
                    "endereco_numero": dados.get("endereco_numero"),
                    "endereco_bairro": dados.get("endereco_bairro"),
                    "endereco_cidade": dados.get("endereco_cidade"),
                    "endereco_estado": dados.get("endereco_estado"),
                    "endereco_cep": dados.get("endereco_cep"),
                    "plano_id": int(dados.get("plano_id")),
                    "duracao_anos": int(dados.get("duracao_anos", 1)),
                    "logo_base64": dados.get("logo_base64"),
                    "brasao_base64": dados.get("brasao_base64"),
                }

                if not all([campos["nome"], campos["cnpj"], campos["responsavel"], campos["telefone"], campos["email"], campos["senha"], campos["logradouro"], campos["endereco_numero"], campos["endereco_cidade"], campos["endereco_estado"], campos["endereco_cep"], campos["plano_id"]]):
                    return Response({"detail": "Todos os campos obrigatórios devem ser preenchidos."}, status=400)

                # Verifica duplicidade ativa
                if User.objects.filter(email=campos["email"], is_active=True).exists():
                    return Response({"detail": "Já existe um usuário ativo com esse e-mail."}, status=400)

                # Cria ou atualiza o cadastro pendente
                CadastroPrefeituraPendente.objects.update_or_create(
                    email=campos["email"],
                    defaults=campos
                )

                # Cria usuário inativo se não existir
                user = User.objects.filter(email=campos["email"]).first()
                if not user:
                    user = User.objects.create_user(
                        email=campos["email"],
                        password=campos["senha"],
                        is_active=False,
                        is_staff=True
                    )

                # Envia e-mail de confirmação
                self.enviar_email_confirmacao(campos["email"])

                return Response({
                    "detail": "Enviamos um e-mail para confirmação. Verifique sua caixa de entrada."
                }, status=200)

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


import uuid
from django.core.mail import send_mail
from django.utils import timezone
from django.conf import settings
from .models import EmailConfirmacao  # ajuste o import se necessário

def enviar_email_confirmacao(email):
    token = uuid.uuid4()

    EmailConfirmacao.objects.update_or_create(
        email=email,
        defaults={
            'token': token,
            'criado_em': timezone.now(),
            'usado': False,
        }
    )

    link = f"{settings.FRONTEND_URL}/verificar-email/{token}"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 40px;">
      <div style="max-width: 600px; background: #ffffff; margin: auto; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <h2 style="color: #2f855a; text-align: center;">Confirmação de E-mail</h2>
        <p>Olá,</p>
        <p>Recebemos seu cadastro no <strong>Sepultados.com</strong>.</p>
        <p>Para ativar sua conta, clique no botão abaixo:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="{link}" target="_blank" style="background-color: #2f855a; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Confirmar E-mail
          </a>
        </div>

        <p style="font-size: 14px; color: #666;">Se você não fez esse cadastro, ignore esta mensagem.</p>
        <hr style="margin: 30px 0;">
        <p style="font-size: 12px; text-align: center; color: #aaa;">Sepultados.com • Sistema de Gestão de Cemitérios</p>
      </div>
    </div>
    """

    send_mail(
        subject="Confirmação de E-mail - Sepultados.com",
        message=f"Olá! Confirme seu e-mail clicando neste link: {link}",  # fallback
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        html_message=html_content,
        fail_silently=False,
    )


from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from sepultados_gestao.models import (
    EmailConfirmacao,
    CadastroPrefeituraPendente,
    Prefeitura,
    Plano,
    Licenca
)

@api_view(['GET'])
def verificar_email(request, token):
    try:
        confirmacao = EmailConfirmacao.objects.get(token=token)

        if confirmacao.usado:
            return Response({"detail": "Este link já foi utilizado."}, status=400)

        # Confirmação marcada como usada
        confirmacao.usado = True
        confirmacao.save()

        user = User.objects.filter(email=confirmacao.email).first()
        if not user:
            return Response({"detail": "Usuário não encontrado para este e-mail."}, status=404)

        user.is_active = True
        user.save()

        # Buscar os dados pendentes
        cadastro = CadastroPrefeituraPendente.objects.filter(email=confirmacao.email).first()
        if not cadastro:
            return Response({"detail": "Cadastro pendente não encontrado."}, status=404)

        # Criar prefeitura
        prefeitura = Prefeitura.objects.create(
            usuario=user,
            nome=cadastro.nome,
            cnpj=cadastro.cnpj,
            responsavel=cadastro.responsavel,
            telefone=cadastro.telefone,
            email=cadastro.email,
            logradouro=cadastro.logradouro,
            endereco_numero=cadastro.endereco_numero,
            endereco_bairro=cadastro.endereco_bairro,
            endereco_cidade=cadastro.endereco_cidade,
            endereco_estado=cadastro.endereco_estado,
            endereco_cep=cadastro.endereco_cep,
        )

        # Salvar imagens se houver
        def salvar_imagem(base64_str):
            format, imgstr = base64_str.split(';base64,')
            ext = format.split('/')[-1]
            nome_arquivo = f"{uuid.uuid4()}.{ext}"
            return ContentFile(base64.b64decode(imgstr), name=nome_arquivo)

        if cadastro.logo_base64:
            prefeitura.logo = salvar_imagem(cadastro.logo_base64)
        if cadastro.brasao_base64:
            prefeitura.brasao = salvar_imagem(cadastro.brasao_base64)
        prefeitura.save()

        # 🔴 ESSENCIAL: vincular prefeitura ao usuário
        user.prefeitura = prefeitura
        user.save()

        # Criar licença
        plano = Plano.objects.get(pk=cadastro.plano_id)
        Licenca.objects.create(
            prefeitura=prefeitura,
            plano=plano,
            valor_mensal_atual=plano.preco_mensal,
            percentual_reajuste_anual=5.0,
            anos_contratados=cadastro.duracao_anos,
            usuarios_min=plano.usuarios_min,
            usuarios_max=plano.usuarios_max,
            sepultados_max=plano.sepultados_max,
            inclui_api=plano.inclui_api,
            inclui_erp=plano.inclui_erp,
            inclui_suporte_prioritario=plano.inclui_suporte_prioritario,
            data_inicio=timezone.now(),
        )

        # Apagar cadastro temporário
        cadastro.delete()

        return Response({"detail": "E-mail confirmado com sucesso. Prefeitura e licença criadas automaticamente."}, status=200)

    except EmailConfirmacao.DoesNotExist:
        return Response({"detail": "Token inválido ou inexistente."}, status=400)


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from sepultados_gestao.models import Prefeitura

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def usuario_logado(request):
    user = request.user
    prefeitura = Prefeitura.objects.filter(usuario=user).first()

    brasao_url = None
    if prefeitura and prefeitura.brasao and hasattr(prefeitura.brasao, 'url'):
        try:
            brasao_url = request.build_absolute_uri(prefeitura.brasao.url)
        except ValueError:
            brasao_url = None

    return Response({
        "usuario": {
            "nome": getattr(user, "nome", user.email),
            "email": user.email,
        },
        "prefeitura": {
            "id": prefeitura.id if prefeitura else None,
            "nome": prefeitura.nome if prefeitura else None,
            "logo_url": brasao_url,  # <- substitui o logo pela imagem realmente usada
        }
    })


from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from sepultados_gestao.models import Prefeitura
from .serializers import PrefeituraSerializer

class PrefeituraLogadaAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        prefeitura = Prefeitura.objects.filter(usuario=request.user).first()
        if not prefeitura:
            return Response({"detail": "Prefeitura não encontrada."}, status=404)

        serializer = PrefeituraSerializer(prefeitura)
        return Response(serializer.data)

    def put(self, request):
        prefeitura = Prefeitura.objects.filter(usuario=request.user).first()
        if not prefeitura:
            return Response({"detail": "Prefeitura não encontrada."}, status=404)

        serializer = PrefeituraSerializer(prefeitura, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=400)


