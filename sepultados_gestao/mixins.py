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

# sepultados_gestao/mixins.py

class ContextoRestritoQuerysetMixin:
    """
    Restringe o queryset pelo cemitério/prefeitura informados na querystring
    (?cemiterio=<id>&prefeitura=<id>) ou pelos objetos anexados ao request
    (request.cemiterio_ativo / request.prefeitura_ativa / request.user.prefeitura).

    A viewset deve definir:
      - cemiterio_field   -> caminho até o FK de cemitério (ex.: "tumulo__quadra__cemiterio")
      - prefeitura_field  -> caminho até o FK de prefeitura (ex.: "tumulo__quadra__cemiterio__prefeitura")
    """

    cemiterio_field = None           # sobrescreva na ViewSet
    prefeitura_field = None          # sobrescreva na ViewSet
    cemiterio_query_param = "cemiterio"
    prefeitura_query_param = "prefeitura"

    def get_queryset(self):
        qs = super().get_queryset()
        request = getattr(self, "request", None)
        if not request:
            return qs

        # 1) tenta querystring
        cem_id = request.query_params.get(self.cemiterio_query_param)
        pref_id = request.query_params.get(self.prefeitura_query_param)

        # 2) fallbacks do middleware/session (se você os usa)
        if not cem_id and getattr(request, "cemiterio_ativo", None):
            cem_id = getattr(request.cemiterio_ativo, "id", None)
        if not pref_id and getattr(request, "prefeitura_ativa", None):
            pref_id = getattr(request.prefeitura_ativa, "id", None)

        # 3) fallback para o usuário (se ele tiver prefeitura)
        if not pref_id and getattr(request.user, "prefeitura_id", None):
            pref_id = request.user.prefeitura_id

        filtros = {}
        if cem_id and self.cemiterio_field:
            filtros[f"{self.cemiterio_field}__id"] = cem_id
        if pref_id and self.prefeitura_field:
            filtros[f"{self.prefeitura_field}__id"] = pref_id

        return qs.filter(**filtros) if filtros else qs


# sepultados_gestao/mixins.py

class PrefeituraRestritaQuerysetMixin:
    """
    Restringe o queryset à prefeitura:
      1) request.prefeitura_ativa (middleware) OU session 'prefeitura_ativa_id';
      2) ?prefeitura=<id> / ?prefeitura_id=<id>;
      3) Cabeçalho X-Prefeitura-Id / X-Prefeitura;
      4) ?cemiterio=<id> / ?cemiterio_id=<id> (ou cabeçalho X-Cemiterio-Id / X-Cemiterio) para resolver a prefeitura via cemitério;
      5) Fallback: atributo do usuário (user.prefeitura_id ou user.prefeitura.id).
    Se nada disso existir, retorna vazio.
    """
    prefeitura_field = "prefeitura"

    def get_queryset(self):
        qs = super().get_queryset()
        request = getattr(self, "request", None)
        user = getattr(request, "user", None)
        if not request or not user or not user.is_authenticated:
            return qs.none()

        pref_id = None

        # 1) middleware/sessão
        pref = getattr(request, "prefeitura_ativa", None)
        if getattr(pref, "id", None):
            try: pref_id = int(pref.id)
            except Exception: pref_id = None
        if pref_id is None:
            try:
                sid = request.session.get("prefeitura_ativa_id")
                if sid: pref_id = int(sid)
            except Exception:
                pref_id = None

        # 2) querystring
        if pref_id is None:
            v = request.query_params.get("prefeitura") or request.query_params.get("prefeitura_id")
            if v:
                try: pref_id = int(v)
                except Exception: pref_id = None

        # 3) cabeçalho
        if pref_id is None:
            v = request.headers.get("X-Prefeitura-Id") or request.headers.get("X-Prefeitura")
            if v:
                try: pref_id = int(v)
                except Exception: pref_id = None

        # 4) via cemitério
        if pref_id is None:
            v = (
                request.query_params.get("cemiterio") or request.query_params.get("cemiterio_id")
                or request.headers.get("X-Cemiterio-Id") or request.headers.get("X-Cemiterio")
            )
            if v:
                try:
                    from .models import Cemiterio
                    cem = Cemiterio.objects.only("prefeitura_id").get(pk=int(v))
                    pref_id = int(cem.prefeitura_id)
                except Exception:
                    pref_id = None

        # 5) fallback usuário
        if pref_id is None:
            try:
                u_pref = getattr(user, "prefeitura_id", None) or getattr(user, "prefeitura", None)
                if isinstance(u_pref, int): pref_id = u_pref
                elif getattr(u_pref, "id", None): pref_id = int(u_pref.id)
            except Exception:
                pref_id = None

        if pref_id is None:
            return qs.none()

        field = getattr(self, "prefeitura_field", "prefeitura")
        key = field if field.endswith("_id") else f"{field}_id"
        return qs.filter(**{key: pref_id})
