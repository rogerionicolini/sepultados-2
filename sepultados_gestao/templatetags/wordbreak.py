from django import template

register = template.Library()

@register.filter
def wordbreak(value):
    return value.replace(' ', '<wbr>')
