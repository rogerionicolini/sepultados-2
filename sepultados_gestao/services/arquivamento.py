from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from sepultados_gestao.models import Prefeitura, Cemiterio

User = get_user_model()

@transaction.atomic
def arquivar_prefeitura(prefeitura: Prefeitura, responsavel=None, motivo: str = ""):
    """
    Arquiva a prefeitura:
      - muda situacao para 'arquivado' e marca arquivada_em
      - arquiva TODOS os cemitérios dela
      - desativa os usuários (exceto superuser)
    """
    if prefeitura.situacao == "arquivado":
        return prefeitura

    prefeitura.situacao = "arquivado"
    prefeitura.arquivada_em = timezone.now()
    if motivo:
        prefeitura.motivo_arquivamento = motivo
    prefeitura.save(update_fields=["situacao", "arquivada_em", "motivo_arquivamento"])

    Cemiterio.objects.filter(prefeitura=prefeitura, situacao="ativo").update(
        situacao="arquivado",
        arquivado_em=timezone.now(),
        motivo_arquivamento=motivo
    )

    User.objects.filter(prefeitura=prefeitura)\
        .exclude(is_superuser=True)\
        .update(is_active=False, desativado_por_arquivamento=True)

    return prefeitura


@transaction.atomic
def restaurar_prefeitura(prefeitura: Prefeitura, responsavel=None, motivo: str = ""):
    """
    Restaura a prefeitura:
      - volta situacao para 'ativo' e limpa campos de arquivo
      - reativa TODOS os cemitérios arquivados dela
      - reativa apenas usuários desativados pelo arquivamento
    """
    if prefeitura.situacao != "arquivado":
        return prefeitura

    prefeitura.situacao = "ativo"
    prefeitura.arquivada_em = None
    prefeitura.motivo_arquivamento = ""
    prefeitura.save(update_fields=["situacao", "arquivada_em", "motivo_arquivamento"])

    Cemiterio.objects.filter(prefeitura=prefeitura, situacao="arquivado").update(
        situacao="ativo",
        arquivado_em=None,
        motivo_arquivamento=""
    )

    User.objects.filter(prefeitura=prefeitura, desativado_por_arquivamento=True)\
        .update(is_active=True, desativado_por_arquivamento=False)

    return prefeitura


from django.db import transaction
from sepultados_gestao.models import Exumacao, Sepultado


@transaction.atomic
def sync_sepultado_status(sepultado: "Sepultado"):
    """
    Recalcula e sincroniza os campos do sepultado a partir das exumações existentes.
    - exumado: True se existe ao menos uma Exumacao, senão False
    - status: EXUMADO/SEPULTADO (se o model tiver enum Status) ou "exumado"/"sepultado"
    - data_exumacao: data da última exumação ou None
    Idempotente e seguro para ser chamado em save/delete/signals.
    """
    if not sepultado or not getattr(sepultado, "pk", None):
        return

    # Busca exumações e última data
    qs = Exumacao.objects.filter(sepultado=sepultado).order_by("-data", "-pk")
    tem_exumacao = qs.exists()
    ultima = qs.first()

    exumado = bool(tem_exumacao)
    nova_data_exu = getattr(ultima, "data", None)

    updates = []

    # Atualiza flag exumado (se existir)
    if hasattr(sepultado, "exumado") and sepultado.exumado != exumado:
        sepultado.exumado = exumado
        updates.append("exumado")

    # Atualiza status (se existir)
    if hasattr(sepultado, "status"):
        try:
            Status = sepultado.__class__.Status
            novo_status = Status.EXUMADO if exumado else Status.SEPULTADO
        except Exception:
            novo_status = "exumado" if exumado else "sepultado"
        if sepultado.status != novo_status:
            sepultado.status = novo_status
            updates.append("status")

    # Atualiza data_exumacao (se existir)
    if hasattr(sepultado, "data_exumacao"):
        if nova_data_exu is not None and hasattr(nova_data_exu, "date"):
            nova_data_exu = nova_data_exu.date()
        if sepultado.data_exumacao != nova_data_exu:
            sepultado.data_exumacao = nova_data_exu
            updates.append("data_exumacao")

    if updates:
        sepultado.save(update_fields=updates)
