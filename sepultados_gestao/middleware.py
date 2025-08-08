from django.utils.deprecation import MiddlewareMixin
from django.shortcuts import redirect
from django.contrib import messages
from django.urls import reverse

from .models import Prefeitura, Cemiterio
from sepultados_gestao.session_context.thread_local import set_prefeitura_ativa


URLS_LIVRES = [
    "/admin/sepultados_gestao/prefeitura/",
    "/admin/sepultados_gestao/plano/",
    "/admin/sepultados_gestao/licenca/",
    "/admin/sepultados_gestao/tipousuario/",
    "/admin/auth/user/",
    "/admin/logout/",
    "/admin/jsi18n/",
    "/admin/password_change/",
    "/admin/password_change/done/",
    "/admin/sepultados_gestao/registroauditoria/",
    "/admin/"
]

class PrefeituraAtivaMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request.prefeitura_ativa = None
        request.cemiterio_ativo = None

        if request.user.is_authenticated:
            prefeitura_id = request.session.get("prefeitura_ativa_id")
            cemiterio_id = request.session.get("cemiterio_ativo_id")

            if prefeitura_id:
                try:
                    request.prefeitura_ativa = Prefeitura.objects.get(id=prefeitura_id)
                    set_prefeitura_ativa(request.prefeitura_ativa)  # ✅ LINHA ADICIONADA
                except Prefeitura.DoesNotExist:
                    request.prefeitura_ativa = None

            if cemiterio_id:
                try:
                    request.cemiterio_ativo = Cemiterio.objects.get(id=cemiterio_id)
                except Cemiterio.DoesNotExist:
                    request.cemiterio_ativo = None

            if request.path.startswith("/admin/"):
                # Permite acesso à tela inicial e páginas livres sem redirecionar
                if any(request.path.startswith(url) for url in URLS_LIVRES):
                    return

                # Exige prefeitura ativa para outras rotas
                if not request.prefeitura_ativa and not request.path.startswith("/admin/selecionar-prefeitura/"):
                    messages.warning(request, "Você precisa selecionar uma prefeitura antes de continuar.")
                    return redirect("sepultados_gestao:selecionar_prefeitura_ativa")

                # Exige cemitério ativo quando já tem prefeitura
                if request.prefeitura_ativa and not request.cemiterio_ativo and not request.path.startswith("/admin/selecionar-cemiterio/"):
                    messages.warning(request, "Você precisa selecionar um cemitério antes de continuar.")
                    return redirect("sepultados_gestao:selecionar_cemiterio_ativo")