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
