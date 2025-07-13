from django import template
import re

register = template.Library()

@register.filter
def wordbreak(value, length=50):
    """
    Insere <wbr> a cada X caracteres contínuos sem espaço para permitir quebra de linha em palavras longas.
    """
    def insert_breaks(match):
        word = match.group(0)
        return '<wbr>'.join(word[i:i+length] for i in range(0, len(word), length))

    return re.sub(r'\S{' + str(length) + r',}', insert_breaks, value)
