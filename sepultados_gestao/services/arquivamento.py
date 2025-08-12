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
