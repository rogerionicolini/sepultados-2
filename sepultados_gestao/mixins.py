from django.contrib import messages
from django.shortcuts import redirect
from django.urls import reverse
from django.core.exceptions import PermissionDenied

class PrefeituraObrigatoriaAdminMixin:
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('%s?next=%s' % (reverse('admin:login'), request.path))

        prefeitura_id = request.session.get('prefeitura_ativa_id')

        if not prefeitura_id:
            self.message_user(
                request,
                "Você precisa selecionar uma prefeitura antes de acessar essa área.",
                level=messages.ERROR
            )
            return redirect(reverse('sepultados_gestao:selecionar_prefeitura_ativa'))

        return super().dispatch(request, *args, **kwargs)

    def has_add_permission(self, request):
        return bool(request.session.get("prefeitura_ativa_id"))

    def has_view_permission(self, request, obj=None):
        return bool(request.session.get("prefeitura_ativa_id"))

    def has_change_permission(self, request, obj=None):
        return bool(request.session.get("prefeitura_ativa_id"))

    def has_delete_permission(self, request, obj=None):
        return bool(request.session.get("prefeitura_ativa_id"))

    def has_module_permission(self, request):
        return bool(request.session.get("prefeitura_ativa_id"))

    def save_model(self, request, obj, form, change):
        if hasattr(obj, 'prefeitura_id') and not obj.prefeitura_id:
            prefeitura_id = request.session.get("prefeitura_ativa_id")
            if not prefeitura_id:
                raise PermissionDenied("Prefeitura ativa não definida.")
            obj.prefeitura_id = prefeitura_id
        return super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        prefeitura_id = request.session.get("prefeitura_ativa_id")

        if not prefeitura_id:
            return qs.none()

        model = self.model

        if model.__name__ == 'Prefeitura':
            return qs.filter(id=prefeitura_id)

        if model.__name__ == 'Cemiterio':
            return qs.filter(prefeitura_id=prefeitura_id)

        if model.__name__ == 'Quadra':
            return qs.filter(cemiterio__prefeitura_id=prefeitura_id)

        if model.__name__ == 'Tumulo':
            return qs.filter(quadra__cemiterio__prefeitura_id=prefeitura_id)

        if model.__name__ == 'Sepultado':
            return qs.filter(tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id)

        if model.__name__ == 'MovimentacaoSepultado':
            return qs.filter(sepultado__tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id)

        if model.__name__ == 'ConcessaoContrato':
            return qs.filter(tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id)

        if model.__name__ == 'Licenca':
            return qs.filter(prefeitura_id=prefeitura_id)

        if model.__name__ == 'RegistroAuditoria':
            return qs.filter(prefeitura_id=prefeitura_id)

        if model.__name__ == 'TipoServicoFinanceiro':
            return qs.filter(prefeitura_id=prefeitura_id)

        return qs.none()

