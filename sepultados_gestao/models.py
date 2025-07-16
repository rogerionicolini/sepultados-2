from django.db import models
from django.contrib.auth import get_user_model
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
    usuario = models.ForeignKey(get_user_model(), on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Usuário responsável")
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

    logo = models.ImageField(upload_to='logos/', blank=True, null=True, verbose_name="Logotipo da Prefeitura")
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
        validar_prefeitura_obrigatoria(self)

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = "Cemitério"
        verbose_name_plural = "Cemitérios"
        app_label = "sepultados_gestao"



class Quadra(models.Model):
    codigo = models.CharField(max_length=20)
    cemiterio = models.ForeignKey(Cemiterio, on_delete=models.CASCADE)

    @cached_property
    def prefeitura(self):
        return self.cemiterio.prefeitura if self.cemiterio else None

    def clean(self):
        # Não valida mais o campo 'cemiterio' aqui
        validar_prefeitura_obrigatoria(self)

    def __str__(self):
        return f"{self.codigo}"




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
            try:
                if self.quadra.cemiterio_id != self.cemiterio_id:
                    raise ValidationError({'quadra': 'A quadra selecionada não pertence ao cemitério informado.'})
            except:
                raise ValidationError({'quadra': 'A quadra informada não foi encontrada.'})

    def calcular_status_dinamico(self):
        from .models import Sepultado

        if self.reservado:
            return 'reservado'

        sepultados_ativos = Sepultado.objects.filter(
            tumulo=self,
            exumado=False,
            trasladado=False
        ).count()

        return 'ocupado' if sepultados_ativos >= self.capacidade else 'disponivel'

    def save(self, *args, **kwargs):
        self.full_clean()
        self.status = self.calcular_status_dinamico()
        super().save(*args, **kwargs)

    def __str__(self):
        identificador = self.identificador
        if not identificador.upper().startswith("T"):
            identificador = f"T {identificador}"

        quadra_codigo = str(self.quadra)
        if not quadra_codigo.upper().startswith("Q"):
            quadra_codigo = f"Q {quadra_codigo}"

        return f"{identificador} - {quadra_codigo}"

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

    tumulo = models.ForeignKey('Tumulo', on_delete=models.PROTECT)
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

        criando = self.pk is None

        if criando and not self.numero_sepultamento:
            self.numero_sepultamento = gerar_numero_sequencial_global(self.tumulo.quadra.cemiterio.prefeitura)

        self.full_clean()
        self.idade_ao_falecer = self.calcular_idade()
        super().save(*args, **kwargs)

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

        # ✅ Atualiza o status do túmulo de forma correta
        if self.tumulo:
            self.tumulo.status = self.tumulo.calcular_status_dinamico()
            self.tumulo.save(update_fields=["status"])


    def __str__(self):
        return self.nome

    def clean(self):
        super().clean()

        erros = {}

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

        from .models import ConcessaoContrato
        contrato_existente = ConcessaoContrato.objects.filter(tumulo=self.tumulo).exists()
        if not contrato_existente:
            raise ValidationError({
                'tumulo': "Este túmulo não possui contrato de concessão. O sepultamento não é permitido."
            })

        tumulo = self.tumulo
        capacidade = tumulo.capacidade

        sepultados_atuais = Sepultado.objects.filter(
            tumulo=tumulo
        ).exclude(id=self.id).count()

        if sepultados_atuais < capacidade:
            return

        try:
            cemit = tumulo.quadra.cemiterio
        except Exception:
            raise ValidationError('Não foi possível verificar o cemitério do túmulo selecionado.')

        meses_minimos = cemit.tempo_minimo_exumacao or 36
        data_limite = timezone.now().date() - relativedelta(months=meses_minimos)

        from .models import MovimentacaoSepultado

        exumacoes_validas = MovimentacaoSepultado.objects.filter(
            sepultado__tumulo=tumulo,
            tipo='EXUMACAO',
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

    class Meta:
        verbose_name = "Sepultado"
        verbose_name_plural = "Sepultados"


from .utils import gerar_receitas_para_servico  # se você colocou essa função em um util separado
from dateutil.relativedelta import relativedelta
from datetime import datetime, date

from .models import NumeroSequencialGlobal

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
    usuario_registro = models.ForeignKey(get_user_model(), on_delete=models.SET_NULL, null=True, verbose_name="Usuário responsável")

    def clean(self):
        if not self.tumulo_id:
            raise ValidationError({"tumulo": "Selecione um túmulo para o contrato."})

        if self.pk is None and ConcessaoContrato.objects.filter(tumulo_id=self.tumulo_id).exists():
            raise ValidationError({"tumulo": "Este túmulo já está vinculado a outro contrato."})

        if self.tumulo and self.tumulo.status in ['reservado', 'ocupado']:
            raise ValidationError({"tumulo": f"Túmulo {self.tumulo} está marcado como '{self.tumulo.get_status_display()}'. Só é possível gerar contrato para túmulo disponível."})

        if self.forma_pagamento == 'gratuito' and self.valor_total != Decimal("0.00"):
            raise ValidationError({'valor_total': "Contratos gratuitos devem ter valor R$ 0,00."})

    def save(self, *args, **kwargs):
        from django.utils import timezone
        from .models import NumeroSequencialGlobal, Receita
        from decimal import Decimal
        from datetime import date
        from .utils import gerar_numero_sequencial_global

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
        from .models import Receita, Sepultado

        if Receita.objects.filter(contrato=self).exists():
            raise Exception("Não é possível excluir este contrato. Existem receitas vinculadas.")

        sepultados_ativos = Sepultado.objects.filter(tumulo=self.tumulo, exumado=False, trasladado=False)
        if sepultados_ativos.exists():
            raise Exception("Não é possível excluir este contrato. Há sepultados no túmulo que ainda não foram trasladados.")

        super().delete(*args, **kwargs)

        # ✅ Atualiza o status do túmulo após exclusão do contrato
        self.tumulo.status = self.tumulo.calcular_status_dinamico()
        self.tumulo.save(update_fields=["status"])

        



    def __str__(self):
        return f"{self.numero_contrato or 'Contrato'} - {self.nome} - {self.tumulo.identificador}"

    class Meta:
        verbose_name = "Contrato de Concessão"
        verbose_name_plural = "Contratos de Concessão"
        app_label = "sepultados_gestao"
    
              

# models.py (trecho relevante para MovimentacaoSepultado)

class MovimentacaoSepultado(models.Model):
    TIPO_CHOICES = [('EXUMACAO', 'Exumação'), ('TRANSLADO', 'Translado')]
    DESTINO_TIPO_CHOICES = [
        ('INTERNO', 'Outro túmulo no mesmo cemitério'),
        ('EXTERNO', 'Outro cemitério'),
        ('OSSARIO', 'Ossário'),
        ('NAO_INFORMADO', 'Não informado'),
    ]

    numero_movimentacao = models.CharField(
        max_length=20,
        verbose_name="Número da movimentação",
        editable=False,
        null=True,
        blank=True
    )

    sepultado = models.ForeignKey('Sepultado', on_delete=models.CASCADE)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, verbose_name="Tipo da movimentação")
    data = models.DateField(verbose_name="Data da movimentação")
    motivo = models.CharField(
        max_length=255,
        help_text="Ex: Liberação do túmulo, Compartilhamento, Transferência etc."
    )
    tumulo_origem = models.ForeignKey(
        'Tumulo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimentacoes_origem',
        verbose_name="Túmulo de origem"
    )
    tumulo_destino = models.ForeignKey(
        'Tumulo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimentacoes_destino',
        verbose_name="Túmulo de destino"
    )
    destino_tipo = models.CharField(
        max_length=20,
        choices=DESTINO_TIPO_CHOICES,
        default='NAO_INFORMADO',
        verbose_name="Tipo de destino"
    )
    cemiterio_destino_nome = models.CharField(max_length=100, blank=True, verbose_name="Nome do cemitério de destino")
    cidade_destino = models.CharField(max_length=100, blank=True, verbose_name="Cidade de destino")
    estado_destino = models.CharField(
        max_length=2,
        choices=Prefeitura._meta.get_field('endereco_estado').choices,
        blank=True,
        verbose_name="Estado de destino"
    )
    observacoes = models.TextField(blank=True, verbose_name="Observações")

    nome = models.CharField("Nome", max_length=255, blank=True, null=True)
    cpf = models.CharField("CPF", max_length=18, blank=True, null=True)
    endereco = models.CharField("Endereço", max_length=255, blank=True, null=True)
    telefone = models.CharField("Telefone", max_length=20, blank=True, null=True)

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

    from functools import cached_property

    @cached_property
    def prefeitura(self):
        try:
            return self.sepultado.tumulo.quadra.cemiterio.prefeitura
        except AttributeError:
            return None

    def clean(self):
        from datetime import timedelta
        from django.utils import timezone
        from django.core.exceptions import ValidationError

        validar_prefeitura_obrigatoria(self)

        sepultado = self.sepultado

        if not sepultado:
            raise ValidationError("Sepultado não informado.")

        # ✅ Regra de exumação: só uma permitida
        if self.tipo == 'EXUMACAO':
            sepultado_fresh = type(sepultado).objects.get(pk=sepultado.pk)

            existe_exumacao = MovimentacaoSepultado.objects.filter(
                sepultado=sepultado_fresh,
                tipo='EXUMACAO'
            ).exclude(pk=self.pk).exists()

            if existe_exumacao:
                raise ValidationError("Este sepultado já foi exumado anteriormente.")

            if not sepultado_fresh.data_falecimento:
                raise ValidationError("Data de falecimento do sepultado não está informada.")

            if not sepultado_fresh.tumulo or not sepultado_fresh.tumulo.quadra or not sepultado_fresh.tumulo.quadra.cemiterio:
                raise ValidationError("Não foi possível identificar o cemitério do sepultado.")

            cemit = sepultado_fresh.tumulo.quadra.cemiterio
            meses_minimos = cemit.tempo_minimo_exumacao or 36
            dias_minimos = meses_minimos * 30
            limite_data = sepultado_fresh.data_falecimento + timedelta(days=dias_minimos)

            if timezone.now().date() < limite_data:
                raise ValidationError(f"A exumação só será permitida após {meses_minimos} meses do falecimento.")

        # ✅ Regra de translado: só se já estiver exumado
        elif self.tipo == 'TRANSLADO':
            if not sepultado.exumado:
                raise ValidationError("Só é possível realizar translado de um sepultado que já foi exumado.")

    def save(self, *args, **kwargs):
        from django.utils import timezone
        from .models import Sepultado
        from .utils import gerar_receitas_para_servico, gerar_numero_sequencial_global
        from decimal import Decimal

        criando = self.pk is None

        # Define tumulo de origem automaticamente a partir do sepultado
        if self.sepultado and hasattr(self.sepultado, 'tumulo'):
            self.tumulo_origem = self.sepultado.tumulo

        # Gera número de movimentação se estiver criando
        if criando and not self.numero_movimentacao:
            self.numero_movimentacao = gerar_numero_sequencial_global(self.prefeitura)

        self.full_clean()
        super().save(*args, **kwargs)

        # Atualiza status do sepultado
        if self.tipo == 'EXUMACAO':
            self.sepultado.exumado = True
            self.sepultado.save()

            # Verifica se todos os sepultados foram exumados
            tumulo = self.sepultado.tumulo
            if tumulo and not Sepultado.objects.filter(tumulo=tumulo, exumado=False, trasladado=False).exists():
                tumulo.status = 'disponivel'
                tumulo.save()

        elif self.tipo == 'TRANSLADO':
            self.sepultado.trasladado = True
            self.sepultado.save()

            # Verifica se todos os sepultados já foram trasladados
            tumulo = self.sepultado.tumulo
            if tumulo and not Sepultado.objects.filter(tumulo=tumulo, trasladado=False).exists():
                tumulo.status = 'disponivel'
                tumulo.save()

        # Gera receita apenas ao criar
        if criando:
            gerar_receitas_para_servico(
                servico=self,
                descricao=self.get_tipo_display(),
                forma_pagamento=self.forma_pagamento,
                valor_total=self.valor,
                parcelas=self.quantidade_parcelas or 1,
                nome=self.nome,
                cpf=self.cpf,
                numero_documento=self.numero_movimentacao
            )

    def delete(self, *args, **kwargs):
        sepultado_id = self.sepultado_id
        tipo_original = self.tipo
        super().delete(*args, **kwargs)

        if tipo_original == 'EXUMACAO' and sepultado_id:
            ainda_tem_exumacao = MovimentacaoSepultado.objects.filter(
                sepultado_id=sepultado_id,
                tipo='EXUMACAO'
            ).exists()

            if not ainda_tem_exumacao:
                from sepultados_gestao.models import Sepultado
                sepultado = Sepultado.objects.get(id=sepultado_id)
                sepultado.exumado = False
                sepultado.save()

    def __str__(self):
        return f"{self.get_tipo_display()} de {self.sepultado.nome} em {self.data}"

    class Meta:
        verbose_name = "Exumação/Translado"
        verbose_name_plural = "Exumações/Translados"
        app_label = "sepultados_gestao"

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
    contrato = models.ForeignKey(
        'ConcessaoContrato',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        editable=False
    )
    movimentacao = models.ForeignKey(
        'MovimentacaoSepultado',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Movimentação",
        related_name='receitas'
    )
    prefeitura = models.ForeignKey(
        'Prefeitura',
        on_delete=models.CASCADE,
        editable=False
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
            if self.movimentacao:
                self.numero_documento = self.movimentacao.numero_movimentacao
                tipo = self.movimentacao.get_tipo_display()
                self.descricao = tipo
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
                self.valor_em_aberto = Decimal("0.00")  # ← zera aqui

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
                    movimentacao=self.movimentacao,
                )
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
