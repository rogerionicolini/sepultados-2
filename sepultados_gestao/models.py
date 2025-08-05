from django.db import models
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from django.utils.functional import cached_property
from datetime import date
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from django.core.validators import FileExtensionValidator
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey




def data_hoje():
    return timezone.now().date()


# Função auxiliar para proteção contra cadastros sem prefeitura ativa
def validar_prefeitura_obrigatoria(instance):
    if hasattr(instance, 'prefeitura') and not instance.prefeitura:
        raise ValidationError("Uma prefeitura ativa precisa estar selecionada para continuar.")

class Prefeitura(models.Model):
    usuario = models.ForeignKey(
        'aaa_usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Usuário responsável",
        related_name="prefeituras_gerenciadas"
    )
    nome = models.CharField(max_length=255, verbose_name="Nome da Prefeitura")
    cnpj = models.CharField(max_length=18, verbose_name="CNPJ")
    responsavel = models.CharField(max_length=255, verbose_name="Responsável")
    telefone = models.CharField(max_length=20, verbose_name="Telefone", blank=True, null=True)
    email = models.EmailField(verbose_name="E-mail", blank=True, null=True)
    site = models.URLField(verbose_name="Site", blank=True, null=True)

    logradouro = models.CharField(max_length=255, verbose_name="Logradouro")
    endereco_numero = models.CharField(max_length=20, verbose_name="Número")
    endereco_bairro = models.CharField(max_length=100, verbose_name="Bairro", null=True, blank=True)
    endereco_cidade = models.CharField(max_length=100, verbose_name="Cidade")
    endereco_estado = models.CharField(
        max_length=2,
        verbose_name="Estado",
        choices=[
            ('AC', 'AC'), ('AL', 'AL'), ('AP', 'AP'), ('AM', 'AM'), ('BA', 'BA'),
            ('CE', 'CE'), ('DF', 'DF'), ('ES', 'ES'), ('GO', 'GO'), ('MA', 'MA'),
            ('MT', 'MT'), ('MS', 'MS'), ('MG', 'MG'), ('PA', 'PA'), ('PB', 'PB'),
            ('PR', 'PR'), ('PE', 'PE'), ('PI', 'PI'), ('RJ', 'RJ'), ('RN', 'RN'),
            ('RS', 'RS'), ('RO', 'RO'), ('RR', 'RR'), ('SC', 'SC'), ('SP', 'SP'),
            ('SE', 'SE'), ('TO', 'TO'),
        ]
    )
    endereco_cep = models.CharField(max_length=10, verbose_name="CEP")

    brasao = models.ImageField(upload_to='brasoes/', blank=True, null=True, verbose_name="Brasão da Prefeitura")

    # Campos de multa e juros
    multa_percentual = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        verbose_name="Multa por atraso (%)",
        help_text="Percentual da multa cobrada em caso de atraso (ex: 2%)"
    )
    juros_mensal_percentual = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1.00,
        verbose_name="Juros mensal por atraso (%)",
        help_text="Percentual mensal de juros em caso de atraso (ex: 1%)"
    )

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = "Prefeitura"
        verbose_name_plural = "Prefeituras"
        app_label = "sepultados_gestao"

    clausulas_contrato = models.TextField(
        verbose_name="Cláusulas padrão do contrato",
        blank=True,
        help_text="Esse texto será inserido automaticamente no meio dos contratos PDF."
    )
    

class NumeroSequencialGlobal(models.Model):
    prefeitura = models.ForeignKey('Prefeitura', on_delete=models.CASCADE)
    numero = models.PositiveIntegerField()
    ano = models.IntegerField()

    class Meta:
        unique_together = ('prefeitura', 'numero', 'ano')
        verbose_name = "Número Sequencial Global"
        verbose_name_plural = "Números Sequenciais Globais"
        app_label = "sepultados_gestao"

    def __str__(self):
        return f"{self.numero}/{self.ano} - {self.prefeitura}"


from django.db import models
from django.utils.functional import cached_property
from .utils import validar_prefeitura_obrigatoria



from django.db import models
from django.core.exceptions import ValidationError
from django.utils.functional import cached_property
from .utils import validar_prefeitura_obrigatoria


class Cemiterio(models.Model):
    nome = models.CharField(max_length=100)
    endereco = models.CharField(max_length=255, blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    cidade = models.CharField(max_length=100, blank=True, null=True)
    estado = models.CharField(
        max_length=2,
        choices=Prefeitura._meta.get_field('endereco_estado').choices,
        blank=True,
        null=True
    )
    prefeitura = models.ForeignKey(Prefeitura, on_delete=models.CASCADE)
    tempo_minimo_exumacao = models.PositiveIntegerField(
        default=36,
        verbose_name="Tempo mínimo para exumação (em meses)",
        help_text="Tempo mínimo exigido entre sepultamentos no mesmo túmulo (em meses)"
    )

    def clean(self):
        # Mantém a validação obrigatória da prefeitura
        if not self.prefeitura:
            raise ValidationError("A prefeitura vinculada é obrigatória para este registro.")

    def __str__(self):
        return self.nome

    def delete(self, *args, **kwargs):
        if self.quadra_set.exists():
            raise ValidationError("Não é possível excluir este cemitério. Existem quadras vinculadas.")
        super().delete(*args, **kwargs)

    
    class Meta:
        verbose_name = "Cemitério"
        verbose_name_plural = "Cemitérios"
        app_label = "sepultados_gestao"


from django.db import models
from django.core.exceptions import ValidationError
from django.utils.functional import cached_property
from .models import Cemiterio  # ajuste conforme estrutura real
from .utils import validar_prefeitura_obrigatoria


class Quadra(models.Model):
    codigo = models.CharField(max_length=20)
    cemiterio = models.ForeignKey(Cemiterio, on_delete=models.CASCADE)

    @cached_property
    def prefeitura(self):
        return self.cemiterio.prefeitura if self.cemiterio_id else None

    def clean(self):
        if not self.cemiterio_id:
            raise ValidationError("Selecione um cemitério válido.")
        if not self.cemiterio.prefeitura_id:
            raise ValidationError("O cemitério selecionado não está vinculado a uma prefeitura.")
        self.prefeitura = self.cemiterio.prefeitura

    def delete(self, *args, **kwargs):
        if self.tumulo_set.exists():
            raise ValidationError("Não é possível excluir esta quadra. Existem túmulos vinculados.")
        super().delete(*args, **kwargs)


    def __str__(self):
        return self.codigo

    class Meta:
        app_label = "sepultados_gestao"


from django.db import models
from django.core.exceptions import ValidationError
from django.utils.functional import cached_property
from .utils import validar_prefeitura_obrigatoria

class Tumulo(models.Model):
    STATUS_CHOICES = (
        ('disponivel', 'Disponível'),
        ('ocupado', 'Ocupado'),
        ('reservado', 'Reservado'),
    )

    TIPO_ESTRUTURA_CHOICES = [
        ('tumulo', 'Túmulo'),
        ('perpetua', 'Perpétua'),
        ('sepultura', 'Sepultura'),
        ('jazigo', 'Jazigo'),
        ('outro', 'Outro'),
    ]

    cemiterio = models.ForeignKey(
        'Cemiterio',
        on_delete=models.CASCADE,
        verbose_name="Cemitério"
    )
    tipo_estrutura = models.CharField(
        max_length=20,
        choices=TIPO_ESTRUTURA_CHOICES,
        default='tumulo',
        verbose_name="Tipo de estrutura"
    )
    identificador = models.CharField(max_length=50)
    quadra = models.ForeignKey('Quadra', on_delete=models.CASCADE)
    usar_linha = models.BooleanField(default=False, verbose_name="Usar linha")
    linha = models.PositiveIntegerField(null=True, blank=True, verbose_name="Linha")
    reservado = models.BooleanField(default=False, verbose_name="Reservar este túmulo")
    motivo_reserva = models.CharField(max_length=255, blank=True, verbose_name="Motivo da reserva")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='disponivel', editable=False)

    capacidade = models.PositiveIntegerField(
        default=1,
        verbose_name="Capacidade de sepultamentos",
        help_text="Número máximo de sepultamentos simultâneos neste túmulo."
    )

    @cached_property
    def prefeitura(self):
        return self.quadra.cemiterio.prefeitura if self.quadra and self.quadra.cemiterio else None

    def clean(self):
        if self.usar_linha and not self.linha:
            raise ValidationError({'linha': 'Informe o número da linha.'})

        if self.reservado and not self.motivo_reserva:
            raise ValidationError({'motivo_reserva': 'Informe o motivo da reserva.'})

        validar_prefeitura_obrigatoria(self)

        if self.quadra_id and self.cemiterio_id:
            from .models import Quadra
            quadra = Quadra.objects.filter(id=self.quadra_id).first()
            if not quadra:
                raise ValidationError({'quadra': 'A quadra informada não foi encontrada.'})
            if quadra.cemiterio_id != self.cemiterio_id:
                raise ValidationError({'quadra': 'A quadra selecionada não pertence ao cemitério informado.'})

    def calcular_status_dinamico(self):
        from .models import Sepultado

        if not self.pk:
            return self.status  # ou 'disponivel'

        if self.reservado:
            return 'reservado'

        sepultados_ativos = Sepultado.objects.filter(
            tumulo=self,
            exumado=False,
            trasladado=False
        ).count()

        return 'ocupado' if sepultados_ativos >= self.capacidade else 'disponivel'

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        self.full_clean()
        super().save(*args, **kwargs)

        if is_new:
            self.status = self.calcular_status_dinamico()
            super().save(update_fields=["status"])

    def __str__(self):
        partes = []
        if self.identificador is not None:
            partes.append(f"{self.identificador:02}")
        if self.usar_linha and self.linha is not None:
            partes.append(f"L {self.linha:02}")
        if self.quadra:
            partes.append(str(self.quadra))  # já está formatado como "Quadra 01"
        return " ".join(partes)






    def atualizar_status(self):
        self.status = self.calcular_status_dinamico()
        self.save(update_fields=["status"])

    class Meta:
        verbose_name = "Túmulo"
        verbose_name_plural = "Túmulos"
        app_label = "sepultados_gestao"

from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from dateutil.relativedelta import relativedelta


class Sepultado(models.Model):
    SEXO_CHOICES = [
        ('M', 'Masculino'),
        ('F', 'Feminino'),
        ('O', 'Outro'),
        ('NI', 'Não Informado'),
    ]

    ESTADO_CIVIL_CHOICES = [
        ('SOLTEIRO', 'Solteiro(a)'),
        ('CASADO', 'Casado(a)'),
        ('VIUVO', 'Viúvo(a)'),
        ('DIVORCIADO', 'Divorciado(a)'),
        ('NAO_INFORMADO', 'Não Informado'),
    ]

    numero_sepultamento = models.CharField(
        max_length=20,
        verbose_name="Número do sepultamento",
        editable=False,
        null=True,
        blank=True
    )

    nome = models.CharField(max_length=255)
    cpf_sepultado = models.CharField("CPF", max_length=18, blank=True, null=True)
    sexo = models.CharField(max_length=2, choices=SEXO_CHOICES, default='NI', verbose_name='Sexo')
    sexo_outro_descricao = models.CharField("Descrição do Sexo (se Outro)", max_length=100, blank=True, null=True)

    data_nascimento = models.DateField(null=True, blank=True)
    local_nascimento = models.CharField(max_length=255, blank=True, null=True)
    nacionalidade = models.CharField(max_length=100, blank=True, null=True)
    cor_pele = models.CharField(max_length=100, blank=True, null=True)
    estado_civil = models.CharField(max_length=20, choices=ESTADO_CIVIL_CHOICES, blank=True, null=True)
    nome_conjuge = models.CharField("Nome do Cônjuge", max_length=255, blank=True, null=True)
    nome_pai = models.CharField("Nome do Pai", max_length=150, blank=True, null=True)
    nome_mae = models.CharField("Nome da Mãe", max_length=150, blank=True, null=True)
    profissao = models.CharField(max_length=255, blank=True, null=True)
    grau_instrucao = models.CharField("Escolaridade", max_length=255, blank=True, null=True)

    logradouro = models.CharField("Logradouro", max_length=255, blank=True, null=True)
    numero = models.CharField("Número", max_length=20, blank=True, null=True)
    bairro = models.CharField("Bairro", max_length=100, blank=True, null=True)
    cidade = models.CharField("Cidade", max_length=100, blank=True, null=True)
    estado = models.CharField("Estado", max_length=2, blank=True, null=True)

    data_falecimento = models.DateField(null=True, blank=True)
    hora_falecimento = models.TimeField(null=True, blank=True)
    local_falecimento = models.CharField(max_length=255, blank=True, null=True)
    causa_morte = models.CharField(max_length=255, blank=True, null=True)
    medico_responsavel = models.CharField(max_length=255, blank=True, null=True)
    crm_medico = models.CharField(max_length=50, blank=True, null=True)

    idade_ao_falecer = models.PositiveIntegerField(editable=False, null=True, blank=True)

    cartorio_nome = models.CharField(max_length=255, blank=True, null=True)
    cartorio_numero_registro = models.CharField(max_length=100, blank=True, null=True)
    cartorio_livro = models.CharField(max_length=50, blank=True, null=True)
    cartorio_folha = models.CharField(max_length=50, blank=True, null=True)
    cartorio_data_registro = models.DateField(null=True, blank=True)

    tumulo = models.ForeignKey(
        'Tumulo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Túmulo"
    )

    ordem_no_tumulo = models.PositiveIntegerField(null=True, blank=True)
    data_sepultamento = models.DateField(null=True, blank=True)
    observacoes = models.TextField(blank=True, null=True)

    exumado = models.BooleanField(default=False)
    data_exumacao = models.DateField(null=True, blank=True)
    trasladado = models.BooleanField(default=False)
    data_translado = models.DateField(null=True, blank=True)

    # Dados do responsável pelo sepultamento
    nome_responsavel = models.CharField("Nome", max_length=255, blank=True, null=True)
    cpf = models.CharField("CPF", max_length=18, blank=True, null=True)
    endereco = models.CharField("Endereço", max_length=255, blank=True, null=True)
    telefone = models.CharField("Telefone", max_length=20, blank=True, null=True)

    # Pagamento
    forma_pagamento = models.CharField(
        max_length=10,
        choices=[
            ('gratuito', 'Gratuito'),
            ('avista', 'À Vista'),
            ('parcelado', 'Parcelado')
        ],
        default='gratuito',
        verbose_name="Forma de Pagamento"
    )

    quantidade_parcelas = models.PositiveIntegerField(
        verbose_name="Quantidade de Parcelas",
        null=True,
        blank=True
    )

    valor = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor",
        default=0.00
    )

    importado = models.BooleanField(default=False, verbose_name="Importado via planilha")


    from functools import cached_property

    @cached_property
    def prefeitura(self):
        try:
            return self.tumulo.quadra.cemiterio.prefeitura
        except AttributeError:
            return None


    def calcular_idade(self):
        if self.data_nascimento and self.data_falecimento:
            return self.data_falecimento.year - self.data_nascimento.year - (
                (self.data_falecimento.month, self.data_falecimento.day) < (self.data_nascimento.month, self.data_nascimento.day)
            )
        return None

    def save(self, *args, **kwargs):
        from .utils import gerar_receitas_para_servico, gerar_numero_sequencial_global
        from .models import Sepultado
        from django.core.exceptions import ValidationError

        ignorar_validacao = kwargs.pop("ignorar_validacao_contrato", False)
        criando = self.pk is None

        if criando and not self.numero_sepultamento:
            self.numero_sepultamento = gerar_numero_sequencial_global(self.tumulo.quadra.cemiterio.prefeitura)

        if not ignorar_validacao:
            self.full_clean()  # Executa o clean completo, com validações de contrato

        self.idade_ao_falecer = self.calcular_idade()
        super().save(*args, **kwargs)

        # Validação final para gratuito
        if criando:
            if self.forma_pagamento == 'gratuito' and self.valor > 0:
                raise ValidationError("Sepultamento gratuito deve ter valor 0,00.")

            gerar_receitas_para_servico(
                servico=self,
                descricao="Sepultamento",
                forma_pagamento=self.forma_pagamento,
                valor_total=self.valor,
                parcelas=self.quantidade_parcelas or 1,
                nome=self.nome_responsavel,
                cpf=self.cpf,
                numero_documento=self.numero_sepultamento
            )

        # Atualiza o status do túmulo
        if self.tumulo:
            self.tumulo.status = self.tumulo.calcular_status_dinamico()
            self.tumulo.save(update_fields=["status"])

    def __str__(self):
        return self.nome

    def clean(self):
        from django.core.exceptions import ValidationError
        from .models import ConcessaoContrato, Exumacao, Translado    
        from django.utils import timezone
        from dateutil.relativedelta import relativedelta

        super().clean()
        erros = {}

        # Campos obrigatórios
        if not self.tumulo_id:
            erros['tumulo'] = 'O campo túmulo é obrigatório.'
        if not self.data_falecimento:
            erros['data_falecimento'] = 'A data do falecimento é obrigatória.'
        if not self.data_sepultamento:
            erros['data_sepultamento'] = 'A data do sepultamento é obrigatória.'

        if erros:
            raise ValidationError(erros)

        if not self.tumulo_id:
            return

        # Verifica se o túmulo possui contrato de concessão
        contrato_existente = ConcessaoContrato.objects.filter(tumulo=self.tumulo).exists()
        if not contrato_existente:
            raise ValidationError({
                'tumulo': "Este túmulo não possui contrato de concessão. O sepultamento não é permitido."
            })

        # Verifica a capacidade do túmulo
        tumulo = self.tumulo
        capacidade = tumulo.capacidade

        # Filtra apenas os sepultados ainda ativos
        from .models import Sepultado  # Importação defensiva
        sepultados_ativos = Sepultado.objects.filter(
            tumulo=tumulo,
            exumado=False,
            trasladado=False
        )

        if self.pk:
            sepultados_ativos = sepultados_ativos.exclude(pk=self.pk)

        # Valida capacidade + exumações apenas se for um novo sepultamento
        if not self.pk:
            if sepultados_ativos.count() >= capacidade:
                try:
                    cemit = tumulo.quadra.cemiterio
                except Exception:
                    raise ValidationError('Não foi possível verificar o cemitério do túmulo selecionado.')

                meses_minimos = cemit.tempo_minimo_exumacao or 36
                data_limite = timezone.now().date() - relativedelta(months=meses_minimos)

                exumacoes_validas = Exumacao.objects.filter(
                    tumulo=tumulo,
                    data__lte=data_limite
                ).count()

                if exumacoes_validas == 0:
                    raise ValidationError(
                        f"Este túmulo já atingiu a capacidade máxima de {capacidade} sepultados. "
                        f"É necessário que pelo menos uma exumação tenha ocorrido há mais de {meses_minimos} meses."
                    )

    def delete(self, *args, **kwargs):
        tumulo = self.tumulo
        super().delete(*args, **kwargs)
        if tumulo:
            tumulo.status = tumulo.calcular_status_dinamico()
            tumulo.save(update_fields=["status"])
    @property
    def status_display(self):
        if self.trasladado:
            return "Transladado"
        if self.exumado:
            return "Exumado"
        return "Sepultado"
    
    @property
    def idade(self):
        return self.calcular_idade()



    class Meta:
        verbose_name = "Sepultado"
        verbose_name_plural = "Sepultados"


from .utils import gerar_receitas_para_servico
from dateutil.relativedelta import relativedelta
from datetime import datetime, date
from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.core.validators import RegexValidator
from django.contrib.auth import get_user_model



class ConcessaoContrato(models.Model):
    numero_contrato = models.CharField(
        max_length=20,
        verbose_name="Número do Contrato",
        editable=False,
        null=True,
        blank=True
    )
    nome = models.CharField("Nome", max_length=255)

    cpf = models.CharField(
        "CPF/CNPJ",
        max_length=18,
        validators=[
            RegexValidator(
                regex=r'^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})$',
                message="Informe um CPF ou CNPJ válido com máscara (ex: 000.000.000-00 ou 00.000.000/0000-00)."
            )
        ]
    )

    telefone = models.CharField(max_length=20, verbose_name="Telefone", null=True, blank=True)

    logradouro = models.CharField(max_length=255, verbose_name="Logradouro", null=True, blank=True)
    endereco_numero = models.CharField(max_length=20, verbose_name="Número", null=True, blank=True)
    endereco_bairro = models.CharField(max_length=100, verbose_name="Bairro", null=True, blank=True)
    endereco_cidade = models.CharField(max_length=100, verbose_name="Cidade", null=True, blank=True)
    endereco_estado = models.CharField(
        max_length=2,
        choices=Prefeitura._meta.get_field('endereco_estado').choices,
        verbose_name="Estado",
        null=True,
        blank=True
    )
    endereco_cep = models.CharField(max_length=10, verbose_name="CEP", null=True, blank=True)

    data_contrato = models.DateField(verbose_name="Data do contrato", default=timezone.now)

    tumulo = models.ForeignKey('Tumulo', on_delete=models.CASCADE, verbose_name="Túmulo")
    prefeitura = models.ForeignKey('Prefeitura', on_delete=models.CASCADE, verbose_name="Prefeitura")

    forma_pagamento = models.CharField(
        max_length=10,
        choices=[('gratuito', 'Gratuito'), ('avista', 'À Vista'), ('parcelado', 'Parcelado')],
        default='gratuito',
        verbose_name="Forma de Pagamento"
    )

    quantidade_parcelas = models.PositiveIntegerField(verbose_name="Quantidade de Parcelas", null=True, blank=True)
    valor_total = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valor total")
    observacoes = models.TextField(blank=True, null=True, verbose_name="Observações")
    usuario_registro = models.ForeignKey(
        'aaa_usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Usuário responsável",
        related_name="contratos_registrados"
    )
    def clean(self):
        if not self.tumulo_id:
            raise ValidationError({"tumulo": "Selecione um túmulo para o contrato."})

        if self.pk is None and ConcessaoContrato.objects.filter(tumulo_id=self.tumulo_id).exists():
            raise ValidationError({"tumulo": "Este túmulo já está vinculado a outro contrato."})

        if self.tumulo:
            sepultados = Sepultado.objects.filter(tumulo=self.tumulo)
            tem_nao_importado = sepultados.filter(importado=False).exists()

            if self.tumulo.status in ['reservado', 'ocupado'] and tem_nao_importado:
                raise ValidationError({
                    "tumulo": f"Túmulo {self.tumulo} está marcado como '{self.tumulo.get_status_display()}'. "
                              f"Só é possível gerar contrato se o túmulo estiver disponível ou ocupado apenas com registros históricos."
                })

        if self.forma_pagamento == 'gratuito' and self.valor_total != Decimal("0.00"):
            raise ValidationError({'valor_total': "Contratos gratuitos devem ter valor R$ 0,00."})

    def save(self, *args, **kwargs):
        criando = self.pk is None
        print(">>> Entrou no save() de ConcessaoContrato")

        if criando:
            print(">>> Criando novo contrato")
            self.data_contrato = date.today()

            if not self.numero_contrato:
                self.numero_contrato = gerar_numero_sequencial_global(self.prefeitura)

        super().save(*args, **kwargs)

        if criando:
            gerar_receitas_para_servico(
                servico=self,
                descricao="Contrato de Concessão",
                forma_pagamento=self.forma_pagamento,
                valor_total=self.valor_total,
                parcelas=self.quantidade_parcelas or 1,
                nome=self.nome,
                cpf=self.cpf,
                numero_documento=self.numero_contrato
            )

    def delete(self, *args, **kwargs):
        if Receita.objects.filter(contrato=self).exists():
            raise Exception("Não é possível excluir este contrato. Existem receitas vinculadas.")

        sepultados_ativos = Sepultado.objects.filter(tumulo=self.tumulo, exumado=False, trasladado=False)
        if sepultados_ativos.exists():
            raise Exception("Não é possível excluir este contrato. Há sepultados no túmulo que ainda não foram trasladados.")

        super().delete(*args, **kwargs)

        self.tumulo.status = self.tumulo.calcular_status_dinamico()
        self.tumulo.save(update_fields=["status"])

    def __str__(self):
        return f"{self.numero_contrato or 'Contrato'} - {self.nome} - {self.tumulo.identificador}"

    class Meta:
        verbose_name = "Contrato de Concessão"
        verbose_name_plural = "Contratos de Concessão"
        app_label = "sepultados_gestao"


from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from sepultados_gestao.utils import gerar_numero_sequencial_global, gerar_receitas_para_servico
from sepultados_gestao.models import Prefeitura

class Exumacao(models.Model):
    prefeitura = models.ForeignKey(Prefeitura, on_delete=models.CASCADE)
    sepultado = models.ForeignKey("Sepultado", on_delete=models.PROTECT)
    tumulo = models.ForeignKey(
        'Tumulo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Túmulo de Origem"
    )
    data = models.DateField(default=timezone.now)
    motivo = models.TextField(blank=True, null=True)
    observacoes = models.TextField(blank=True, null=True)

    # Dados do responsável
    nome_responsavel = models.CharField("Nome", max_length=255, blank=True, null=True)
    cpf = models.CharField("CPF", max_length=18, blank=True, null=True)
    endereco = models.CharField("Endereço", max_length=255, blank=True, null=True)
    telefone = models.CharField("Telefone", max_length=20, blank=True, null=True)

    forma_pagamento = models.CharField(
        max_length=10,
        choices=[('gratuito', 'Gratuito'), ('avista', 'À Vista'), ('parcelado', 'Parcelado')],
        default='gratuito',
        verbose_name="Forma de Pagamento"
    )
    quantidade_parcelas = models.PositiveIntegerField("Quantidade de Parcelas", null=True, blank=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valor", default=0.00)

    numero_documento = models.CharField(max_length=20, blank=True, editable=False)

    def clean(self):
        super().clean()

        sepultado = getattr(self, 'sepultado', None)
        if not sepultado:
            return

        if sepultado.exumado and not self.pk:
            raise ValidationError("Este sepultado já foi exumado. Não é possível registrar outra exumação.")

        sepultamento_data = sepultado.data_sepultamento
        tumulo = getattr(sepultado, 'tumulo', None)
        quadra = getattr(tumulo, 'quadra', None)
        cemiterio = getattr(quadra, 'cemiterio', None)

        if not cemiterio:
            raise ValidationError("Não foi possível identificar o cemitério do sepultado para validar o tempo mínimo.")

        minimo_meses = cemiterio.tempo_minimo_exumacao or 0

        if not self.data:
            raise ValidationError("A data da exumação é obrigatória.")

        if self.data and sepultamento_data:
            try:
                dias_entre = (self.data - sepultamento_data).days
                if dias_entre < minimo_meses * 30:
                    raise ValidationError(
                        f"É necessário aguardar no mínimo {minimo_meses} meses após o sepultamento para realizar a exumação."
                    )
            except Exception:
                raise ValidationError("Não foi possível validar a data da exumação. Verifique se a data foi preenchida corretamente.")

        # NOVA REGRA — exigir contrato de concessão no túmulo
        if tumulo:
            contrato_existe = ConcessaoContrato.objects.filter(tumulo=tumulo).exists()
            if not contrato_existe:
                raise ValidationError({
                    'tumulo': 'Este túmulo não possui contrato de concessão. A exumação não é permitida.'
                })



    def save(self, *args, **kwargs):
        criando = self.pk is None

        if not self.sepultado:
            raise ValidationError("O campo 'Sepultado' é obrigatório.")
# SEMPRE força prefeitura com base no sepultado
        if self.sepultado and self.sepultado.tumulo:
            self.prefeitura = self.sepultado.tumulo.quadra.cemiterio.prefeitura
        elif not self.prefeitura:
            raise ValidationError("Não foi possível determinar a prefeitura para esta exumação.")

        # Geração de número
        if criando and not self.numero_documento:
            self.numero_documento = gerar_numero_sequencial_global(self.prefeitura)

        super().save(*args, **kwargs)

        # Geração da receita e atualização do sepultado
        if criando:
            if self.forma_pagamento == 'gratuito' and (self.valor or 0) > 0:
                raise ValidationError("Exumação gratuita deve ter valor R$ 0,00.")
            if self.forma_pagamento != 'gratuito' and (not self.valor or self.valor <= 0):
                raise ValidationError("Informe um valor válido para exumação paga.")


            gerar_receitas_para_servico(
                servico=self,
                descricao="Taxa de Exumação",
                forma_pagamento=self.forma_pagamento,
                valor_total=self.valor,
                parcelas=self.quantidade_parcelas or 1,
                nome=self.nome_responsavel,
                cpf=self.cpf,
                numero_documento=self.numero_documento
            )

            self.sepultado.exumado = True
            self.sepultado.data_exumacao = self.data
            self.sepultado.save()

      
    def __str__(self):
        return f"Exumação de {self.sepultado.nome}" if self.sepultado_id else "Exumação"

    class Meta:
        verbose_name = "Exumação"
        verbose_name_plural = "Exumações"

from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from datetime import timedelta

class Translado(models.Model):
    sepultado = models.ForeignKey("Sepultado", on_delete=models.PROTECT)
    data = models.DateField(default=timezone.now)
    motivo = models.TextField(blank=True, null=True)
    observacoes = models.TextField(blank=True, null=True)

    DESTINOS = [
        ('outro_tumulo', 'Outro Túmulo'),
        ('outro_cemiterio', 'Outro Cemitério'),
        ('ossario', 'Ossário'),
    ]
    destino = models.CharField(max_length=20, choices=DESTINOS)
    tumulo_destino = models.ForeignKey("Tumulo", on_delete=models.SET_NULL, null=True, blank=True)
    cemiterio_nome = models.CharField("Cemitério", max_length=255, blank=True, null=True)
    cemiterio_endereco = models.CharField("Endereço do Cemitério", max_length=255, blank=True, null=True)

    nome_responsavel = models.CharField("Nome", max_length=255, blank=True, null=True)
    cpf = models.CharField("CPF", max_length=18, blank=True, null=True)
    endereco = models.CharField("Endereço", max_length=255, blank=True, null=True)
    telefone = models.CharField("Telefone", max_length=20, blank=True, null=True)

    forma_pagamento = models.CharField(
        max_length=10,
        choices=[('gratuito', 'Gratuito'), ('avista', 'À Vista'), ('parcelado', 'Parcelado')],
        default='gratuito',
        verbose_name="Forma de Pagamento"
    )
    quantidade_parcelas = models.PositiveIntegerField("Quantidade de Parcelas", null=True, blank=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valor", default=0.00)

    numero_documento = models.CharField(max_length=20, blank=True, editable=False)

    def clean(self):
        super().clean()
        from .models import ConcessaoContrato, Exumacao

        if not self.sepultado:
            raise ValidationError("O campo Sepultado é obrigatório.")

        if not self.sepultado.exumado:
            raise ValidationError("Só é possível realizar o translado de sepultados que já foram exumados.")

        translados_existentes = Translado.objects.filter(sepultado=self.sepultado)
        if self.pk:
            translados_existentes = translados_existentes.exclude(pk=self.pk)

        if translados_existentes.exists():
            raise ValidationError("Este sepultado já foi trasladado anteriormente. Não é possível duplicar.")

        # Verifica a capacidade e contrato do túmulo de destino, se for outro túmulo
        if self.destino == 'outro_tumulo' and self.tumulo_destino:
            # Verifica se há contrato de concessão
            contrato_existe = ConcessaoContrato.objects.filter(tumulo=self.tumulo_destino).exists()
            if not contrato_existe:
                raise ValidationError({
                    'tumulo_destino': "Este túmulo não possui contrato de concessão. A transferência não é permitida."
                })

            sepultados_no_destino = self.tumulo_destino.sepultado_set.filter(trasladado=False)
            capacidade = self.tumulo_destino.capacidade or 1

            if sepultados_no_destino.count() >= capacidade:
                # Se está cheio, verifica se existe exumação válida
                cemit = self.tumulo_destino.quadra.cemiterio
                meses_min = cemit.tempo_minimo_exumacao or 0
                dias_min = meses_min * 30

                exumacoes_validas = []
                for s in sepultados_no_destino:
                    data_exumacao = getattr(s, 'data_exumacao', None)
                    if not data_exumacao:
                        ex = Exumacao.objects.filter(sepultado=s).order_by('-data').first()
                        data_exumacao = ex.data if ex else None
                    if data_exumacao and (self.data - data_exumacao).days >= dias_min:
                        exumacoes_validas.append(s)

                if not exumacoes_validas:
                    raise ValidationError({
                        'tumulo_destino': f"O túmulo de destino atingiu sua capacidade máxima de {capacidade} sepultados. "
                                          f"É necessário que pelo menos uma exumação tenha ocorrido há mais de {meses_min} meses."
                    })

        # Validação do valor gratuito
        if self.forma_pagamento == 'gratuito' and self.valor > 0:
            raise ValidationError("Translado gratuito deve ter valor 0,00.")

    def save(self, *args, **kwargs):
        from .utils import gerar_receitas_para_servico, gerar_numero_sequencial_global

        criando = self.pk is None
        sep = self.sepultado

        # número do documento
        if criando and not self.numero_documento:
            self.numero_documento = gerar_numero_sequencial_global(self.prefeitura)

        # salva o translado
        super().save(*args, **kwargs)

        if criando:
            # receita
            gerar_receitas_para_servico(
                servico=self,
                descricao="Taxa de Translado",
                forma_pagamento=self.forma_pagamento,
                valor_total=self.valor,
                parcelas=self.quantidade_parcelas or 1,
                nome=self.nome_responsavel,
                cpf=self.cpf,
                numero_documento=self.numero_documento
            )

            # atualiza status do sepultado (mantendo-o no túmulo de origem)
            sep.trasladado = True
            sep.exumado = True
            sep.data_translado = self.data
            # ⚠️ não altere sep.tumulo aqui – isso preserva o histórico no túmulo de origem
            sep.save(update_fields=['trasladado', 'exumado', 'data_translado'])

    def delete(self, *args, **kwargs):
        from .models import Sepultado

        if self.receitas.exists():
            raise ValidationError("Não é possível excluir: existem receitas vinculadas.")

        sep = self.sepultado  # Sepultado original

        # Reverte status no sepultado de origem
        sep.trasladado = False
        sep.data_translado = None

        # ⚠️ Verifica se ele já havia sido exumado antes do translado
        havia_exumacao = Sepultado.objects.filter(
            id=sep.id,
            exumado=True
        ).exists()

        sep.exumado = True if havia_exumacao else False
        sep.save(update_fields=["trasladado", "data_translado", "exumado"])

        # Exclui o clone do túmulo de destino
        if self.destino == 'outro_tumulo' and self.tumulo_destino:
            Sepultado.objects.filter(
                tumulo=self.tumulo_destino,
                nome=sep.nome,
                data_falecimento=sep.data_falecimento,
                data_sepultamento=sep.data_sepultamento,
                exumado=True,
                trasladado=False
            ).exclude(id=sep.id).delete()

        super().delete(*args, **kwargs)





    @property
    def tumulo_origem(self):
        return self.sepultado.tumulo

    @property
    def destino_resumido(self):
        if self.destino == 'outro_tumulo' and self.tumulo_destino:
            return str(self.tumulo_destino)
        elif self.destino == 'ossario':
            return "Ossário"
        elif self.destino == 'outro_cemiterio':
            return f"{self.cemiterio_nome or ''}".strip()
        return "Não informado"

    @property
    def prefeitura(self):
        try:
            return self.sepultado.tumulo.quadra.cemiterio.prefeitura
        except:
            return None

    def __str__(self):
        return f"Translado de {self.sepultado.nome}"

    class Meta:
        verbose_name = "Translado"
        verbose_name_plural = "Traslados"




class Plano(models.Model):
    nome = models.CharField(max_length=50, unique=True)
    descricao = models.TextField(blank=True, null=True)
    preco_mensal = models.DecimalField(max_digits=8, decimal_places=2)
    usuarios_min = models.PositiveIntegerField()
    usuarios_max = models.PositiveIntegerField()
    sepultados_max = models.PositiveIntegerField(null=True, blank=True)  # Null = Ilimitado
    inclui_api = models.BooleanField(default=False)
    inclui_erp = models.BooleanField(default=False)
    inclui_suporte_prioritario = models.BooleanField(default=False)

    def __str__(self):
        return self.nome


class Licenca(models.Model):
    prefeitura = models.OneToOneField('Prefeitura', on_delete=models.CASCADE)
    plano = models.ForeignKey('Plano', on_delete=models.PROTECT)
    data_inicio = models.DateField(default=data_hoje)
    anos_contratados = models.PositiveIntegerField(default=1)
    valor_mensal_atual = models.DecimalField(max_digits=8, decimal_places=2)
    percentual_reajuste_anual = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.00,
        verbose_name="Reajuste anual (%)"
    )
    
    # Campos herdados do plano, salvos na licença
    usuarios_min = models.PositiveIntegerField()
    usuarios_max = models.PositiveIntegerField()
    sepultados_max = models.PositiveIntegerField(null=True, blank=True)
    inclui_api = models.BooleanField(default=False)
    inclui_erp = models.BooleanField(default=False)
    inclui_suporte_prioritario = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Licença"
        verbose_name_plural = "Licenças"

    def __str__(self):
        return f"Licença de {self.prefeitura.nome} - {self.plano.nome}"

    def save(self, *args, **kwargs):
        if not self.pk:
            # Copia os dados do plano no momento da criação
            self.usuarios_min = self.plano.usuarios_min
            self.usuarios_max = self.plano.usuarios_max
            self.sepultados_max = self.plano.sepultados_max
            self.inclui_api = self.plano.inclui_api
            self.inclui_erp = self.plano.inclui_erp
            self.inclui_suporte_prioritario = self.plano.inclui_suporte_prioritario
        super().save(*args, **kwargs)

    @property
    def data_fim(self):
        """Calcula a data de fim da licença com base nos anos contratados."""
        if self.anos_contratados == 0:
            return None
        return self.data_inicio + timedelta(days=365 * self.anos_contratados)

    @property
    def meses_contrato(self):
        return self.anos_contratados * 12

    @property
    def valor_mensal_reajustado(self):
        """
        Calcula o valor mensal reajustado com base no percentual definido
        e no número de anos passados desde o início.
        """
        if self.valor_mensal_atual is None:
            return None

        anos_passados = (timezone.now().date() - self.data_inicio).days // 365
        valor = float(self.valor_mensal_atual)
        reajuste_percentual = float(self.percentual_reajuste_anual or 0) / 100
        for _ in range(anos_passados):
            valor *= (1 + reajuste_percentual)
        return round(valor, 2)

    @property
    def expirada(self):
        """Verifica se a licença já venceu."""
        if self.anos_contratados == 0:
            return False
        return timezone.now().date() > self.data_fim



from django.db import models, transaction
from decimal import Decimal
from datetime import date
from .utils import gerar_numero_sequencial_global


class Receita(models.Model):
    numero_documento = models.CharField(
        max_length=20,
        verbose_name="Número",
        editable=False,
        null=True,
        blank=True
    )
    
    prefeitura = models.ForeignKey(
        'Prefeitura',
        on_delete=models.CASCADE,
        editable=False
    )
    
    contrato = models.ForeignKey(
        'ConcessaoContrato',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Contrato",
        related_name='receitas'
    )

    exumacao = models.ForeignKey(
        'Exumacao',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Exumação",
        related_name='receitas'
    )

    translado = models.ForeignKey(
        'Translado',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Translado",
        related_name='receitas'
    )

    sepultado = models.ForeignKey(
        'Sepultado',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Sepultado",
        related_name='receitas'
    )

    nome = models.CharField(
        max_length=255,
        verbose_name="Nome",
        blank=True,
        null=True
    )

    cpf = models.CharField(
        max_length=18,
        verbose_name="CPF/CNPJ",
        blank=True,
        null=True
    )

    descricao = models.CharField(
        max_length=255,
        verbose_name="Descrição",
        editable=False
    )

    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor total",
        editable=False
    )

    desconto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Desconto"
    )

    valor_pago = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Valor pago"
    )

    valor_em_aberto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        editable=False,
        verbose_name="Valor em aberto"
    )

    data_vencimento = models.DateField(
        verbose_name="Data de vencimento",
        editable=False
    )

    data_pagamento = models.DateField(
        blank=True,
        null=True,
        verbose_name="Data de pagamento"
    )

    status = models.CharField(
        max_length=20,
        choices=[('aberto', 'Aberto'), ('parcial', 'Parcial'), ('pago', 'Pago')],
        default='aberto',
        editable=False
    )

    multa = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        editable=False,
        verbose_name="Multa"
    )

    juros = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        editable=False,
        verbose_name="Juros"
    )

    mora_diaria = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        editable=False,
        verbose_name="Mora Diária"
    )

    def calcular_multa_juros(self):
        if self.data_vencimento and date.today() > self.data_vencimento:
            dias_atraso = (date.today() - self.data_vencimento).days
            config = self.prefeitura
            multa_percentual = getattr(config, 'multa_percentual', Decimal('2.00'))
            juros_percentual = getattr(config, 'juros_percentual', Decimal('1.00'))
            mora_diaria = getattr(config, 'mora_diaria', Decimal('0.10'))
            base = self.valor_total
            self.multa = (base * multa_percentual / 100).quantize(Decimal("0.01"))
            self.juros = (base * juros_percentual / 100).quantize(Decimal("0.01"))
            self.mora_diaria = (mora_diaria * dias_atraso).quantize(Decimal("0.01"))
        else:
            self.multa = Decimal("0.00")
            self.juros = Decimal("0.00")
            self.mora_diaria = Decimal("0.00")

    def save(self, *args, **kwargs):
        if not self.numero_documento:
            if self.exumacao:
                self.numero_documento = self.exumacao.numero_documento
                self.descricao = "Exumação"
            elif self.translado:
                self.numero_documento = self.translado.numero_documento
                self.descricao = "Translado"
            elif self.contrato:
                self.numero_documento = self.contrato.numero_contrato
                self.descricao = "Contrato de Concessão"
            else:
                self.numero_documento = gerar_numero_sequencial_global(self.prefeitura)
                self.descricao = "Receita Diversa"

        self.calcular_multa_juros()

        total_corrigido = (
            self.valor_total + self.multa + self.juros + self.mora_diaria - self.desconto
        ).quantize(Decimal('0.01'))

        valor_pago = (self.valor_pago or Decimal("0.00")).quantize(Decimal('0.01'))
        self.valor_em_aberto = max(total_corrigido - valor_pago, Decimal("0.00")).quantize(Decimal('0.01'))

        # Status e pagamento
        if valor_pago >= total_corrigido:
            self.status = 'pago'
            self.data_pagamento = date.today()
        elif valor_pago > 0:
            self.status = 'pago'  # pago parcial — gera nova receita
            self.data_pagamento = date.today()
        else:
            self.status = 'aberto'
            self.data_pagamento = None

        criar_nova = False
        valor_restante = self.valor_em_aberto

        if self.pk and valor_restante > 0 and valor_pago > 0:
            from .models import Receita
            existe = Receita.objects.filter(
                numero_documento=self.numero_documento,
                status="aberto",
                valor_total=valor_restante
            ).exists()
            if not existe:
                criar_nova = True
                self.valor_em_aberto = Decimal("0.00")

        with transaction.atomic():
            super().save(*args, **kwargs)

            if criar_nova:
                Receita.objects.create(
                    prefeitura=self.prefeitura,
                    numero_documento=self.numero_documento,
                    descricao=self.descricao,
                    valor_total=valor_restante,
                    valor_pago=Decimal("0.00"),
                    desconto=Decimal("0.00"),
                    data_vencimento=self.data_vencimento,
                    status="aberto",
                    nome=self.nome,
                    cpf=self.cpf,
                    contrato=self.contrato,
                    exumacao=self.exumacao,
                    translado=self.translado,
                )
    @property
    def descricao_segura(self):
        if self.contrato:
            return f"Contrato {self.contrato.numero_contrato}"
        elif self.exumacao:
            return f"Exumação {self.exumacao.sepultado.nome}"
        elif self.translado:
            return f"Translado {self.translado.sepultado.nome}"
        elif self.sepultado:
            return f"Sepultamento {self.sepultado.nome}"
        return self.descricao or "Receita Diversa"
       

    
    def __str__(self):
        return str(self.numero_documento)

    class Meta:
        verbose_name = "Receita"
        verbose_name_plural = "Receitas"


from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

class Anexo(models.Model):
    arquivo = models.FileField(upload_to='anexos/%Y/%m/', verbose_name="Arquivo")
    nome = models.CharField("Descrição ou Nome do Arquivo", max_length=255, blank=True, null=True)
    data_upload = models.DateTimeField(auto_now_add=True, verbose_name="Data do Envio")

    # Relacionamento genérico com qualquer modelo
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")  # ← Corrigido aqui

    def __str__(self):
        return self.nome or self.arquivo.name

    class Meta:
        verbose_name = "Anexo"
        verbose_name_plural = "Anexos"


from django.db import models
from django.conf import settings


class RegistroAuditoria(models.Model):
    ACAO_CHOICES = (
        ('add', 'Adição'),
        ('change', 'Edição'),
        ('delete', 'Exclusão'),
    )

    acao = models.CharField(max_length=10, choices=ACAO_CHOICES)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Usuário responsável"
    )
    modelo = models.CharField(max_length=100)
    objeto_id = models.CharField(max_length=100)
    representacao = models.TextField()
    data_hora = models.DateTimeField(auto_now_add=True)
    prefeitura = models.ForeignKey('Prefeitura', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.get_acao_display()} - {self.modelo} ({self.representacao})"

    class Meta:
        verbose_name = "Registro de Auditoria"
        verbose_name_plural = "Registros de Auditoria"
        ordering = ['-data_hora']

from django.db.models.signals import post_save, post_delete, pre_delete
from django.dispatch import receiver
from crum import get_current_user
from .models import RegistroAuditoria
from django.core.exceptions import ValidationError

@receiver(pre_delete, sender=RegistroAuditoria)
def bloquear_exclusao_auditoria(sender, instance, **kwargs):
    raise ValidationError("Os registros de auditoria não podem ser excluídos.")

from sepultados_gestao.session_context.thread_local import get_prefeitura_ativa

def obter_prefeitura_robusta(instance, usuario):
    # 1. Usa prefeitura ativa do middleware via thread-local
    prefeitura = get_prefeitura_ativa()
    if prefeitura:
        return prefeitura

    # 2. Se não tiver, tenta da instância
    prefeitura = getattr(instance, "prefeitura", None)
    if prefeitura:
        return prefeitura

    # 3. Último recurso: tenta do usuário
    if usuario and hasattr(usuario, "prefeitura"):
        return usuario.prefeitura

    return None






from sepultados_gestao.session_context.thread_local import get_prefeitura_ativa

@receiver(post_save)
def auditar_salvamento(sender, instance, created, **kwargs):
    if sender == RegistroAuditoria:
        return

    usuario = get_current_user()
    if not usuario or not usuario.is_authenticated:
        return

    modelo = getattr(sender, "__name__", sender.__class__.__name__)
    acao = 'add' if created else 'change'

    # ✅ Tenta obter da session thread_local primeiro
    prefeitura = get_prefeitura_ativa()

    # ⛔ Fallbacks caso não venha da session
    if not prefeitura:
        prefeitura = getattr(instance, 'prefeitura', None)
    if not prefeitura and hasattr(usuario, 'prefeitura'):
        prefeitura = usuario.prefeitura

    if not prefeitura:
        return  # Evita salvar auditoria inválida

    RegistroAuditoria.objects.create(
        usuario=usuario,
        acao=acao,
        modelo=modelo,
        objeto_id=str(getattr(instance, "pk", "")),
        representacao=str(instance),
        prefeitura=prefeitura
    )

@receiver(post_delete)
def auditar_exclusao(sender, instance, **kwargs):
    if sender == RegistroAuditoria:
        return

    usuario = get_current_user()
    if not usuario or not usuario.is_authenticated:
        return

    modelo = getattr(sender, "__name__", sender.__class__.__name__)
    acao = 'delete'

    # ✅ Prioriza a session thread_local
    prefeitura = get_prefeitura_ativa()

    # ⛔ Fallbacks
    if not prefeitura:
        prefeitura = getattr(instance, 'prefeitura', None)
    if not prefeitura and hasattr(usuario, 'prefeitura'):
        prefeitura = usuario.prefeitura

    if not prefeitura:
        return

    RegistroAuditoria.objects.create(
        usuario=usuario,
        acao=acao,
        modelo=modelo,
        objeto_id=str(getattr(instance, "pk", "")),
        representacao=str(instance),
        prefeitura=prefeitura
    )


from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid

class EmailConfirmacao(models.Model):
    email = models.EmailField(unique=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    criado_em = models.DateTimeField(default=timezone.now)
    usado = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.email} - {'Usado' if self.usado else 'Pendente'}"

from django.db import models
from django.utils import timezone
import uuid

class CadastroPrefeituraPendente(models.Model):
    email = models.EmailField(unique=True)
    senha = models.CharField(max_length=128)

    nome = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=25)
    responsavel = models.CharField(max_length=255)
    telefone = models.CharField(max_length=30)

    logradouro = models.CharField(max_length=255)
    endereco_numero = models.CharField(max_length=10)
    endereco_bairro = models.CharField(max_length=100)
    endereco_cidade = models.CharField(max_length=100)
    endereco_estado = models.CharField(max_length=2)
    endereco_cep = models.CharField(max_length=15)

    plano_id = models.PositiveIntegerField()
    duracao_anos = models.PositiveIntegerField(default=1)

    logo_base64 = models.TextField(blank=True, null=True)
    brasao_base64 = models.TextField(blank=True, null=True)

    criado_em = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Cadastro pendente: {self.email}"
