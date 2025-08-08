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
    """
    - Se existir request.prefeitura_ativa, usa ela.
    - Caso contrário, aceita ?prefeitura=<id> na querystring.
    - Se nada disso existir, retorna queryset vazio.
    """
    prefeitura_field = "prefeitura"  # padrão

    def get_queryset(self):
        qs = self.queryset
        req = self.request

        if not req.user.is_authenticated:
            return qs.none()

        pref = getattr(req, "prefeitura_ativa", None)

        # Fallback: aceita ?prefeitura=ID
        if not pref:
            pref_id = req.query_params.get("prefeitura")
            if pref_id:
                try:
                    pref = Prefeitura.objects.get(pk=pref_id)
                except Prefeitura.DoesNotExist:
                    return qs.none()

        if not pref:
            return qs.none()

        return qs.filter(**{self.prefeitura_field: pref})
    
class ContextoRestritoQuerysetMixin:
    """
    Só filtra por cemitério se o ViewSet informar cemiterio_field.
    Caso contrário, usa o filtro por prefeitura (prefeitura_field).
    """
    cemiterio_field = None       # ex.: "cemiterio", "quadra__cemiterio", ...
    prefeitura_field = None      # ex.: "prefeitura", "cemiterio__prefeitura", ...

    def get_queryset(self):
        qs = self.queryset
        if not self.request.user.is_authenticated:
            return qs.none()

        cem_id = (self.request.query_params.get("cemiterio")
                  or self.request.session.get("cemiterio_ativo"))
        pref_id = self.request.query_params.get("prefeitura")
        if not pref_id:
            pref = getattr(self.request, "prefeitura_ativa", None)
            pref_id = getattr(pref, "id", None) if pref else None

        if cem_id and self.cemiterio_field:
            return qs.filter(**{self.cemiterio_field: cem_id})

        if pref_id and self.prefeitura_field:
            return qs.filter(**{self.prefeitura_field: pref_id})

        return qs.none()



# ✅ Cemitérios – mantém como está (filtra só por prefeitura)
class CemiterioViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Cemiterio.objects.all()
    serializer_class = CemiterioSerializer
    prefeitura_field = "prefeitura"

    def get_queryset(self):
        qs = super().get_queryset()
        if not qs.exists():
            pref_id = self.request.query_params.get("prefeitura")
            if pref_id:
                return Cemiterio.objects.filter(prefeitura_id=pref_id)
        return qs

    def perform_create(self, serializer):
        pref = getattr(self.request, "prefeitura_ativa", None)
        if not pref:
            pref_id = self.request.query_params.get("prefeitura")
            if pref_id:
                from .models import Prefeitura
                pref = Prefeitura.objects.filter(pk=pref_id).first()
        serializer.save(prefeitura=pref)


# ✅ Quadras – agora filtra por cemitério se houver
class QuadraViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Quadra.objects.all()
    serializer_class = QuadraSerializer
    cemiterio_field = "cemiterio"
    prefeitura_field = "cemiterio__prefeitura"


# ✅ Túmulos
class TumuloViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Tumulo.objects.all()
    serializer_class = TumuloSerializer
    cemiterio_field = "quadra__cemiterio"
    prefeitura_field = "quadra__cemiterio__prefeitura"


# ✅ Sepultados
class SepultadoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Sepultado.objects.all()
    serializer_class = SepultadoSerializer
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"


# ✅ Contratos de concessão
class ConcessaoContratoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = ConcessaoContrato.objects.all()
    serializer_class = ConcessaoContratoSerializer
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"


# ✅ Exumações
class ExumacaoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Exumacao.objects.all()
    serializer_class = ExumacaoSerializer
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"


# ✅ Translados
class TransladoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Translado.objects.all()
    serializer_class = TransladoSerializer
    cemiterio_field = "tumulo_destino__quadra__cemiterio"
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
from django.template.loader import render_to_string  # ✅ correto
from datetime import date
import uuid

User = get_user_model()

class RegistrarPrefeituraAPIView(APIView):
    permission_classes = []

    def enviar_email_confirmacao(self, usuario):
        """
        Envia e-mail com LINK de confirmação (NÃO é a página de 'confirmado').
        Usa o template: emails/email_confirmacao_usuario.html
        """
        token = uuid.uuid4()

        EmailConfirmacao.objects.update_or_create(
            email=usuario.email,
            defaults={
                'token': token,
                'criado_em': timezone.now(),
                'usado': False,
            }
        )

        link = f"{settings.FRONTEND_URL}/verificar-email/{token}"

        html_content = render_to_string(
            "emails/email_confirmacao_usuario.html",
            {
                "usuario": usuario,
                "link": link,
                "ano_atual": date.today().year,
            }
        )

        send_mail(
            subject="Confirmação de E-mail - Sepultados.com",
            message=f"Confirme seu e-mail acessando: {link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[usuario.email],
            html_message=html_content,
            fail_silently=False,
        )

    def post(self, request):
        try:
            with transaction.atomic():
                dados = request.data

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
                    "plano_id": int(dados.get("plano_id")) if dados.get("plano_id") else None,
                    "duracao_anos": int(dados.get("duracao_anos", 1)),
                    "logo_base64": dados.get("logo_base64"),
                    "brasao_base64": dados.get("brasao_base64"),
                }

                obrigatorios = ["nome","cnpj","responsavel","telefone","email","senha",
                                "logradouro","endereco_numero","endereco_cidade",
                                "endereco_estado","endereco_cep","plano_id"]
                if not all(campos[k] for k in obrigatorios):
                    return Response({"detail": "Todos os campos obrigatórios devem ser preenchidos."}, status=400)

                # Se já existe um usuário ATIVO com esse e-mail, bloqueia
                if User.objects.filter(email=campos["email"], is_active=True).exists():
                    return Response({"detail": "Já existe um usuário ativo com esse e-mail."}, status=400)

                # Salva/atualiza o cadastro pendente
                CadastroPrefeituraPendente.objects.update_or_create(
                    email=campos["email"],
                    defaults=campos
                )

                # Garante usuário INATIVO (cria se não existir)
                user = User.objects.filter(email=campos["email"]).first()
                if not user:
                    user = User.objects.create_user(
                        email=campos["email"],
                        password=campos["senha"],
                        is_active=False,
                        is_staff=True,
                    )
                else:
                    # Se já existia, assegura desativado até confirmar
                    if user.is_active:
                        user.is_active = False
                        user.save(update_fields=["is_active"])

                # Envia o e-mail de confirmação (template correto)
                self.enviar_email_confirmacao(user)

                return Response({"detail": "Enviamos um e-mail para confirmação. Verifique sua caixa de entrada."}, status=200)

        except Exception as e:
            # Log simples no retorno para você ver no front
            return Response({"detail": f"Erro: {e}"}, status=500)



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


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response  # ✅ faltava
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status

from .models import Licenca
from .serializers import LicencaSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def licenca_da_prefeitura(request, prefeitura_id):
    # bloqueia acesso se não for da mesma prefeitura (exceto staff/superuser)
    if not (request.user.is_superuser or request.user.is_staff):
        if getattr(request.user, "prefeitura_id", None) != prefeitura_id:
            return Response({"detail": "Proibido."}, status=status.HTTP_403_FORBIDDEN)

    agora = timezone.now()
    licenca = (
        Licenca.objects
        .filter(prefeitura_id=prefeitura_id, data_inicio__lte=agora)
        .order_by('-data_inicio')
        .first()
    )
    if not licenca:
        return Response({"detail": "Licença não encontrada."}, status=status.HTTP_404_NOT_FOUND)

    serializer = LicencaSerializer(licenca)
    return Response(serializer.data, status=status.HTTP_200_OK)




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

        # Criar licença com debug
        plano = Plano.objects.get(pk=cadastro.plano_id)
        print(f"Plano selecionado: {plano.nome}, usuários_max = {plano.usuarios_max}")

        licenca = Licenca.objects.create(
            prefeitura=prefeitura,
            plano=plano,
            valor_mensal_atual=plano.preco_mensal,
            percentual_reajuste_anual=5.0,
            anos_contratados=cadastro.duracao_anos,
            usuarios_min=plano.usuarios_min,
            usuarios_max=plano.usuarios_max,  # vamos validar se vem certo aqui
            sepultados_max=plano.sepultados_max,
            inclui_api=plano.inclui_api,
            inclui_erp=plano.inclui_erp,
            inclui_suporte_prioritario=plano.inclui_suporte_prioritario,
            data_inicio=timezone.now(),
        )

        print(f"Licença salva com usuarios_max = {licenca.usuarios_max}")


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

    # Suporte a master (prefeitura.usuario) e usuário normal (usuario.prefeitura)
    prefeitura = getattr(user, "prefeitura", None)
    if not prefeitura:
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
            "logo_url": brasao_url,
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

    def patch(self, request):
        prefeitura = Prefeitura.objects.filter(usuario=request.user).first()
        if not prefeitura:
            return Response({"detail": "Prefeitura não encontrada."}, status=404)

        serializer = PrefeituraSerializer(prefeitura, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        print(serializer.errors)  # 👈 Adicione esta linha
        return Response(serializer.errors, status=400)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class CemiterioLogadoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cem_id = request.session.get("cemiterio_ativo")
        cem = Cemiterio.objects.filter(id=cem_id).first() if cem_id else None
        data = CemiterioSerializer(cem).data if cem else None
        return Response(data)

    def post(self, request):
        cem_id = request.data.get("cemiterio")
        if not cem_id:
            return Response({"detail": "Campo 'cemiterio' obrigatório."}, status=400)

        # opcional: garantir que é da prefeitura ativa
        pref = getattr(request, "prefeitura_ativa", None)
        qs = Cemiterio.objects.all()
        if pref:
            qs = qs.filter(prefeitura=pref)

        cem = qs.filter(id=cem_id).first()
        if not cem:
            return Response({"detail": "Cemitério inválido."}, status=400)

        request.session["cemiterio_ativo"] = cem.id
        return Response({"ok": True})

