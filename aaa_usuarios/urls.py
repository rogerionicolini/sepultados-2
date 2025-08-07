from django.urls import path
from .views import (
    RecuperarSenhaView,
    RedefinirSenhaView,
    UsuarioListCreateAPIView,
    UsuarioListAPIView,
    UsuarioRetrieveUpdateDestroyAPIView,
    AtivarUsuarioView,
)

urlpatterns = [
    path("recuperar-senha/", RecuperarSenhaView.as_view(), name="recuperar-senha"),
    path("redefinir-senha/<uidb64>/<token>/", RedefinirSenhaView.as_view(), name="redefinir-senha"),
    path("", UsuarioListCreateAPIView.as_view(), name="criar_usuario"),
    path("lista/", UsuarioListAPIView.as_view(), name="listar_usuarios"),
    path("usuarios/<int:pk>/", UsuarioRetrieveUpdateDestroyAPIView.as_view(), name="usuario-detalhe"),
    path("confirmar-email/<uidb64>/<token>/", AtivarUsuarioView.as_view(), name="confirmar-email"),
]
