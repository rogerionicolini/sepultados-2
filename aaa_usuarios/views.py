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

# aaa_usuarios/views.py

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from aaa_usuarios.models import Usuario
from aaa_usuarios.serializers import UsuarioSerializer, CriarUsuarioSerializer
from sepultados_gestao.models import Prefeitura, Licenca
from django.utils import timezone
from datetime import timedelta

class UsuarioListCreateAPIView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CriarUsuarioSerializer
        return UsuarioSerializer

    def get_queryset(self):
        return Usuario.objects.filter(prefeitura=self.request.user.prefeitura)

    def post(self, request, *args, **kwargs):
        user = request.user
        prefeitura = Prefeitura.objects.filter(usuario=user).first()

        if not prefeitura:
            raise ValidationError("Prefeitura não encontrada para o usuário.")

        hoje = timezone.now()
        licencas = Licenca.objects.filter(
            prefeitura=prefeitura,
            data_inicio__lte=hoje
        ).order_by('-data_inicio')

        licenca = None
        for lic in licencas:
            data_fim_calculada = lic.data_inicio + timedelta(days=365 * lic.anos_contratados)
            if data_fim_calculada >= hoje.date():
                licenca = lic
                break

        if not licenca:
            raise ValidationError("Nenhuma licença ativa encontrada para esta prefeitura.")

        usuarios_ativos = Usuario.objects.filter(prefeitura=prefeitura, is_active=True).count()
        usuario_master = prefeitura.usuario
        if usuario_master and usuario_master.is_active and (
            not usuario_master.prefeitura_id or usuario_master.prefeitura_id != prefeitura.id
        ):
            usuarios_ativos += 1

        if usuarios_ativos >= licenca.usuarios_max:
            raise ValidationError(f"Limite de usuários atingido ({licenca.usuarios_max}).")

        serializer = self.get_serializer(data=request.data)
        serializer.context["prefeitura"] = prefeitura

        if not serializer.is_valid():
            print("❌ ERRO DETALHADO:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)





class UsuarioListAPIView(generics.ListAPIView):
    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        prefeitura = getattr(self.request.user, "prefeitura", None)
        if not prefeitura:
            return Usuario.objects.none()
        return Usuario.objects.filter(prefeitura=prefeitura)
