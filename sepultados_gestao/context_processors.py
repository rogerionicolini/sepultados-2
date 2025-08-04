from .models import Prefeitura

def prefeitura_context(request):
    contexto = {}

    if request.user.is_authenticated and request.user.is_superuser:
        prefeitura_id = request.session.get('prefeitura_ativa_id')
        contexto['prefeitura_ativa_id'] = prefeitura_id
        contexto['prefeituras'] = Prefeitura.objects.all()

    return contexto

# sepultados_gestao/context_processors.py

# sepultados_gestao/context_processors.py

# sepultados_gestao/context_processors.py

from .models import Licenca, Prefeitura
from datetime import date
from dateutil.relativedelta import relativedelta

def licenca_ativa_context(request):
    prefeitura_id = request.session.get('prefeitura_ativa_id')
    contexto = {}

    if request.user.is_authenticated and prefeitura_id:
        try:
            prefeitura = Prefeitura.objects.get(id=prefeitura_id)
            licencas = Licenca.objects.filter(
                prefeitura=prefeitura,
                data_inicio__lte=date.today()  # CORRIGIDO
            )

            licenca_valida = None
            for lic in licencas:
                data_fim = lic.data_inicio + relativedelta(years=lic.anos_contratados)  # CORRIGIDO
                if data_fim >= date.today():
                    licenca_valida = lic
                    contexto['licenca_ativa'] = licenca_valida
                    contexto['data_vencimento_licenca'] = data_fim
                    break
        except Prefeitura.DoesNotExist:
            contexto['licenca_ativa'] = None

    return contexto

