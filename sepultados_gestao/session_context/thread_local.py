from threading import local

_user_context = local()

def set_prefeitura_ativa(prefeitura):
    _user_context.prefeitura_ativa = prefeitura

def get_prefeitura_ativa():
    return getattr(_user_context, "prefeitura_ativa", None)
