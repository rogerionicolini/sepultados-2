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
    Licenca,
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


from rest_framework import serializers
from sepultados_gestao.models import Plano

class PlanoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plano
        fields = [
            'id',
            'nome',
            'descricao',
            'preco_mensal',
            'usuarios_min',
            'usuarios_max',
            'sepultados_max',
            'inclui_api',
            'inclui_erp',
            'inclui_suporte_prioritario',
        ]

# serializers.py

class LicencaSerializer(serializers.ModelSerializer):
    data_fim = serializers.SerializerMethodField()
    valor_mensal_reajustado = serializers.SerializerMethodField()
    expirada = serializers.SerializerMethodField()
    plano_nome = serializers.CharField(source='plano.nome', read_only=True)
    meses_contrato = serializers.IntegerField(read_only=True)

    class Meta:
        model = Licenca
        fields = [
            'prefeitura',
            'plano',
            'plano_nome',
            'data_inicio',
            'data_fim',
            'anos_contratados',
            'valor_mensal_atual',
            'valor_mensal_reajustado',
            'percentual_reajuste_anual',
            'usuarios_min',
            'usuarios_max',
            'sepultados_max',
            'inclui_api',
            'inclui_erp',
            'inclui_suporte_prioritario',
            'expirada',
            'meses_contrato',
        ]

    def get_data_fim(self, obj):
        return obj.data_fim

    def get_valor_mensal_reajustado(self, obj):
        return obj.valor_mensal_reajustado

    def get_expirada(self, obj):
        return obj.expirada
