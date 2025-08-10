from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.template.loader import render_to_string
from django.conf import settings


Usuario = get_user_model()


class RecuperarSenhaView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        print("📩 E-mail recebido:", email)  # DEBUG

        if not email:
            return Response({"erro": "E-mail não informado."}, status=400)

        try:
            usuario = Usuario.objects.get(email=email)
        except Usuario.DoesNotExist:
            return Response({"mensagem": "Se o e-mail existir, um link foi enviado."}, status=200)

        try:
            token = default_token_generator.make_token(usuario)
            uid = urlsafe_base64_encode(force_bytes(usuario.pk))
            link = f"{settings.FRONTEND_URL}/redefinir-senha/{uid}/{token}/"

            subject = "Redefinição de Senha - Sepultados.com"
            from_email = settings.DEFAULT_FROM_EMAIL
            to = [usuario.email]

            context = {
                'usuario': usuario,
                'link': link,
            }

            html_content = render_to_string("emails/redefinir_senha.html", context)
            email_message = EmailMultiAlternatives(subject, "", from_email, to)
            email_message.attach_alternative(html_content, "text/html")
            email_message.send()

            print("✅ E-mail enviado com sucesso para:", usuario.email)
            return Response({"mensagem": "Se o e-mail existir, um link foi enviado."}, status=200)

        except Exception as e:
            print("❌ Erro ao enviar e-mail:", e)
            return Response({"erro": f"Erro ao enviar e-mail: {str(e)}"}, status=500)


class RedefinirSenhaView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, uidb64, token):
        nova_senha = request.data.get("nova_senha")
        if not nova_senha:
            return Response({"erro": "Nova senha não informada."}, status=400)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            usuario = Usuario.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, Usuario.DoesNotExist):
            return Response({"erro": "Link inválido."}, status=400)

        if not default_token_generator.check_token(usuario, token):
            return Response({"erro": "Token inválido ou expirado."}, status=400)

        usuario.set_password(nova_senha)
        usuario.save()
        return Response({"mensagem": "Senha redefinida com sucesso."}, status=200)

from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.contrib.sites.shortcuts import get_current_site
from django.template.loader import render_to_string

from aaa_usuarios.models import Usuario
from aaa_usuarios.serializers import UsuarioSerializer, CriarUsuarioSerializer
from sepultados_gestao.models import Prefeitura, Licenca
from datetime import date
from django.urls import reverse


class UsuarioListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        usuario = self.request.user
        return Usuario.objects.filter(prefeitura=usuario.prefeitura)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CriarUsuarioSerializer
        return UsuarioSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["prefeitura"] = getattr(self.request.user, "prefeitura", None)
        context["request"] = self.request   # ✅ necessário para a validação do is_master
        return context


    def perform_create(self, serializer):
        user = self.request.user
        prefeitura = Prefeitura.objects.filter(usuario=user).first()
        if not prefeitura:
            raise ValidationError("Prefeitura não encontrada para o usuário.")

        hoje = timezone.now().date()
        licencas = Licenca.objects.filter(
            prefeitura=prefeitura,
            data_inicio__lte=timezone.now()
        ).order_by('-data_inicio')

        licenca = None
        for lic in licencas:
            data_fim = lic.data_inicio + timedelta(days=365 * lic.anos_contratados)
            if data_fim >= hoje:
                licenca = lic
                break

        if not licenca:
            raise ValidationError("Nenhuma licença ativa encontrada para esta prefeitura.")

        # Limite (conta todos, inclusive inativos)
        total_usuarios = Usuario.objects.filter(prefeitura=prefeitura).count()
        if total_usuarios >= licenca.usuarios_max:
            raise ValidationError(f"Limite de usuários atingido ({licenca.usuarios_max}).")

        # ⬇️ pega is_master do payload; default False
        is_master = bool(self.request.data.get("is_master")) in (True, "true", "True", "1")

        # Cria o usuário já com prefeitura; deixa inativo até confirmar por e-mail
        novo_usuario = serializer.save(
            prefeitura=prefeitura,
            is_active=False,
            is_master=is_master,
            # se for master, já dá acesso ao admin; não vira superuser global
            **({"is_staff": True} if is_master else {})
        )

        # E-mail de confirmação
        self.enviar_email_confirmacao(self.request, novo_usuario)



    def enviar_email_confirmacao(self, request, usuario):
        uid = urlsafe_base64_encode(force_bytes(usuario.pk))
        token = default_token_generator.make_token(usuario)

        # Link para a rota do backend que ativa o usuário e renderiza o HTML
        link = request.build_absolute_uri(
            reverse('confirmar-email', args=[uid, token])
        )
        # ex.: http://localhost:8000/api/usuarios/confirmar-email/<uid>/<token>/

        context = {
            'usuario': usuario,
            'link': link,
            'ano_atual': date.today().year,
        }

        html_conteudo = render_to_string('emails/email_confirmacao_usuario.html', context)

        send_mail(
            subject='Confirme seu cadastro no Sepultados.com',
            message=f"Olá {usuario.first_name}, confirme seu cadastro em: {link}",
            from_email='suporte@sepultados.com',
            recipient_list=[usuario.email],
            html_message=html_conteudo,
            fail_silently=False,
        )


class UsuarioListAPIView(generics.ListAPIView):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        prefeitura = getattr(self.request.user, "prefeitura", None)
        if not prefeitura:
            return Usuario.objects.none()
        return Usuario.objects.filter(prefeitura=prefeitura)



# aaa_usuarios/views.py  (trecho)

from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.contrib.auth import get_user_model

from aaa_usuarios.models import Usuario
from aaa_usuarios.serializers import (
    UsuarioSerializer,
    EditarUsuarioSerializer,   # usado na edição
)

from sepultados_gestao.models import Prefeitura


class UsuarioRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /usuarios/<id>/      -> detalhe
    PUT/PATCH /usuarios/<id>/-> editar (parcial)
    DELETE /usuarios/<id>/   -> excluir (regras abaixo)
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = Usuario.objects.all()   # necessário pro DRF
    lookup_field = "pk"

    # usa serializer de listagem por padrão
    serializer_class = UsuarioSerializer

    def get_queryset(self):
        # Limita sempre à prefeitura do usuário logado
        usuario = self.request.user
        return Usuario.objects.filter(prefeitura=usuario.prefeitura)

    def get_object(self):
        obj = super().get_object()
        user = self.request.user

        # Permite acessar a si mesmo
        if obj.pk == user.pk:
            return obj

        # Permite acessar usuários da mesma prefeitura
        if obj.prefeitura_id == user.prefeitura_id:
            return obj

        raise PermissionDenied("Você não tem permissão para acessar este usuário.")

    def get_serializer_class(self):
        # Na edição usamos um serializer simples (sem senha/email obrigatório)
        if self.request.method in ("PUT", "PATCH"):
            return EditarUsuarioSerializer
        return UsuarioSerializer

    def update(self, request, *args, **kwargs):
        """
        Torna a edição sempre PARCIAL para não exigir todos os campos.
        O frontend manda só first_name e last_name.
        """
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        user = self.request.user

        if instance.pk == user.pk:
            raise ValidationError("Você não pode excluir seu próprio usuário.")

        # Não permitir excluir o “dono” da prefeitura ou qualquer master extra (is_staff)
        if Prefeitura.objects.filter(usuario=instance).exists() or getattr(instance, "is_staff", False):
            raise ValidationError("Não é permitido excluir usuários master da prefeitura.")

        pref = getattr(user, "prefeitura", None)
        if not pref or pref.id != instance.prefeitura_id:
            raise PermissionDenied("Você não tem permissão para excluir este usuário.")

        # Apenas o master “dono” pode excluir
        if pref.usuario_id != user.id:
            raise PermissionDenied("Apenas o usuário master pode excluir usuários.")

        super().perform_destroy(instance)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class ConfirmarEmailUsuarioView(APIView):
    def post(self, request):
        email = request.data.get("email")
        try:
            usuario = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"erro": "Usuário não encontrado."}, status=404)

        if usuario.is_active:
            return Response({"mensagem": "Usuário já está ativo."}, status=400)

        uid = urlsafe_base64_encode(force_bytes(usuario.pk))
        token = default_token_generator.make_token(usuario)
        url = f"{settings.FRONTEND_URL}/confirmar-email/{uid}/{token}/"

        send_mail(
            subject="Confirme seu e-mail",
            message=f"Clique no link para confirmar seu e-mail: {url}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[usuario.email],
            fail_silently=False,
        )

        return Response({"mensagem": "E-mail de confirmação enviado com sucesso."}, status=200)

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.shortcuts import render  # ✅ necessário para renderizar o template

User = get_user_model()


class AtivarUsuarioView(APIView):
    def get(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user and default_token_generator.check_token(user, token):
            # ativa
            if not user.is_active:
                user.is_active = True
                user.save()

            # garante VÍNCULO com a prefeitura
            if not getattr(user, "prefeitura_id", None):
                from sepultados_gestao.models import Prefeitura
                pref = Prefeitura.objects.filter(usuario=user).first()
                if pref:
                    user.prefeitura = pref
                    user.save()

            # seta prefeitura ativa na sessão
            if getattr(user, "prefeitura_id", None):
                request.session["prefeitura_ativa_id"] = user.prefeitura_id

            return render(request, 'emails/confirmar_email.html', {'usuario': user})

        return render(request, 'emails/confirmar_email.html', {'mensagem': 'Token inválido ou expirado.'})


