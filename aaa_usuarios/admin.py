# aaa_usuarios/admin.py
from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import Usuario
from .forms import UsuarioCreationForm, UsuarioChangeForm


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    """
    Admin limpo: sem Grupos/Permissões.
    Mostra: email, nome, prefeitura, is_master, is_staff, is_active, is_superuser.
    Usa seus forms para criar/editar (senha ok).
    """
    add_form = UsuarioCreationForm   # criação (faz set_password)
    form = UsuarioChangeForm         # edição (senha só leitura)
    model = Usuario

    ordering = ['email']
    list_display = [
        'email', 'first_name', 'last_name',
        'prefeitura_nome', 'is_master', 'is_staff', 'is_active', 'is_superuser'
    ]
    list_filter = ['prefeitura', 'is_master', 'is_staff', 'is_active', 'is_superuser']
    search_fields = ['email', 'first_name', 'last_name']

    # ====== EDIÇÃO (obj existente) ======
    fieldsets = (
        (_("Credenciais"), {'fields': ('email', 'password')}),
        (_("Informações pessoais"), {'fields': ('first_name', 'last_name')}),
        (_("Vínculo"), {'fields': ('prefeitura', 'is_master')}),
        (_("Acesso"), {'fields': ('is_staff', 'is_active', 'is_superuser')}),
    )

    # ====== CRIAÇÃO (obj novo) ======
    add_fieldsets = (
        (_("Novo usuário"), {
            'classes': ('wide',),
            'fields': (
                'email', 'first_name', 'last_name',
                'prefeitura', 'is_master',
                'is_staff', 'is_active', 'is_superuser',
                'password1', 'password2',
            ),
        }),
    )

    def get_fieldsets(self, request, obj=None):
        # Usa nossos fieldsets nas duas telas — nada do BaseUserAdmin (por isso some grupos/permissões)
        return self.add_fieldsets if obj is None else self.fieldsets

    def get_form(self, request, obj=None, **kwargs):
        # Garante o uso dos seus forms (que já não têm groups/permissions)
        kwargs['form'] = self.add_form if obj is None else self.form
        return super().get_form(request, obj, **kwargs)

    @admin.display(description=_("Prefeitura"))
    def prefeitura_nome(self, obj):
        return getattr(obj.prefeitura, "nome", "-")
