from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from aaa_usuarios.models import Usuario

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['nome'] = user.get_full_name() or user.email
        return token

    def validate(self, attrs):
        attrs['username'] = attrs.get('email')
        return super().validate(attrs)

    email = serializers.EmailField()
    password = serializers.CharField()


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = [
            'id',
            'first_name',
            'last_name',
            'email',
            'is_active',
            'date_joined',
        ]


class CriarUsuarioSerializer(serializers.ModelSerializer):
    senha = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = ['first_name', 'last_name', 'email', 'senha']

    def create(self, validated_data):
        senha = validated_data.pop("senha")
        prefeitura = validated_data.pop("prefeitura", None)

        if not prefeitura:
            raise serializers.ValidationError("Prefeitura não encontrada na sessão.")

        user = Usuario(**validated_data)
        user.set_password(senha)
        user.prefeitura = prefeitura
        user.save()
        return user
