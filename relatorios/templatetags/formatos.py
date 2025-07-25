from django import template

register = template.Library()

@register.filter
def br_currency(value):
    try:
        valor = float(value)
        return f"R$ {valor:,.2f}".replace(",", "v").replace(".", ",").replace("v", ".")
    except (TypeError, ValueError):
        return "R$ 0,00"

from django import template

register = template.Library()

@register.filter
def get_item(dicionario, chave):
    return dicionario.get(chave)

# seu_app/templatetags/formatos.py

from django import template

register = template.Library()

@register.filter
def dict_get(d, k):
    """
    Permite acessar um dicionário pelo ID diretamente no template:
    {{ meu_dict|dict_get:obj.id }}
    """
    if d is None:
        return None
    return d.get(k)
