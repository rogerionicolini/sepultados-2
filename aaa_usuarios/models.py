from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from sepultados_gestao.models import Prefeitura


class UsuarioManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        email = self.normalize_email(email)
        extra_fields.setdefault("is_active", True)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(_("e-mail"), unique=True)
    first_name = models.CharField(_("nome"), max_length=150, blank=True)
    last_name = models.CharField(_("sobrenome"), max_length=150, blank=True)

    is_staff = models.BooleanField(
        _("é da equipe?"),
        default=False,
        help_text=_("Indica se o usuário pode acessar a área administrativa.")
    )
    is_active = models.BooleanField(
        _("está ativo?"),
        default=True,
        help_text=_("Indica se este usuário deve ser tratado como ativo.")
    )
    date_joined = models.DateTimeField(
        _("data de cadastro"),
        default=timezone.now
    )

    prefeitura = models.ForeignKey(
        Prefeitura,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usuarios",
        verbose_name="prefeitura vinculada"
    )

    # ⬇️ NOVO: permite mais de um “master” por prefeitura
    is_master = models.BooleanField(
        default=False,
        help_text=_("Administrador da prefeitura (pode gerenciar usuários e dados).")
    )

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _("usuário")
        verbose_name_plural = _("usuários")

    def __str__(self):
        return self.email

    @property
    def is_master_user(self):
        """Permite reconhecer dinamicamente o master da prefeitura."""
        if self.is_superuser:
            return True
        if self.is_master:
            return True
        if self.prefeitura and self.prefeitura.usuario_id == self.id:
            return True
        return False
