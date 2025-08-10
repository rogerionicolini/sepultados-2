from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from aaa_usuarios.models import Usuario
from sepultados_gestao.models import Prefeitura

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['nome'] = user.get_full_name() or user.email

        pref_id = getattr(user, 'prefeitura_id', None)
        if not pref_id:
            pref = Prefeitura.objects.filter(usuario=user).first()
            if pref:
                pref_id = pref.id

        token['prefeitura_id'] = pref_id
        return token

    def validate(self, attrs):
        attrs['username'] = attrs.get('email')
        data = super().validate(attrs)

        user = self.user
        pref_id = getattr(user, 'prefeitura_id', None)
        if not pref_id:
            pref = Prefeitura.objects.filter(usuario=user).first()
            if pref:
                pref_id = pref.id

        data['prefeitura_id'] = pref_id
        return data

    email = serializers.EmailField()
    password = serializers.CharField()



# serializers.py
from rest_framework import serializers
from aaa_usuarios.models import Usuario

class UsuarioSerializer(serializers.ModelSerializer):
    tipo = serializers.SerializerMethodField()
    is_master = serializers.BooleanField(read_only=True)  # <-- exibir no frontend

    class Meta:
        model = Usuario
        fields = [
            'id',
            'first_name',
            'last_name',
            'email',
            'is_active',
            'date_joined',
            'tipo',
            'is_master',          # <-- importante pro checkbox
        ]
        read_only_fields = [
            'email',
            'is_active',
            'date_joined',
            'tipo',
            'is_master',
        ]

    def get_tipo(self, obj):
        # Master se for “dono” (prefeitura.usuario) OU se is_master=True
        if (getattr(obj, "prefeitura", None) and obj.prefeitura.usuario_id == obj.id) or getattr(obj, "is_master", False):
            return "Master"
        return "Normal"

    def validate_email(self, value):
        user = self.instance
        if Usuario.objects.exclude(id=user.id if user else None).filter(email=value).exists():
            raise serializers.ValidationError("Usuário com este endereço de e-mail já existe.")
        return value





from rest_framework import serializers
from django.contrib.auth import get_user_model

Usuario = get_user_model()

class CriarUsuarioSerializer(serializers.ModelSerializer):
    senha = serializers.CharField(write_only=True)
    # permitir marcar o novo usuário como master
    is_master = serializers.BooleanField(write_only=True, required=False, default=False)
    prefeitura = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Usuario
        fields = ['first_name', 'last_name', 'email', 'senha', 'is_master', 'prefeitura']

    def validate_email(self, value):
        email = (value or "").strip().lower()
        if Usuario.objects.filter(email=email).exists():
            raise serializers.ValidationError("Já existe um usuário com este e-mail.")
        return email

    def create(self, validated_data):
        senha = validated_data.pop("senha")
        want_master = bool(validated_data.pop("is_master", False))

        # prefeitura vem do context (setado na view)
        prefeitura = self.context.get("prefeitura")
        if not prefeitura:
            raise serializers.ValidationError("Prefeitura não encontrada para o usuário criador.")

        # Só master (ou superuser) pode criar outro master
        request = self.context.get("request")
        if want_master:
            if not request or not request.user.is_authenticated:
                raise serializers.ValidationError("Permissão negada.")
            if not getattr(request.user, "is_master_user", False):
                raise serializers.ValidationError("Apenas um master pode criar outro usuário master.")

        # criar usuário
        user = Usuario(**validated_data)
        user.email = validated_data.get("email", "").lower()
        user.set_password(senha)
        user.prefeitura = prefeitura
        user.is_active = False

        if want_master:
            user.is_master = True   # <-- garante flag no modelo
            user.is_staff = True    # <-- acesso ao admin

        user.save()
        return user



from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from aaa_usuarios.models import Usuario

class EditarUsuarioSerializer(serializers.ModelSerializer):
    """
    - Permite editar first_name/last_name e expõe email como read-only.
    - Campo is_master (bool) é um alias de is_staff no banco.
    - Regras:
        * Só superuser ou um usuário já master pode alterar is_master.
        * Não é permitido remover master do DONO (prefeitura.usuario).
        * Não pode deixar a prefeitura sem nenhum master (dono conta como master).
    """
    email = serializers.EmailField(read_only=True)
    is_master = serializers.BooleanField(required=False)

    class Meta:
        model = Usuario
        fields = ["first_name", "last_name", "email", "is_master"]

    # Representação de saída: considera master se for dono OU is_staff
    def to_representation(self, instance):
        data = super().to_representation(instance)
        dono_id = getattr(getattr(instance, "prefeitura", None), "usuario_id", None)
        eh_master = (instance.id == dono_id) or bool(getattr(instance, "is_staff", False))
        data["is_master"] = eh_master
        return data

    def update(self, instance, validated_data):
        request = self.context.get("request")

        # --- Alteração de master ---
        if "is_master" in validated_data:
            if not request or not request.user.is_authenticated:
                raise ValidationError("Permissão negada.")

            # Quem pode alterar: superuser OU já master (dono ou is_staff)
            req_dono_id = getattr(getattr(request.user, "prefeitura", None), "usuario_id", None)
            req_eh_master = (
                request.user.is_superuser or
                (request.user.id == req_dono_id) or
                getattr(request.user, "is_staff", False)
            )
            if not req_eh_master:
                raise ValidationError("Apenas um usuário master pode alterar o status de master.")

            novo_master = bool(validated_data.pop("is_master"))

            # Dono da prefeitura não pode perder master
            dono_id = getattr(getattr(instance, "prefeitura", None), "usuario_id", None)
            if instance.id == dono_id and not novo_master:
                raise ValidationError("O dono da prefeitura não pode perder o status de master.")

            # Se rebaixar este usuário, precisa sobrar pelo menos 1 master
            # Se rebaixar este usuário, precisa sobrar pelo menos 1 master
            if not novo_master:
                # Conta masters além do alvo: dono OU is_staff=True
                qs = Usuario.objects.filter(prefeitura_id=instance.prefeitura_id).exclude(id=instance.id)
                existe_outro_master = qs.filter(
                    id=getattr(getattr(instance, "prefeitura", None), "usuario_id", None)
                ).exists() or qs.filter(is_staff=True).exists()

                if not existe_outro_master:
                    raise ValidationError("Deve existir pelo menos um usuário master na prefeitura.")

        # --- Demais campos editáveis ---
        for f in ("first_name", "last_name"):
            if f in validated_data:
                setattr(instance, f, validated_data[f])

        instance.save()
        return instance
