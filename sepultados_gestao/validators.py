from django.core.exceptions import ValidationError
import re

def validar_prefeitura_obrigatoria(instance):
    prefeitura = None

    if hasattr(instance, 'prefeitura'):
        prefeitura = instance.prefeitura

    elif hasattr(instance, 'cemiterio'):
        cemiterio = getattr(instance, 'cemiterio', None)
        if cemiterio and hasattr(cemiterio, 'prefeitura_id'):
            prefeitura = cemiterio.prefeitura

    if not prefeitura:
        raise ValidationError("Prefeitura ativa é obrigatória para salvar este registro.")


def validar_cpf_cnpj(value):
    """Valida se o valor é um CPF ou CNPJ no formato com máscara"""
    cpf_pattern = r'^\d{3}\.\d{3}\.\d{3}-\d{2}$'
    cnpj_pattern = r'^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'
    
    if not re.match(cpf_pattern, value) and not re.match(cnpj_pattern, value):
        raise ValidationError("Informe um CPF ou CNPJ válido com máscara (ex: 000.000.000-00 ou 00.000.000/0000-00).")
