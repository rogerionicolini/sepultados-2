from django import template

register = template.Library()

@register.filter
def add_soft_breaks(value, every=20):
    if not isinstance(value, str):
        return value
    result = ''
    for word in value.split():
        if len(word) > every:
            broken = '\u200B'.join([word[i:i+every] for i in range(0, len(word), every)])
            result += broken + ' '
        else:
            result += word + ' '
    return result.strip()
