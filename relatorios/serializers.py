# relatorios/serializers.py
from rest_framework import serializers
from sepultados_gestao.models import Sepultado

class RelatorioSepultadoSerializer(serializers.ModelSerializer):
    cpf = serializers.SerializerMethodField()

    class Meta:
        model = Sepultado
        fields = ("id", "nome", "data_sepultamento", "data_falecimento", "cpf")

    def get_cpf(self, obj):
        v = getattr(obj, "cpf", None) or getattr(obj, "documento", None)
        return v or ""
