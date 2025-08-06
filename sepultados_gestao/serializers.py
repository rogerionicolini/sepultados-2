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


from aaa_usuarios.models import Usuario
from sepultados_gestao.models import Prefeitura, Licenca, Plano
from django.utils import timezone

class RegistrarPrefeituraSerializer(serializers.Serializer):
    nome = serializers.CharField()
    cnpj = serializers.CharField()
    responsavel = serializers.CharField()
    telefone = serializers.CharField()
    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True)
    logradouro = serializers.CharField()
    endereco_numero = serializers.CharField()
    endereco_bairro = serializers.CharField()
    endereco_cidade = serializers.CharField()
    endereco_estado = serializers.CharField()
    endereco_cep = serializers.CharField()
    plano_id = serializers.IntegerField()
    duracao_anos = serializers.IntegerField(default=1)

    def create(self, validated_data):
        plano_id = validated_data.pop("plano_id")
        duracao_anos = validated_data.pop("duracao_anos", 1)

        plano = Plano.objects.get(id=plano_id)

        # Cria prefeitura
        prefeitura = Prefeitura.objects.create(**validated_data)

        # Cria usuário master
        usuario = Usuario.objects.create_superuser(
            email=validated_data["email"],
            password=validated_data["senha"],
            nome=validated_data["responsavel"],
            prefeitura=prefeitura,
            is_master=True,
        )

        # Cria licença com anos corretos
        Licenca.objects.create(
            prefeitura=prefeitura,
            plano=plano,
            data_inicio=timezone.now(),
            valor_mensal_atual=plano.preco_mensal,
            percentual_reajuste_anual=5.0,
            anos_contratados=duracao_anos,
            usuarios_min=plano.usuarios_min,
            usuarios_max=plano.usuarios_max,
            sepultados_max=plano.sepultados_max,
            inclui_api=plano.inclui_api,
            inclui_erp=plano.inclui_erp,
            inclui_suporte_prioritario=plano.inclui_suporte_prioritario,
        )

        return prefeitura

import base64
from django.core.files.base import ContentFile
from sepultados_gestao.models import Prefeitura
from rest_framework import serializers

class PrefeituraSerializer(serializers.ModelSerializer):
    logo_base64 = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Prefeitura
        fields = [
            "id", "nome", "cnpj", "responsavel", "telefone", "email", "site",
            "logradouro", "endereco_numero", "endereco_bairro", "endereco_cidade",
            "endereco_estado", "endereco_cep", "brasao", "multa_percentual",
            "juros_mensal_percentual", "clausulas_contrato", "logo_base64"
        ]
        read_only_fields = ["id", "brasao"]

    def update(self, instance, validated_data):
        logo_base64 = validated_data.pop("logo_base64", None)

        if logo_base64:
            try:
                format, imgstr = logo_base64.split(';base64,')
                ext = format.split('/')[-1]
                filename = f"logo_{instance.pk}.{ext}"
                instance.brasao = ContentFile(base64.b64decode(imgstr), name=filename)
            except Exception:
                raise serializers.ValidationError({"logo_base64": "Formato inválido para logo."})

        return super().update(instance, validated_data)

