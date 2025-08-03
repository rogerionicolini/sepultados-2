from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import Usuario
from .forms import UsuarioCreationForm, UsuarioChangeForm  # ✅ IMPORTANTE


@admin.register(Usuario)
class UsuarioAdmin(BaseUserAdmin):
    model = Usuario
    form = UsuarioChangeForm         # ✅ Edição
    add_form = UsuarioCreationForm   # ✅ Criação

    ordering = ['email']
    list_display = ['email', 'first_name', 'last_name', 'is_staff', 'is_active']
    list_filter = ['is_staff', 'is_active', 'is_superuser']
    search_fields = ['email', 'first_name', 'last_name']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Informações pessoais'), {'fields': ('first_name', 'last_name')}),
        (_('Permissões'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Datas importantes'), {'fields': ('last_login',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'is_staff', 'is_active'),
        }),
    )
