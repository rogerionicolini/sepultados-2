from rest_framework import serializers
from .models import (
    Cemiterio,
    ConcessaoContrato,
    Exumacao,
    Quadra,
    Receita,
    RegistroAuditoria,
    Sepultado,
    Translado,
    Tumulo,
)

class CemiterioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cemiterio
        fields = '__all__'

class ConcessaoContratoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConcessaoContrato
        fields = '__all__'

class ExumacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exumacao
        fields = '__all__'

class QuadraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quadra
        fields = '__all__'

class ReceitaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receita
        fields = '__all__'

class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroAuditoria
        fields = '__all__'

class SepultadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sepultado
        fields = '__all__'

class TransladoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Translado
        fields = '__all__'

class TumuloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tumulo
        fields = '__all__'


