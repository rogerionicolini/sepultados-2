from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from aaa_usuarios.models import Usuario

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"  # ✅ Corrigido


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
