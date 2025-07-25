from django import template

register = template.Library()

@register.filter
def br_currency(value):
    try:
        valor = float(value)
        return f"R$ {valor:,.2f}".replace(",", "v").replace(".", ",").replace("v", ".")
    except (TypeError, ValueError):
        return "R$ 0,00"
