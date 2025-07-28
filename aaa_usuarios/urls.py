from django.urls import path
from .views import RecuperarSenhaView, RedefinirSenhaView

urlpatterns = [
    path("recuperar-senha/", RecuperarSenhaView.as_view(), name="recuperar-senha"),
    path("redefinir-senha/<uidb64>/<token>/", RedefinirSenhaView.as_view(), name="redefinir-senha"),
]
