from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from django.db import transaction
from .models import NumeroSequencialGlobal


@transaction.atomic
def gerar_numero_sequencial_global(prefeitura):
    """
    Gera um número sequencial único no formato XX/AAAA para qualquer serviço da prefeitura.
    """
    ano = datetime.now().year
    ultimo = (
        NumeroSequencialGlobal.objects
        .select_for_update()
        .filter(prefeitura=prefeitura, ano=ano)
        .order_by('-numero')
        .first()
    )

    proximo = 1 if not ultimo else ultimo.numero + 1

    NumeroSequencialGlobal.objects.create(
        prefeitura=prefeitura,
        numero=proximo,
        ano=ano
    )

    return f"{proximo}/{ano}"


from datetime import date
from decimal import Decimal
from dateutil.relativedelta import relativedelta


def gerar_receitas_para_servico(servico, descricao, forma_pagamento, valor_total, parcelas=1, nome=None, cpf=None, numero_documento=None):
    if not numero_documento:
        raise ValueError("O número do documento deve ser fornecido (contrato, exumação, etc).")

    # IMPORTAÇÕES MOVIDAS PARA DENTRO DA FUNÇÃO ↓↓↓↓↓
    from .models import Receita, Exumacao, Translado, ConcessaoContrato, Sepultado

    dados_comuns = {
        "descricao": descricao,
        "prefeitura": servico.prefeitura,
        "nome": nome,
        "cpf": cpf,
        "numero_documento": numero_documento,
        "valor_pago": Decimal("0.00"),
        "desconto": Decimal("0.00"),
    }

    if isinstance(servico, Exumacao):
        dados_comuns["exumacao"] = servico
    elif isinstance(servico, Translado):
        dados_comuns["translado"] = servico
    elif isinstance(servico, ConcessaoContrato):
        dados_comuns["contrato"] = servico
    elif isinstance(servico, Sepultado):
        dados_comuns["sepultado"] = servico
    else:
        raise ValueError("Tipo de serviço não suportado.")

    if forma_pagamento == 'gratuito':
        Receita.objects.create(
            **dados_comuns,
            valor_total=Decimal("0.00"),
            valor_em_aberto=Decimal("0.00"),
            status='pago',
            data_vencimento=date.today()
        )

    elif forma_pagamento == 'avista':
        Receita.objects.create(
            **dados_comuns,
            valor_total=valor_total,
            valor_em_aberto=valor_total,
            status='aberto',
            data_vencimento=date.today()
        )

    elif forma_pagamento == 'parcelado':
        valor_parcela = (valor_total / parcelas).quantize(Decimal("0.01"))
        valor_total_calculado = valor_parcela * parcelas
        diferenca = valor_total - valor_total_calculado

        for i in range(parcelas):
            valor_final = valor_parcela
            if i == parcelas - 1:
                valor_final += diferenca

            Receita.objects.create(
                **dados_comuns,
                valor_total=valor_final,
                valor_em_aberto=valor_final,
                status='aberto',
                data_vencimento=date.today() + relativedelta(months=i)
            )

def obter_prefeitura_ativa_do_request(request):
    from .models import Prefeitura
    prefeitura_id = request.session.get("prefeitura_ativa_id")
    if prefeitura_id:
        try:
            return Prefeitura.objects.get(id=prefeitura_id)
        except Prefeitura.DoesNotExist:
            return None
    return None

from django.core.exceptions import ValidationError

def validar_prefeitura_obrigatoria(instance):
    """
    Garante que o objeto tenha uma prefeitura vinculada.
    """
    if not hasattr(instance, 'prefeitura') or not instance.prefeitura:
        raise ValidationError("A prefeitura vinculada é obrigatória para este registro.")


from django.utils.timezone import now

def registrar_auditoria(usuario, acao, modelo, objeto_id=None, representacao=None, prefeitura=None):
    from .models import RegistroAuditoria  # <-- IMPORTAÇÃO LOCAL

    RegistroAuditoria.objects.create(
        usuario=usuario,
        acao=acao,
        modelo=modelo,
        objeto_id=str(objeto_id) if objeto_id else "",
        representacao=representacao or "",
        data_hora=now(),
        prefeitura=prefeitura
    )

