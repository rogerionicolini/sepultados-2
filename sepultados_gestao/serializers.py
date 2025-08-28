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
    Anexo,
)

class CemiterioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cemiterio
        fields = '__all__'

# serializers.py
from decimal import Decimal
from rest_framework import serializers
from .models import ConcessaoContrato

class ConcessaoContratoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConcessaoContrato
        fields = "__all__"
        read_only_fields = ("id", "prefeitura", "numero_contrato", "data_contrato", "usuario_registro")

    def validate(self, attrs):
        forma = attrs.get("forma_pagamento")
        valor = attrs.get("valor_total")
        parcelas = attrs.get("quantidade_parcelas")

        # normalizar parcelas vazias
        if parcelas in ("", None):
            parcelas = None

        if forma == "gratuito":
            attrs["valor_total"] = Decimal("0.00")
            attrs["quantidade_parcelas"] = None
            return attrs

        # À vista / Parcelado → exigir valor > 0
        if valor is None:
            raise serializers.ValidationError({"valor_total": "Informe o valor."})

        if isinstance(valor, str):
            val = valor.replace(".", "").replace(",", ".")
            try:
                valor = Decimal(val)
            except Exception:
                raise serializers.ValidationError({"valor_total": "Valor inválido."})

        if valor <= 0:
            raise serializers.ValidationError({"valor_total": "O valor deve ser maior que zero."})

        attrs["valor_total"] = valor

        if forma == "parcelado":
            if not parcelas or int(parcelas) < 1:
                raise serializers.ValidationError({"quantidade_parcelas": "Informe a quantidade de parcelas."})
            attrs["quantidade_parcelas"] = int(parcelas)
        else:
            attrs["quantidade_parcelas"] = None

        return attrs


# serializers.py
from rest_framework import serializers
from .models import Exumacao

class ExumacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exumacao
        fields = "__all__"   # <- não exponha campos que não existem
        # Ajuste estes read_only conforme seu model realmente tiver:
        read_only_fields = (
            "id",
            "numero_documento",   # se o nº é gerado no backend
            "prefeitura",         # se setado via ViewSet
        )
        extra_kwargs = {
            # torne opcionais/aceitem vazio
            "tumulo": {"required": False, "allow_null": True},
            "motivo": {"required": False, "allow_blank": True},
            "observacoes": {"required": False, "allow_blank": True},
            "cpf": {"required": False, "allow_blank": True},
            "endereco": {"required": False, "allow_blank": True},
            "telefone": {"required": False, "allow_blank": True},
            "quantidade_parcelas": {"required": False, "allow_null": True},
            "valor": {"required": False},  # não obrigue quando gratuito
        }

    def validate(self, attrs):
        fp = attrs.get("forma_pagamento") or "gratuito"
        if fp == "gratuito":
            attrs["valor"] = 0
            attrs["quantidade_parcelas"] = None
        elif fp != "parcelado":  # à vista
            attrs["quantidade_parcelas"] = None
        return attrs




class QuadraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quadra
        fields = '__all__'

class ReceitaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receita
        fields = '__all__'

# sepultados_gestao/serializers.py
from rest_framework import serializers
from .models import RegistroAuditoria


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    # campos de apresentação
    usuario_email = serializers.SerializerMethodField()
    usuario_username = serializers.SerializerMethodField()
    usuario_nome = serializers.SerializerMethodField()
    acao_label = serializers.SerializerMethodField()
    detalhes = serializers.SerializerMethodField()

    class Meta:
        model = RegistroAuditoria
        fields = [
            "id",
            "acao",            # valor cru no banco (ex.: Add/Change/Delete/Fail)
            "acao_label",      # valor amigável em pt-BR
            "modelo",
            "objeto_id",
            "data_hora",
            "prefeitura",
            "usuario",
            "usuario_id",
            "usuario_email",
            "usuario_username",
            "usuario_nome",
            "detalhes",
            "representacao",
        ]

    # --- helpers de usuário ---
    def _user(self, obj):
        return getattr(obj, "usuario", None)

    def get_usuario_email(self, obj):
        u = self._user(obj)
        return getattr(u, "email", None) if u else None

    def get_usuario_username(self, obj):
        u = self._user(obj)
        return getattr(u, "username", None) if u else None

    def get_usuario_nome(self, obj):
        u = self._user(obj)
        if not u:
            return None
        try:
            full = u.get_full_name()
        except Exception:
            full = ""
        return full or u.first_name or u.username

    # --- detalhes / label ---
    def get_detalhes(self, obj):
        # se tiver outro campo com detalhes, ajuste aqui
        return getattr(obj, "representacao", None)

    def get_acao_label(self, obj):
        raw = (obj.acao or "").strip()
        mapa = {
            "Add": "Adição",
            "Change": "Edição",
            "Delete": "Exclusão",
            "Fail": "Falha",
            # caso já venha em pt:
            "adição": "Adição",
            "edição": "Edição",
            "exclusão": "Exclusão",
            "falha": "Falha",
        }
        return mapa.get(raw, mapa.get(raw.lower(), raw.capitalize()))



class SepultadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sepultado
        fields = '__all__'

class TransladoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Translado
        fields = '__all__'

from rest_framework import serializers

class TumuloSerializer(serializers.ModelSerializer):
    tem_contrato_ativo = serializers.BooleanField(read_only=True)
    contrato_id = serializers.IntegerField(read_only=True, allow_null=True)
    contrato_numero = serializers.CharField(read_only=True, allow_null=True)

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

class LicencaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    data_fim = serializers.SerializerMethodField()
    valor_mensal_reajustado = serializers.SerializerMethodField()
    expirada = serializers.SerializerMethodField()
    plano_nome = serializers.CharField(source='plano.nome', read_only=True)
    meses_contrato = serializers.IntegerField(read_only=True)

    # Se os inclui_* estiverem no Plano, descomente:
    # inclui_api = serializers.BooleanField(source='plano.inclui_api', read_only=True)
    # inclui_erp = serializers.BooleanField(source='plano.inclui_erp', read_only=True)
    # inclui_suporte_prioritario = serializers.BooleanField(source='plano.inclui_suporte_prioritario', read_only=True)

    class Meta:
        model = Licenca
        fields = [
            'id',
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
        read_only_fields = [
            'id', 'prefeitura', 'plano', 'plano_nome',
            'valor_mensal_reajustado', 'expirada', 'meses_contrato'
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

from rest_framework import serializers
from sepultados_gestao.models import Prefeitura
import base64
from django.core.files.base import ContentFile
from decimal import Decimal, InvalidOperation


class PrefeituraSerializer(serializers.ModelSerializer):
    # recebe a imagem em Base64 para atualizar o brasão
    logo_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Prefeitura
        fields = [
            "id",
            "nome",
            "cnpj",
            "responsavel",
            "telefone",
            "email",
            "site",

            "logradouro",
            "endereco_numero",
            "endereco_bairro",
            "endereco_cidade",
            "endereco_estado",
            "endereco_cep",                 # << NOVO

            "multa_percentual",             # << NOVO
            "juros_mensal_percentual",      # << NOVO
            "clausulas_contrato",           # << NOVO

            "brasao",
            "logo_base64",
        ]
        read_only_fields = ["id", "brasao"]

    def validate(self, attrs):
        """
        Aceita percentuais digitados com vírgula (ex.: '0,5') e
        converte para Decimal (ex.: Decimal('0.5')).
        """
        for key in ("multa_percentual", "juros_mensal_percentual"):
            if key in attrs and isinstance(attrs[key], str):
                val = attrs[key].strip().replace(",", ".")
                if val == "":
                    attrs[key] = None
                else:
                    try:
                        attrs[key] = Decimal(val)
                    except InvalidOperation:
                        raise serializers.ValidationError({key: "Valor percentual inválido."})
        return attrs

    def update(self, instance, validated_data):
        # retira o base64, se enviado
        logo_base64 = validated_data.pop("logo_base64", None)

        # atualiza os demais campos normalmente
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # atualiza a imagem, se enviada
        if logo_base64:
            try:
                format_, imgstr = logo_base64.split(";base64,")
                ext = format_.split("/")[-1]
                file_data = ContentFile(base64.b64decode(imgstr), name=f"logo.{ext}")
                instance.brasao = file_data
            except Exception as e:
                raise serializers.ValidationError({"logo_base64": f"Erro ao processar imagem: {str(e)}"})

        instance.save()
        return instance


# serializers.py
import os
from rest_framework import serializers
from .models import Anexo

class AnexoSerializer(serializers.ModelSerializer):
    arquivo_url = serializers.SerializerMethodField()

    class Meta:
        model = Anexo
        fields = ["id", "nome", "arquivo", "arquivo_url", "data_upload", "content_type", "object_id"]
        read_only_fields = ["id", "arquivo_url", "data_upload"]

    def get_arquivo_url(self, obj):
        request = self.context.get("request")
        if obj.arquivo and hasattr(obj.arquivo, "url"):
            url = obj.arquivo.url
            return request.build_absolute_uri(url) if request else url
        return None

    def to_representation(self, instance):
        """
        Mantém 'nome' gravável; se vier vazio, exibe o nome do arquivo.
        """
        data = super().to_representation(instance)
        nome = (data.get("nome") or "").strip()
        if not nome and getattr(instance, "arquivo", None):
            try:
                data["nome"] = os.path.basename(instance.arquivo.name) or ""
            except Exception:
                data["nome"] = ""
        return data
