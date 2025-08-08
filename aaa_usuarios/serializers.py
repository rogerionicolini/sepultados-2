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

        # 🔹 tenta pegar a prefeitura direto do usuário
        pref_id = getattr(user, 'prefeitura_id', None)

        # 🔹 se não tiver, tenta achar pela prefeitura master
        if not pref_id:
            pref = Prefeitura.objects.filter(usuario=user).first()
            if pref:
                pref_id = pref.id

        token['prefeitura_id'] = pref_id
        return token

    def validate(self, attrs):
        attrs['username'] = attrs.get('email')
        data = super().validate(attrs)

        # 🔹 replica a lógica no corpo da resposta
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



from rest_framework import serializers
from aaa_usuarios.models import Usuario

class UsuarioSerializer(serializers.ModelSerializer):
    tipo = serializers.SerializerMethodField()

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
        ]
        read_only_fields = [
            'email',
            'is_active',
            'date_joined',
            'tipo',
        ]

    def get_tipo(self, obj):
        if hasattr(obj, "prefeitura") and obj.prefeitura:
            if obj.prefeitura.usuario_id == obj.id:
                return "Master"
        return "Normal"

    def validate_email(self, value):
        user = self.instance
        if Usuario.objects.exclude(id=user.id if user else None).filter(email=value).exists():
            raise serializers.ValidationError("Usuário com este endereço de e-mail já existe.")
        return value





class CriarUsuarioSerializer(serializers.ModelSerializer):
    senha = serializers.CharField(write_only=True)
    prefeitura = serializers.PrimaryKeyRelatedField(read_only=True)  # opcional pro front ver

    class Meta:
        model = Usuario
        fields = ['first_name', 'last_name', 'email', 'senha', 'prefeitura']

    def create(self, validated_data):
        senha = validated_data.pop("senha")
        # pega do context (preferência) ou de kwargs passados pelo .save()
        prefeitura = self.context.get("prefeitura") or validated_data.pop("prefeitura", None)
        if not prefeitura:
            raise serializers.ValidationError("Prefeitura não encontrada para o usuário criador.")
        user = Usuario(**validated_data)
        user.set_password(senha)
        user.prefeitura = prefeitura
        user.is_active = False
        user.save()
        return user


class EditarUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['first_name', 'last_name', 'email']

    def validate_email(self, value):
        usuario = self.instance  # usuário atual sendo editado
        if Usuario.objects.exclude(id=usuario.id).filter(email=value).exists():
            raise serializers.ValidationError("Este e-mail já está em uso.")
        return value
