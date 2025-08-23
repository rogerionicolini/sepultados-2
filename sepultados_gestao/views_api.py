    # sepultados_gestao/views_api.py
from datetime import date
import uuid
import base64

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import send_mail
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Anexo
from .serializers import AnexoSerializer
from django.contrib.contenttypes.models import ContentType

from rest_framework import mixins
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError, PermissionDenied


from .models import (
    Prefeitura,
    Cemiterio,
    ConcessaoContrato,
    Exumacao,
    Quadra,
    Receita,
    RegistroAuditoria,
    Sepultado,
    Translado,
    Tumulo,
    EmailConfirmacao,
    CadastroPrefeituraPendente,
    Plano,
    Licenca,
)
from .serializers import (
    PrefeituraSerializer,
    PlanoSerializer,
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

# Tenta importar a função que gera o PDF do túmulo (ajuste o caminho se necessário)
try:
    # Ex.: arquivo sepultados_gestao/relatorios/tumulo.py com função build_tumulo_pdf(tumulo) -> bytes
    from .relatorios.tumulo import build_tumulo_pdf  # <-- AJUSTE se o caminho for outro
except Exception:
    build_tumulo_pdf = None


# ===========================
# MIXINS DE FILTRAGEM
# ===========================
class PrefeituraRestritaQuerysetMixin:
    """
    - Se existir request.prefeitura_ativa, usa ela.
    - Caso contrário, aceita ?prefeitura=<id> na querystring.
    - Se nada disso existir, retorna queryset vazio.
    """
    prefeitura_field = "prefeitura"  # nome do campo FK para Prefeitura

    def get_queryset(self):
        qs = self.queryset
        req = self.request

        if not req.user.is_authenticated:
            return qs.none()

        pref = getattr(req, "prefeitura_ativa", None)
        if not pref:
            pref_id = req.query_params.get("prefeitura")
            if pref_id:
                pref = Prefeitura.objects.filter(pk=pref_id).first()

        if not pref:
            return qs.none()

        # aceita objeto ou id; se seu campo for *_id, troque para f"{self.prefeitura_field}_id"
        return qs.filter(**{self.prefeitura_field: pref})


class ContextoRestritoQuerysetMixin:
    """
    Filtra por cemitério (se informado `cemiterio_field` e houver `cemiterio` na query/sessão)
    ou então por prefeitura (se informado `prefeitura_field`).
    Se nada disso existir, retorna vazio.
    """
    cemiterio_field = None       # ex.: "cemiterio", "quadra__cemiterio"
    prefeitura_field = None      # ex.: "prefeitura", "cemiterio__prefeitura"

    def get_queryset(self):
        qs = self.queryset
        req = self.request

        if not req.user.is_authenticated:
            return qs.none()

        cem_id = req.query_params.get("cemiterio") or req.session.get("cemiterio_ativo")

        pref_id = req.query_params.get("prefeitura")
        if not pref_id:
            pref = getattr(req, "prefeitura_ativa", None)
            pref_id = getattr(pref, "id", None) if pref else None

        if cem_id and self.cemiterio_field:
            return qs.filter(**{self.cemiterio_field: cem_id})

        if pref_id and self.prefeitura_field:
            return qs.filter(**{self.prefeitura_field: pref_id})

        return qs.none()


# ===========================
# VIEWSETS PRINCIPAIS
# ===========================
class CemiterioViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Cemiterio.objects.all()
    serializer_class = CemiterioSerializer
    prefeitura_field = "prefeitura"
    permission_classes = [IsAuthenticated]

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
                pref = Prefeitura.objects.filter(pk=pref_id).first()
        serializer.save(prefeitura=pref)


class QuadraViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Quadra.objects.all()
    serializer_class = QuadraSerializer
    cemiterio_field = "cemiterio"
    prefeitura_field = "cemiterio__prefeitura"
    permission_classes = [IsAuthenticated]


# --- INÍCIO: trecho para colar no views_api.py ---

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Tumulo
from .serializers import TumuloSerializer

# Importa a MESMA view de PDF usada no admin (no seu views.py)
from .views import gerar_pdf_sepultados_tumulo as pdf_view
from django.db.models import Exists, OuterRef, Subquery


class TumuloViewSet(viewsets.ModelViewSet):
    """
    ViewSet dos Túmulos com:
      - filtro por quadra/cemitério/prefeitura (via querystring ou sessão)
      - action GET /api/tumulos/<id>/pdf_sepultados/ para abrir o mesmo PDF do admin
    """
    queryset = Tumulo.objects.all()
    serializer_class = TumuloSerializer
    permission_classes = [IsAuthenticated]

    _cemiterio_field = "quadra__cemiterio_id"
    _prefeitura_field = "quadra__cemiterio__prefeitura_id"

    def _to_int(self, v):
        try:
            return int(v)
        except Exception:
            return None

    def _context_ids(self, request):
        """Coleta ids de contexto; querystring tem prioridade sobre sessão."""
        pref_qs   = request.query_params.get("prefeitura") or request.query_params.get("prefeitura_id")
        cem_qs    = request.query_params.get("cemiterio")  or request.query_params.get("cemiterio_id")
        quadra_qs = request.query_params.get("quadra")     or request.query_params.get("quadra_id")

        pref_sess = request.session.get("prefeitura_ativa_id")
        cem_sess  = request.session.get("cemiterio_ativo")

        pref_id   = self._to_int(pref_qs)   or self._to_int(pref_sess)
        cem_id    = self._to_int(cem_qs)    or self._to_int(cem_sess)
        quadra_id = self._to_int(quadra_qs)

        return pref_id, cem_id, quadra_id

    def get_queryset(self):
        qs = super().get_queryset().select_related("quadra", "quadra__cemiterio")
        if not self.request.user.is_authenticated:
            return qs.none()

        pref_id, cem_id, quadra_id = self._context_ids(self.request)

        # PRIORIDADE: quadra > cemitério > prefeitura
        if quadra_id:
            qs = qs.filter(quadra_id=quadra_id)
        elif cem_id:
            qs = qs.filter(**{self._cemiterio_field: cem_id})
        elif pref_id:
            qs = qs.filter(**{self._prefeitura_field: pref_id})
        else:
            return qs.none()

        # 👇 Anota se há contrato e pega o 1º contrato (número/id) para exibir na lista
        contrato_qs = ConcessaoContrato.objects.filter(tumulo_id=OuterRef("pk")).order_by("-id")
        qs = qs.annotate(
            tem_contrato_ativo=Exists(contrato_qs),
            contrato_id=Subquery(contrato_qs.values("id")[:1]),
            contrato_numero=Subquery(contrato_qs.values("numero_contrato")[:1]),
        )

        return qs


    @action(detail=True, methods=["get"], url_path="pdf_sepultados")
    def pdf_sepultados(self, request, pk=None):
        """
        Abre o mesmo PDF do admin.
        Ex.: GET /api/tumulos/<id>/pdf_sepultados/?cemiterio=<id>&prefeitura=<id>
        """
        tumulo = get_object_or_404(
            Tumulo.objects.select_related("quadra", "quadra__cemiterio"), pk=pk
        )

        pref_id, cem_id, _ = self._context_ids(request)
        if cem_id and str(tumulo.quadra.cemiterio_id) != str(cem_id):
            return Response({"detail": "Acesso negado para este túmulo (cemitério)."}, status=403)
        if pref_id and str(tumulo.quadra.cemiterio.prefeitura_id) != str(pref_id):
            return Response({"detail": "Acesso negado para este túmulo (prefeitura)."}, status=403)

        try:
            return pdf_view(request._request, tumulo_pk=tumulo.pk)
        except TypeError:
            try:
                return pdf_view(request._request, pk=tumulo.pk)
            except TypeError:
                try:
                    return pdf_view(request._request, id=tumulo.pk)
                except TypeError as e:
                    return Response(
                        {"detail": f"Assinatura inesperada da view de PDF: {e}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
        except Exception as e:
            return Response({"detail": f"Erro ao gerar PDF: {e}"}, status=500)



# views_api.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.authentication import JWTAuthentication

from .views import gerar_guia_sepultamento_pdf  # <- função correta do views.py

class SepultadoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Sepultado.objects.all()
    serializer_class = SepultadoSerializer
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .select_related("tumulo", "tumulo__quadra", "tumulo__quadra__cemiterio")
            .order_by("-data_sepultamento", "-id")
        )
        # filtro específico do túmulo passado na query (?tumulo=ID)
        tumulo_id = self.request.query_params.get("tumulo")
        if tumulo_id:
            qs = qs.filter(tumulo_id=tumulo_id)
        return qs

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """
        /api/sepultados/<id>/pdf/?cemiterio=<id>
        Gera a mesma 'Guia de Sepultamento' usada no admin.
        """
        sep = get_object_or_404(Sepultado, pk=pk)

        # a função do seu views.py aceita 'pk'
        try:
            return gerar_guia_sepultamento_pdf(request._request, pk=sep.pk)
        except TypeError:
            # fallback caso em algum ambiente ela espere outro nome de argumento
            return gerar_guia_sepultamento_pdf(request._request, sepultado_pk=sep.pk)




# views_api.py
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from .models import ConcessaoContrato
from .serializers import ConcessaoContratoSerializer

class ConcessaoContratoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = ConcessaoContrato.objects.all()
    serializer_class = ConcessaoContratoSerializer

    # campos usados pelo mixin para restringir por cemitério/prefeitura via querystring
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"

    permission_classes = [IsAuthenticated]

    def _prefeitura_from_request_or_tumulo(self, validated_data):
        """
        Resolve a prefeitura primeiro pela requisição (prefeitura_ativa ou user.prefeitura),
        e como fallback pela FK do túmulo enviado.
        """
        pref = getattr(self.request, "prefeitura_ativa", None) or getattr(self.request.user, "prefeitura", None)
        if pref:
            return pref
        tumulo = validated_data.get("tumulo")
        if tumulo and getattr(tumulo, "quadra", None) and getattr(tumulo.quadra, "cemiterio", None):
            return tumulo.quadra.cemiterio.prefeitura
        return None

    def perform_create(self, serializer):
        """
        Cria a instância SEM persistir, roda full_clean() (clean do model e validadores de campo),
        e só então salva dentro de transação. Injeta prefeitura e usuario_registro no servidor.
        """
        validated = dict(serializer.validated_data)
        pref = self._prefeitura_from_request_or_tumulo(validated)
        if not pref:
            raise ValidationError({"detail": "Não foi possível determinar a prefeitura para este contrato."})

        instance = ConcessaoContrato(**validated)
        instance.prefeitura = pref
        instance.usuario_registro = self.request.user

        try:
            instance.full_clean()
            with transaction.atomic():
                instance.save()
        except DjangoValidationError as e:
            # Converte ValidationError do Django em erro do DRF (400) com mapeamento por campo
            raise ValidationError(e.message_dict or {"detail": e.messages})

        serializer.instance = instance

    def perform_update(self, serializer):
        """
        Atualiza a instância existente, roda full_clean() e salva em transação.
        Injeta prefeitura e usuario_registro no servidor.
        """
        instance = self.get_object()
        validated = dict(serializer.validated_data)
        pref = self._prefeitura_from_request_or_tumulo(validated)
        if not pref:
            raise ValidationError({"detail": "Não foi possível determinar a prefeitura para este contrato."})

        for k, v in validated.items():
            setattr(instance, k, v)
        instance.prefeitura = pref
        instance.usuario_registro = self.request.user

        try:
            instance.full_clean()
            with transaction.atomic():
                instance.save()
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict or {"detail": e.messages})

    def perform_destroy(self, instance):
        """
        Exclui traduzindo erros de negócio do model (ex.: receitas/sepultados vinculados)
        em ValidationError do DRF (400). Lembre-se: o get_object() já respeita o filtro
        do mixin (precisa do ?cemiterio=<id> na chamada).
        """
        try:
            with transaction.atomic():
                instance.delete()
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict or {"detail": e.messages})



# views_api.py
from datetime import date
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from django.db.models import Q

class ExumacaoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Exumacao.objects.all().select_related(
        "sepultado", "tumulo", "tumulo__quadra", "tumulo__quadra__cemiterio"
    )
    serializer_class = ExumacaoSerializer
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"
    permission_classes = [IsAuthenticated]

    def _prefeitura_from_request_or_relations(self, validated):
        pref = getattr(self.request, "prefeitura_ativa", None) or getattr(self.request.user, "prefeitura", None)
        if pref:
            return pref
        tum = validated.get("tumulo")
        if tum and getattr(tum, "quadra", None) and getattr(tum.quadra, "cemiterio", None):
            return tum.quadra.cemiterio.prefeitura
        sep = validated.get("sepultado")
        if sep and getattr(sep, "tumulo", None) and getattr(sep.tumulo, "quadra", None):
            return sep.tumulo.quadra.cemiterio.prefeitura
        return None

    # também lista por cemitério do sepultado se necessário
    def get_queryset(self):
        qs = super().get_queryset()
        cem = self.request.query_params.get("cemiterio")
        if cem:
            qs = qs.filter(
                Q(tumulo__quadra__cemiterio_id=cem) |
                Q(sepultado__tumulo__quadra__cemiterio_id=cem)
            )
        return qs

    def _normalize_validated(self, validated):
        # herda tumulo do sepultado se não veio
        sep = validated.get("sepultado")
        if not validated.get("tumulo") and sep and getattr(sep, "tumulo", None):
            validated["tumulo"] = sep.tumulo

        # limpa hífen de número de documento
        nd = validated.get("numero_documento")
        if nd == "-" or nd == "":
            validated.pop("numero_documento", None)

        return validated

    def perform_create(self, serializer):
        validated = self._normalize_validated(dict(serializer.validated_data))
        pref = self._prefeitura_from_request_or_relations(validated)
        if not pref:
            raise ValidationError({"detail": "Não foi possível determinar a prefeitura."})

        instance = Exumacao(**validated)
        instance.prefeitura = pref
        instance.usuario_registro = self.request.user

        # default para data, se o model exigir
        if getattr(instance, "data", None) in (None, ""):
            try:
                instance._meta.get_field("data")  # só se o campo existir
                instance.data = date.today()
            except Exception:
                pass

        try:
            instance.full_clean()
            with transaction.atomic():
                instance.save()
        except DjangoValidationError as e:
            # devolve erros por campo (o front consegue exibir)
            raise ValidationError(e.message_dict or {"detail": e.messages})
        serializer.instance = instance

    def perform_update(self, serializer):
        instance = self.get_object()
        validated = self._normalize_validated(dict(serializer.validated_data))
        pref = self._prefeitura_from_request_or_relations(validated)
        if not pref:
            raise ValidationError({"detail": "Não foi possível determinar a prefeitura."})

        for k, v in validated.items():
            setattr(instance, k, v)
        instance.prefeitura = pref
        instance.usuario_registro = self.request.user

        if getattr(instance, "data", None) in (None, ""):
            try:
                instance._meta.get_field("data")
                instance.data = date.today()
            except Exception:
                pass

        try:
            instance.full_clean()
            with transaction.atomic():
                instance.save()
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict or {"detail": e.messages})



class TransladoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Translado.objects.all()
    serializer_class = TransladoSerializer
    cemiterio_field = "tumulo_destino__quadra__cemiterio"
    prefeitura_field = "tumulo_destino__quadra__cemiterio__prefeitura"
    permission_classes = [IsAuthenticated]


class ReceitaViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Receita.objects.all()
    serializer_class = ReceitaSerializer
    prefeitura_field = "prefeitura"
    permission_classes = [IsAuthenticated]


class RegistroAuditoriaViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = RegistroAuditoria.objects.all()
    serializer_class = RegistroAuditoriaSerializer
    prefeitura_field = "prefeitura"
    permission_classes = [IsAuthenticated]


# ===========================
# FLUXO DE CADASTRO/EMAIL
# ===========================
User = get_user_model()

class RegistrarPrefeituraAPIView(APIView):
    permission_classes = []

    def enviar_email_confirmacao(self, usuario):
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

        from django.template.loader import render_to_string
        html_content = render_to_string(
            "emails/email_confirmacao_usuario.html",
            {"usuario": usuario, "link": link, "ano_atual": date.today().year}
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
            from django.db import transaction
            with transaction.atomic():
                d = request.data
                campos = {
                    "nome": d.get("nome"),
                    "cnpj": d.get("cnpj"),
                    "responsavel": d.get("responsavel"),
                    "telefone": d.get("telefone"),
                    "email": d.get("email"),
                    "senha": d.get("senha"),
                    "logradouro": d.get("logradouro"),
                    "endereco_numero": d.get("endereco_numero"),
                    "endereco_bairro": d.get("endereco_bairro"),
                    "endereco_cidade": d.get("endereco_cidade"),
                    "endereco_estado": d.get("endereco_estado"),
                    "endereco_cep": d.get("endereco_cep"),
                    "plano_id": int(d.get("plano_id")) if d.get("plano_id") else None,
                    "duracao_anos": int(d.get("duracao_anos", 1)),
                    "logo_base64": d.get("logo_base64"),
                    "brasao_base64": d.get("brasao_base64"),
                }

                obrig = ["nome","cnpj","responsavel","telefone","email","senha",
                         "logradouro","endereco_numero","endereco_cidade",
                         "endereco_estado","endereco_cep","plano_id"]
                if not all(campos[k] for k in obrig):
                    return Response({"detail": "Todos os campos obrigatórios devem ser preenchidos."}, status=400)

                if User.objects.filter(email=campos["email"], is_active=True).exists():
                    return Response({"detail": "Já existe um usuário ativo com esse e-mail."}, status=400)

                CadastroPrefeituraPendente.objects.update_or_create(
                    email=campos["email"], defaults=campos
                )

                user = User.objects.filter(email=campos["email"]).first()
                if not user:
                    user = User.objects.create_user(
                        email=campos["email"], password=campos["senha"],
                        is_active=False, is_staff=True
                    )
                else:
                    if user.is_active:
                        user.is_active = False
                        user.save(update_fields=["is_active"])

                self.enviar_email_confirmacao(user)

                return Response({"detail": "Enviamos um e-mail para confirmação. Verifique sua caixa de entrada."}, status=200)

        except Exception as e:
            return Response({"detail": f"Erro: {e}"}, status=500)


class ListaPlanosAPIView(APIView):
    permission_classes = []

    def get(self, request):
        planos = Plano.objects.all().order_by('preco_mensal')
        serializer = PlanoSerializer(planos, many=True)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def licenca_da_prefeitura(request, prefeitura_id):
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

    from .serializers import LicencaSerializer
    serializer = LicencaSerializer(licenca)
    return Response(serializer.data, status=status.HTTP_200_OK)


def enviar_email_confirmacao(email):
    token = uuid.uuid4()

    EmailConfirmacao.objects.update_or_create(
        email=email,
        defaults={'token': token, 'criado_em': timezone.now(), 'usado': False}
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
        message=f"Olá! Confirme seu e-mail clicando neste link: {link}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        html_message=html_content,
        fail_silently=False,
    )


@api_view(['GET'])
def verificar_email(request, token):
    try:
        confirmacao = EmailConfirmacao.objects.get(token=token)

        if confirmacao.usado:
            return Response({"detail": "Este link já foi utilizado."}, status=400)

        confirmacao.usado = True
        confirmacao.save()

        user = User.objects.filter(email=confirmacao.email).first()
        if not user:
            return Response({"detail": "Usuário não encontrado para este e-mail."}, status=404)

        user.is_active = True
        user.save()

        cadastro = CadastroPrefeituraPendente.objects.filter(email=confirmacao.email).first()
        if not cadastro:
            return Response({"detail": "Cadastro pendente não encontrado."}, status=404)

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

        # vincula prefeitura ao usuário
        user.prefeitura = prefeitura
        user.save()

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

        cadastro.delete()

        return Response({"detail": "E-mail confirmado com sucesso. Prefeitura e licença criadas automaticamente."}, status=200)

    except EmailConfirmacao.DoesNotExist:
        return Response({"detail": "Token inválido ou inexistente."}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def usuario_logado(request):
    user = request.user
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
        "usuario": {"nome": getattr(user, "nome", user.email), "email": user.email},
        "prefeitura": {
            "id": prefeitura.id if prefeitura else None,
            "nome": prefeitura.nome if prefeitura else None,
            "logo_url": brasao_url,
        }
    })


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
        return Response(serializer.errors, status=400)


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

        pref = getattr(request, "prefeitura_ativa", None)
        qs = Cemiterio.objects.all()
        if pref:
            qs = qs.filter(prefeitura=pref)

        cem = qs.filter(id=cem_id).first()
        if not cem:
            return Response({"detail": "Cemitério inválido."}, status=400)

        request.session["cemiterio_ativo"] = cem.id
        return Response({"ok": True})


def _prefeitura_id_from_obj(obj):
    try:
        # 1) objeto com FK direta
        if hasattr(obj, "prefeitura_id") and obj.prefeitura_id:
            return obj.prefeitura_id
        # 2) via túmulo -> quadra -> cemitério
        t = getattr(obj, "tumulo", None)
        if t and getattr(t, "quadra", None) and getattr(t.quadra, "cemiterio", None):
            return t.quadra.cemiterio.prefeitura_id
        # 3) objetos que tenham cemiterio direto
        if getattr(obj, "cemiterio", None):
            return obj.cemiterio.prefeitura_id
    except Exception:
        pass
    return None


class AnexoViewSet(mixins.ListModelMixin,
                   mixins.CreateModelMixin,
                   mixins.DestroyModelMixin,
                   viewsets.GenericViewSet):
    queryset = Anexo.objects.all().order_by("-data_upload")
    serializer_class = AnexoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def _parse_ct(self, s: str) -> ContentType:
        try:
            app_label, model = s.split(".", 1)
            return ContentType.objects.get(app_label=app_label, model=model)
        except Exception:
            raise ValidationError({"content_type": "Use app_label.model (ex.: sepultados_gestao.sepultado)."})

    def _check_scope(self, ct: ContentType, obj_id: str):
        try:
            obj = ct.get_object_for_this_type(id=int(obj_id))
        except Exception:
            raise ValidationError({"object_id": "Objeto não encontrado."})

        pref_ativa = getattr(self.request, "prefeitura_ativa", None)
        pref_ativa_id = getattr(pref_ativa, "id", None)
        obj_pref_id = _prefeitura_id_from_obj(obj)

        if pref_ativa_id and obj_pref_id and str(pref_ativa_id) != str(obj_pref_id):
            raise PermissionDenied("Sem permissão para anexos deste registro.")
        return obj

    def get_queryset(self):
        qs = super().get_queryset()
        ct_param = self.request.query_params.get("ct") or self.request.query_params.get("content_type")
        obj_id = self.request.query_params.get("object_id")
        if not (ct_param and obj_id):
            return qs.none()
        ct = self._parse_ct(ct_param)
        self._check_scope(ct, obj_id)  # valida escopo
        return qs.filter(content_type=ct, object_id=int(obj_id))

    def perform_create(self, serializer):
        ct_param = self.request.data.get("content_type") or self.request.data.get("ct")
        obj_id = self.request.data.get("object_id")
        if not (ct_param and obj_id):
            raise ValidationError("content_type e object_id são obrigatórios.")
        ct = self._parse_ct(ct_param)
        self._check_scope(ct, obj_id)  # valida escopo
        serializer.save(content_type=ct, object_id=int(obj_id))

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_scope(instance.content_type, instance.object_id)
        return super().destroy(request, *args, **kwargs)

    def get_object(self):
        # Busca direto por PK para não depender do get_queryset() com ct/object_id
        obj = get_object_or_404(Anexo, pk=self.kwargs["pk"])
        # valida escopo (prefeitura) antes de devolver
        self._check_scope(obj.content_type, obj.object_id)
        return obj


# sepultados_gestao/views_api.py
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny  # <- AllowAny opcional em dev
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
import pandas as pd

from .models import Quadra, Tumulo, Sepultado

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication
from django.db import transaction
from .utils import gerar_numero_sequencial_global


class BaseImportAPIView(APIView):
    authentication_classes = (JWTAuthentication, SessionAuthentication)
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def _get_cemiterio_id(self, request):
        # 1) querystring: ?cemiterio=<id> ou ?cemiterio_id=<id>
        cid = request.query_params.get("cemiterio") or request.query_params.get("cemiterio_id")
        if cid:
            try:
                return int(cid)
            except Exception:
                pass
        # 2) form-data: cemiterio_id
        cid = request.data.get("cemiterio") or request.data.get("cemiterio_id")
        if cid:
            try:
                return int(cid)
            except Exception:
                pass
        # 3) sessão
        return request.session.get("cemiterio_ativo_id")  # <- chave correta

    def _read_dataframe(self, arquivo):
        nome = arquivo.name.lower()
        if nome.endswith(".csv"):
            return pd.read_csv(arquivo)
        if nome.endswith(".xls") or nome.endswith(".xlsx"):
            return pd.read_excel(arquivo)
        raise ValueError("Formato de arquivo não suportado. Use .csv, .xls ou .xlsx.")


class ImportQuadrasAPIView(BaseImportAPIView):
    """ Espera coluna: codigo """
    def post(self, request):
        if "arquivo" not in request.FILES:
            return Response({"detail": "Envie o arquivo em 'arquivo'."}, status=400)

        cemiterio_id = self._get_cemiterio_id(request)
        if not cemiterio_id:
            return Response({"detail": "Defina o cemitério (?cemiterio=) ou selecione no sistema."}, status=400)

        try:
            df = self._read_dataframe(request.FILES["arquivo"])
        except Exception as e:
            return Response({"detail": f"Erro ao ler planilha: {e}"}, status=400)

        total, erros = 0, []
        for idx, linha in df.iterrows():
            try:
                codigo = str(linha.get("codigo") or linha.get(0) or "").strip()
                if not codigo:
                    continue
                Quadra.objects.create(codigo=codigo, cemiterio_id=cemiterio_id)
                total += 1
            except Exception as e:
                erros.append(f"Linha {idx+2}: {e}")

        return Response({"importados": total, "erros": erros}, status=200)


class ImportTumulosAPIView(BaseImportAPIView):
    MAPA_TIPO = {
        "túmulo": "tumulo", "tumulo": "tumulo",
        "perpétua": "perpetua", "perpetua": "perpetua",
        "sepultura": "sepultura", "jazigo": "jazigo", "outro": "outro"
    }

    def post(self, request):
        if "arquivo" not in request.FILES:
            return Response({"detail": "Envie o arquivo em 'arquivo'."}, status=400)

        cemiterio_id = self._get_cemiterio_id(request)
        if not cemiterio_id:
            return Response({"detail": "Defina o cemitério (?cemiterio=) ou selecione no sistema."}, status=400)

        try:
            df = self._read_dataframe(request.FILES["arquivo"])
        except Exception as e:
            return Response({"detail": f"Erro ao ler planilha: {e}"}, status=400)

        total, erros = 0, []
        for i, r in df.iterrows():
            try:
                quadra_codigo = str(r.get("quadra_codigo")).strip()
                ident        = str(r.get("identificador")).strip()
                tipo_raw     = str(r.get("tipo_estrutura") or "").strip().lower()
                tipo         = self.MAPA_TIPO.get(tipo_raw, "tumulo")
                capacidade   = int(float(r.get("capacidade"))) if pd.notna(r.get("capacidade")) else 1
                usar_linha   = str(r.get("usar_linha") or "").strip().lower() in ("sim","s","true","1")
                linha        = int(r.get("linha")) if usar_linha and pd.notna(r.get("linha")) else None

                quadra_id = Quadra.objects.filter(
                    codigo__iexact=quadra_codigo,
                    cemiterio_id=cemiterio_id
                ).values_list("id", flat=True).first()

                if not quadra_id:
                    erros.append(f"Linha {i+2}: Quadra '{quadra_codigo}' não encontrada para este cemitério.")
                    continue

                # ✅ AQUI vai o cemiterio_id
                obj, created = Tumulo.objects.get_or_create(
                    cemiterio_id=cemiterio_id,
                    quadra_id=quadra_id,
                    identificador=ident,
                    defaults={
                        "tipo_estrutura": tipo,
                        "capacidade": capacidade,
                        "usar_linha": usar_linha,
                        "linha": linha,
                        "reservado": False,
                        "status": "disponivel",  # ajuste ao seu choices
                    }
                )
                if not created:
                    # opcional: atualizar campos se já existir
                    obj.tipo_estrutura = tipo
                    obj.capacidade     = capacidade
                    obj.usar_linha     = usar_linha
                    obj.linha          = linha
                    obj.save(update_fields=["tipo_estrutura", "capacidade", "usar_linha", "linha"])
                total += 1

            except Exception as e:
                erros.append(f"Linha {i+2}: {e}")

        return Response({"importados": total, "erros": erros}, status=200)



class ImportSepultadosAPIView(BaseImportAPIView):
    """
    Importa sepultados SEM exigir contrato (somente via importação).
    Gera o número global de sepultamento como no admin (save + fallback).
    Colunas principais esperadas:
      identificador_tumulo, quadra, usar_linha, linha, nome,
      data_falecimento, data_sepultamento, cpf_sepultado, data_nascimento, sexo,
      local_nascimento, local_falecimento, nome_pai, nome_mae
    """
    def post(self, request):
        if "arquivo" not in request.FILES:
            return Response({"detail": "Envie o arquivo em 'arquivo'."}, status=400)

        cemiterio_id = self._get_cemiterio_id(request)
        if not cemiterio_id:
            return Response({"detail": "Defina o cemitério (?cemiterio=) ou selecione no sistema."}, status=400)

        try:
            df = self._read_dataframe(request.FILES["arquivo"])
        except Exception as e:
            return Response({"detail": f"Erro ao ler planilha: {e}"}, status=400)

        # util de data seguro
        def _date(v):
            try:
                if pd.isna(v) or v is None or str(v).strip() == "":
                    return None
                d = pd.to_datetime(v, dayfirst=True, errors="coerce")
                return None if pd.isna(d) else d.date()
            except Exception:
                return None

        importados = 0
        erros = []
        tumulos_usados = set()

        for i, row in df.iterrows():
            try:
                quadra_codigo = str(row.get("quadra") or "").strip()
                ident_tumulo  = str(row.get("identificador_tumulo") or "").strip()
                if not quadra_codigo or not ident_tumulo:
                    continue

                quadra_id = Quadra.objects.filter(
                    codigo__iexact=quadra_codigo,
                    cemiterio_id=cemiterio_id,
                ).values_list("id", flat=True).first()
                if not quadra_id:
                    erros.append(f"Linha {i+2}: Quadra '{quadra_codigo}' não encontrada.")
                    continue

                tumulo = Tumulo.objects.filter(
                    quadra_id=quadra_id, identificador__iexact=ident_tumulo
                ).first()
                if not tumulo:
                    erros.append(
                        f"Linha {i+2}: Túmulo '{ident_tumulo}' não encontrado na quadra '{quadra_codigo}'."
                    )
                    continue

                # opcional: atualizar usar_linha/linha a partir da planilha (não vamos salvar ainda)
                usar_linha_raw = str(row.get("usar_linha") or "").strip().lower()
                if usar_linha_raw in ("sim", "s", "true", "1"):
                    tumulo.usar_linha = True
                elif usar_linha_raw in ("nao", "não", "n", "false", "0"):
                    tumulo.usar_linha = False
                if pd.notna(row.get("linha")):
                    try:
                        tumulo.linha = int(float(row.get("linha")))
                    except Exception:
                        pass  # ignora erro de conversão

                # cria e salva (gera número no save do model)
                with transaction.atomic():
                    sep = Sepultado(
                        nome=row.get("nome") or "",
                        cpf_sepultado=row.get("cpf_sepultado"),
                        data_nascimento=_date(row.get("data_nascimento")),
                        sexo=(row.get("sexo") or "NI")[:2].upper(),
                        local_nascimento=row.get("local_nascimento"),
                        local_falecimento=row.get("local_falecimento"),
                        data_falecimento=_date(row.get("data_falecimento")),
                        data_sepultamento=_date(row.get("data_sepultamento")),
                        nome_pai=row.get("nome_pai"),
                        nome_mae=row.get("nome_mae"),
                        tumulo=tumulo,
                        importado=True,  # marca como importado
                    )
                    # chama a lógica do model (gera número) e ignora contrato
                    sep.save(ignorar_validacao_contrato=True)

                    # fallback: se por algum motivo não veio número, força aqui
                    if not getattr(sep, "numero_sepultamento", None):
                        sep.numero_sepultamento = gerar_numero_sequencial_global(
                            tumulo.quadra.cemiterio.prefeitura
                        )
                        sep.save(update_fields=["numero_sepultamento"])

                tumulos_usados.add(tumulo.id)
                importados += 1

            except Exception as e:
                erros.append(f"Linha {i+2}: {e}")

        # marca túmulos como ocupados (se esse for o status padrão após sepultamento)
        if tumulos_usados:
            try:
                Tumulo.objects.filter(id__in=list(tumulos_usados)).update(status="ocupado")
            except Exception:
                pass  # não falha a importação por isso

        return Response({"importados": importados, "erros": erros}, status=200)

# --- CSRF helper (GET) permanece igual ---
from django.http import JsonResponse, HttpResponseNotAllowed
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie

@ensure_csrf_cookie
def csrf_get(request):
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])
    return JsonResponse({"csrfToken": get_token(request)})


# --- NOVO: selecionar cemitério pela sessão ---
from rest_framework.decorators import api_view, permission_classes

@api_view(["POST"])
@permission_classes([AllowAny])  # em produção troque por IsAuthenticated
def selecionar_cemiterio_api(request):
    cid = (
        request.data.get("cemiterio") or request.data.get("cemiterio_id")
        or request.query_params.get("cemiterio") or request.query_params.get("cemiterio_id")
    )
    if not cid:
        return Response({"detail": "Informe cemiterio (id)."}, status=400)
    try:
        cid = int(cid)
    except Exception:
        return Response({"detail": "cemiterio deve ser inteiro."}, status=400)

    request.session["cemiterio_ativo_id"] = cid
    return Response({"ok": True, "cemiterio": cid})
