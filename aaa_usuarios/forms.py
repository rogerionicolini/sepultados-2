from django import forms
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from .models import Usuario


class UsuarioCreationForm(forms.ModelForm):
    password1 = forms.CharField(label='Senha', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirme a senha', widget=forms.PasswordInput)

    class Meta:
        model = Usuario
        fields = (
            'email',
            'first_name',
            'last_name',
            'prefeitura',
            'is_master',
            'is_staff',
            'is_active',
            'is_superuser',  # visível no form; no admin só aparece para superusuário
        )

    def clean_password2(self):
        p1 = self.cleaned_data.get("password1")
        p2 = self.cleaned_data.get("password2")
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError("As senhas não coincidem.")
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


class UsuarioChangeForm(forms.ModelForm):
    password = ReadOnlyPasswordHashField(
        label="Senha",
        help_text="Use o botão acima para alterar a senha."
    )

    class Meta:
        model = Usuario
        fields = (
            'email',
            'first_name',
            'last_name',
            'password',
            'prefeitura',
            'is_master',
            'is_staff',
            'is_active',
            'is_superuser',  # será exibido no admin só para superusuário
        )
