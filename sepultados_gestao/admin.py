from django.contrib import admin, messages
from django.utils.html import format_html
from django.urls import reverse
from django.shortcuts import redirect
from dateutil.relativedelta import relativedelta
from datetime import date

from .models import (
    Prefeitura, Cemiterio, Quadra, Tumulo,
    Sepultado, ConcessaoContrato, 
    Plano, Licenca, Receita
)
from .forms import LicencaForm
from .forms import ConcessaoContratoForm, QuadraForm
from .mixins import PrefeituraObrigatoriaAdminMixin
from django.urls import path
from django.http import JsonResponse
from django import forms
from .forms import TumuloForm



from django import forms
from django.db import models

from django.contrib.contenttypes.admin import GenericTabularInline
from .models import Anexo
from .views import gerar_recibo_pdf
from .forms import PlanoForm
from .models import RegistroAuditoria
from .utils import registrar_auditoria
from sepultados_gestao.session_context.thread_local import get_prefeitura_ativa
from django.contrib.auth import get_user_model
User = get_user_model()






class AnexoInline(GenericTabularInline):
    model = Anexo
    extra = 1
    verbose_name = "Anexo"
    verbose_name_plural = "Arquivos Anexados"



from django.db import transaction
from django.contrib import messages
from .models import Prefeitura
from sepultados_gestao.services.arquivamento import (
    arquivar_prefeitura, restaurar_prefeitura
)


@admin.register(Prefeitura)
class PrefeituraAdmin(admin.ModelAdmin):
    list_display = ("nome", "endereco_cidade", "cnpj", "usuario", "situacao_badge")
    list_filter = ("situacao", "endereco_estado")
    search_fields = ('nome', 'responsavel', 'cnpj', 'endereco_cidade')

    formfield_overrides = {
        models.TextField: {'widget': forms.Textarea(attrs={
            'rows': 6,
            'style': 'width: 100%; font-family: Arial; font-size: 13px;',
        })}
    }

    fieldsets = (
        ('Informações principais', {
            'fields': ('usuario', 'nome', 'cnpj', 'responsavel', 'telefone', 'email', 'site')
        }),
        ('Endereço', {
            'fields': (
                'logradouro', 'endereco_numero', 'endereco_bairro',
                'endereco_cidade', 'endereco_estado', 'endereco_cep'
            )
        }),
        ('Imagens', {
            'fields': ('brasao',)
        }),
        ('Configurações financeiras', {
            'fields': ('multa_percentual', 'juros_mensal_percentual'),
            'description': 'Parâmetros de multa e juros para cobrança de serviços.'
        }),
        ('Contrato - Cláusulas Padrão', {
            'fields': ('clausulas_contrato',),
            'description': 'Esse texto será inserido automaticamente no meio dos contratos PDF.'
        }),
        ('Licença / Situação', {'fields': ('situacao', 'arquivada_em', 'motivo_arquivamento')}),
    )

    actions = ['acao_arquivar', 'acao_restaurar']

    def get_actions(self, request):
        actions = super().get_actions(request)
        if not request.user.is_superuser:
            actions.pop('acao_arquivar', None)
            actions.pop('acao_restaurar', None)
            actions.pop('delete_selected', None)  # opcional: esconde excluir em massa
        return actions

    @admin.action(description="Arquivar prefeitura (desativa usuários e cemitérios)")
    def acao_arquivar(self, request, queryset):
        if not request.user.is_superuser:
            self.message_user(request, "Ação restrita a superusuários.", level=messages.ERROR)
            return
        with transaction.atomic():
            for pref in queryset:
                arquivar_prefeitura(pref, responsavel=request.user, motivo="Arquivada via admin")
        self.message_user(request, "Prefeitura(s) arquivada(s) com sucesso.", level=messages.SUCCESS)

    @admin.action(description="Restaurar prefeitura (reativa usuários e cemitérios)")
    def acao_restaurar(self, request, queryset):
        if not request.user.is_superuser:
            self.message_user(request, "Ação restrita a superusuários.", level=messages.ERROR)
            return
        with transaction.atomic():
            for pref in queryset:
                restaurar_prefeitura(pref, responsavel=request.user, motivo="Restaurada via admin")
        self.message_user(request, "Prefeitura(s) restaurada(s) com sucesso.", level=messages.SUCCESS)

    @admin.display(description="Situação", ordering="situacao")
    def situacao_badge(self, obj):
        rotulos = dict(Prefeitura.SITUACAO_CHOICES) if hasattr(Prefeitura, "SITUACAO_CHOICES") else {
            "ativo": "Ativa", "arquivado": "Arquivada", "suspenso": "Suspensa",
        }
        label = rotulos.get(obj.situacao, obj.situacao or "-")
        cores = {"ativo": "#2e7d32", "arquivado": "#8d6e63", "suspenso": "#f57c00"}
        cor = cores.get(obj.situacao, "#444")
        # badge simples
        return format_html(
            '<span style="padding:2px 8px;border-radius:999px;background:{}20;color:{};font-weight:600;">{}</span>',
            cor, cor, label,
        )

    class Media:
        css = {
            "all": ("custom_admin/css/inputs.css",)  # caminho dentro de STATICFILES
        }

from django.contrib import admin, messages
from .models import Cemiterio, Quadra
from .forms import QuadraForm
from .mixins import PrefeituraObrigatoriaAdminMixin
from django.db import models
from django.contrib.admin.widgets import AdminTextareaWidget



@admin.register(Cemiterio)
class CemiterioAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    list_display = ("nome", "cidade", "estado", "telefone", "tempo_minimo_exumacao")
    search_fields = ("nome", "cidade")
    list_filter = ("estado",)
    formfield_overrides = {
        models.JSONField: {"widget": AdminTextareaWidget(attrs={"rows": 10, "cols": 120})}
    }
    def get_fields(self, request, obj=None):
        return [
            "nome",
            "endereco",
            "telefone",
            "cidade",
            "estado",
            "tempo_minimo_exumacao",
            "limites_mapa"
        ]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        return qs.filter(prefeitura_id=prefeitura_id)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)

        class CustomForm(form):
            def __init__(self_inner, *args, **kwargs_inner):
                super().__init__(*args, **kwargs_inner)
                self_inner.instance.prefeitura = request.prefeitura_ativa  # força atribuição no form

        return CustomForm

    def save_model(self, request, obj, form, change):
        obj.prefeitura = request.prefeitura_ativa  # garante que sempre vai ter prefeitura
        super().save_model(request, obj, form, change)

    def delete_model(self, request, obj):
        if obj.quadra_set.exists():
            self.message_user(request, "Não é possível excluir este cemitério. Existem quadras vinculadas.", level=messages.ERROR)
            return
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            if obj.quadra_set.exists():
                self.message_user(request, f"Cemitério {obj} não pôde ser excluído: há quadras vinculadas.", level=messages.ERROR)
            else:
                obj.delete()


# sepultados_gestao/admin.py  (trecho referente a QUADRA)

from django.contrib import admin, messages
from django.utils.html import format_html
from .models import Quadra
from .forms import QuadraForm
from .mixins import PrefeituraObrigatoriaAdminMixin
from sepultados_gestao.models import RegistroAuditoria  # sua auditoria

# --- Filtro "Tem polígono?" na lista ---
class TemPoligonoFilter(admin.SimpleListFilter):
    title = "Tem polígono"
    parameter_name = "tem_poligono"

    def lookups(self, request, model_admin):
        return (("sim", "Sim"), ("nao", "Não"))

    def queryset(self, request, queryset):
        val = self.value()
        if val == "sim":
            return queryset.exclude(poligono_mapa=[])
        if val == "nao":
            return queryset.filter(poligono_mapa=[])
        return queryset


class QuadraAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    form = QuadraForm

    # Lista (pode manter o "cemiterio" visível apenas aqui)
    list_display = ("codigo", "cemiterio", "poligono_ok", "pontos", "grid_info")
    list_filter = ("cemiterio", TemPoligonoFilter)
    search_fields = ("codigo", "cemiterio__nome")

    # Campos exibidos NO FORM (cemitério propositalmente fora)
    fieldsets = (
        (None, {"fields": ("codigo", "poligono_mapa", "grid_params")}),
    )

    # ========== Colunas auxiliares ==========
    def poligono_ok(self, obj):
        tem = bool(obj.poligono_mapa)
        return format_html(
            '<span style="font-weight:600; color:{}">{}</span>',
            '#1f9d55' if tem else '#cc1f1a',
            '✅' if tem else '❌'
        )
    poligono_ok.short_description = "Polígono?"

    def pontos(self, obj):
        return len(obj.poligono_mapa or [])
    pontos.short_description = "Pontos"

    def grid_info(self, obj):
        g = obj.grid_params or {}
        if not g:
            return "—"
        cols = g.get("cols", "–")
        rows = g.get("rows", "–")
        ang  = g.get("angulo", 0)
        return f"{cols}×{rows} @ {ang}°"
    grid_info.short_description = "Grid"

    # ========== Form sem o campo "cemiterio" ==========
    def get_form(self, request, obj=None, **kwargs):
        base_form = super().get_form(request, obj, **kwargs)

        class CustomForm(base_form):
            def __init__(self_inner, *args, **kwargs_inner):
                kwargs_inner["request"] = request
                super().__init__(*args, **kwargs_inner)

                # garante que o campo NÃO apareça no form
                self_inner.fields.pop("cemiterio", None)

                # dica no campo polígono
                if "poligono_mapa" in self_inner.fields:
                    self_inner.fields["poligono_mapa"].help_text = (
                        "No import use apenas UMA coluna de polígono "
                        "(poligono_mapa/limites/polygon/wkt). "
                        "No admin, edite como JSON: "
                        '[{\"lat\": -23.48, \"lng\": -51.78}, …]'
                    )
        return CustomForm

    # ========== Regras por cemitério ativo ==========
    def save_model(self, request, obj, form, change):
        # força o cemitério pelo contexto da sessão
        cemiterio_id = request.session.get("cemiterio_ativo_id")
        if not cemiterio_id:
            messages.error(request, "Selecione um cemitério antes de salvar a quadra.")
            return
        obj.cemiterio_id = cemiterio_id

        # opcional: associar prefeitura para auditoria/consistência
        obj.prefeitura = getattr(request, "prefeitura_ativa", None)

        super().save_model(request, obj, form, change)

        # Auditoria
        RegistroAuditoria.objects.create(
            usuario=request.user,
            acao=("change" if change else "add"),
            modelo=obj.__class__.__name__,
            objeto_id=str(obj.pk),
            representacao=str(obj),
            prefeitura=getattr(request, "prefeitura_ativa", None),
        )

    def delete_model(self, request, obj):
        if obj.tumulo_set.exists():
            self.message_user(
                request,
                "Não é possível excluir esta quadra. Existem túmulos vinculados.",
                level=messages.ERROR
            )
            return

        RegistroAuditoria.objects.create(
            usuario=request.user,
            acao="delete",
            modelo=self.model.__name__,
            objeto_id=str(obj.pk),
            representacao=str(obj),
            prefeitura=getattr(request, "prefeitura_ativa", None),
        )
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            if obj.tumulo_set.exists():
                self.message_user(
                    request,
                    f"Quadra {obj} não pôde ser excluída: há túmulos vinculados.",
                    level=messages.ERROR
                )
            else:
                obj.delete()

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        cemiterio_id = request.session.get("cemiterio_ativo_id")
        if cemiterio_id:
            return qs.filter(cemiterio_id=cemiterio_id)
        return qs.none()

    def get_model_perms(self, request):
        # se não tiver cemitério ativo, esconde o menu Quadras
        if not request.session.get("cemiterio_ativo_id"):
            return {}
        return super().get_model_perms(request)


from django.contrib import admin
from django.utils.safestring import mark_safe
from django.utils.html import format_html
from datetime import date
from dateutil.relativedelta import relativedelta
from django.urls import reverse

from .models import Tumulo, ConcessaoContrato, Translado
from .forms import TumuloForm
from .mixins import PrefeituraObrigatoriaAdminMixin

@admin.register(Tumulo)
class TumuloAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    form = TumuloForm
    autocomplete_fields = ['quadra']
    search_fields = ['identificador', 'linha', 'quadra__codigo']
    list_display = (
        "tipo_estrutura", "identificador", "quadra",
        "status_com_cor", "usar_linha", "linha", "reservado", "link_pdf"
    )
    list_filter = ("status", "quadra", "usar_linha", "reservado")
    readonly_fields = ("status", "painel_sepultados")
    fields = (
        "tipo_estrutura", "identificador", "capacidade", "quadra",
        "usar_linha", "linha", "reservado", "motivo_reserva", "status", "painel_sepultados"
    )

    def link_pdf(self, obj):
        url = reverse('sepultados_gestao:gerar_pdf_sepultados_tumulo', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)
    link_pdf.short_description = "Lista de Sepultados (PDF)"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.cemiterio_ativo:
            return qs.none()
        return qs.filter(cemiterio=request.cemiterio_ativo)

    def get_model_perms(self, request):
        if not request.session.get("prefeitura_ativa_id"):
            return {}
        return super().get_model_perms(request)

    def status_com_cor(self, obj):
        cores = {
            "disponivel": "blue",
            "reservado": "red",
            "ocupado": "green",
        }
        cor = cores.get(obj.status, "black")
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            cor, obj.get_status_display()
        )
    status_com_cor.short_description = "Status"

    def get_form(self, request, obj=None, **kwargs):
        form_class = super().get_form(request, obj, **kwargs)
        class FormComRequest(form_class):
            def __init__(self2, *args, **kwargs2):
                kwargs2['request'] = request
                super().__init__(*args, **kwargs2)
        return FormComRequest

    def painel_sepultados(self, obj):
        if not obj:
            return ""

        contrato = ConcessaoContrato.objects.filter(tumulo=obj).first()
        if contrato:
            contrato_html = f"""
            <div style='margin-bottom: 15px; background: #e6f5e2; padding: 20px 25px;
                        border-radius: 12px; border: 2px solid #4CAF50;
                        box-shadow: 1px 1px 5px rgba(0,0,0,0.05);'>
                <strong style='color: #003300;'>Contrato de Concessão:</strong> Nº {contrato.numero_contrato}
            </div>
            """
        else:
            contrato_html = """
            <div style='margin-bottom: 15px; background: #fff8e1; padding: 20px 25px;
                        border-radius: 12px; border: 2px solid #ffa500;
                        box-shadow: 1px 1px 5px rgba(0,0,0,0.05);'>
                <strong style='color: #996600;'>Atenção:</strong> Este túmulo não possui contrato de concessão registrado.
            </div>
            """

        sepultados = obj.sepultado_set.all().order_by('-data_sepultamento')
        translados = Translado.objects.filter(tumulo_destino=obj).select_related('sepultado').order_by('-data')

        if not sepultados.exists() and not translados.exists():
            return mark_safe(f"""
                {contrato_html}
                <div style='margin-top: 20px; background: #eafbe4; padding: 20px 25px; border-radius: 12px;
                            border: 2px solid #339933; box-shadow: 1px 1px 5px rgba(0,0,0,0.05);'>
                    <h3 style='color: #006600; margin-top: 0; font-size: 16px;'>✅ Este túmulo está livre, sem sepultados.</h3>
                    <p style='color: #004400;'>Nenhum sepultamento registrado até o momento.</p>
                </div>
            """)

        tempo_minimo_meses = obj.quadra.cemiterio.tempo_minimo_exumacao or 0
        linhas = ""

        # Sepultados diretamente ligados ao túmulo
        for s in sepultados:
            status = s.status_display


            if s.data_sepultamento:
                data_permitida = s.data_sepultamento + relativedelta(months=tempo_minimo_meses)
                if date.today() >= data_permitida:
                    exumacao_info = "<span style='color: #006600; font-weight: bold;'>Exumação liberada</span>"
                else:
                    faltam = (data_permitida - date.today()).days
                    exumacao_info = f"<span style='color: #cc6600;'>Exumação permitida em {faltam} dia(s)</span>"
            else:
                exumacao_info = "<span style='color: #999;'>Sem data</span>"

            linhas += f"""
            <tr>
                <td style='padding: 6px 10px; border-bottom: 1px solid #c3d9af;'>{s.nome}</td>
                <td style='padding: 6px 10px; border-bottom: 1px solid #c3d9af;'>{s.data_sepultamento.strftime('%d/%m/%Y') if s.data_sepultamento else '-'}</td>
                <td style='padding: 6px 10px; border-bottom: 1px solid #c3d9af;'>{status}</td>
                <td style='padding: 6px 10px; border-bottom: 1px solid #c3d9af;'>{exumacao_info}</td>
            </tr>
            """

        # Sepultados trasladados para este túmulo
        for t in translados:
            s = t.sepultado
            status = "Exumado (Traslado)"
            data_sep = t.data.strftime('%d/%m/%Y')
            exumacao_info = f"<span style='color: #003366;'>Transferido em {data_sep}</span>"

            linhas += f"""
            <tr>
                <td style='padding: 6px 10px; border-bottom: 1px solid #c3d9af;'>{s.nome}</td>
                <td style='padding: 6px 10px; border-bottom: 1px solid #c3d9af;'>{data_sep}</td>
                <td style='padding: 6px 10px; border-bottom: 1px solid #c3d9af;'>{status}</td>
                <td style='padding: 6px 10px; border-bottom: 1px solid #c3d9af;'>{exumacao_info}</td>
            </tr>
            """

        return mark_safe(f"""
            {contrato_html}
            <div style='margin-top: 20px; background: #f5fbe9; padding: 20px 25px; border-radius: 12px;
                        border: 2px solid #006600; box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.1);'>
                <h3 style='color: #003300; margin-top: 0; font-size: 18px;'>Sepultados neste Túmulo</h3>
                <table style='width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px;'>
                    <thead>
                        <tr style='background-color: #dceacb;'>
                            <th style='text-align: left; padding: 8px 10px; border-bottom: 2px solid #006600;'>Nome</th>
                            <th style='text-align: left; padding: 8px 10px; border-bottom: 2px solid #006600;'>Data do Sepultamento</th>
                            <th style='text-align: left; padding: 8px 10px; border-bottom: 2px solid #006600;'>Status</th>
                            <th style='text-align: left; padding: 8px 10px; border-bottom: 2px solid #006600;'>Exumação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {linhas}
                    </tbody>
                </table>
            </div>
        """)

    painel_sepultados.short_description = "Sepultados neste Túmulo"

    


from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Q

from .models import Sepultado, Tumulo, Cemiterio
from .mixins import PrefeituraObrigatoriaAdminMixin
from .forms import SepultadoForm
from sepultados_gestao.models import Exumacao, Translado
from .models import Sepultado, Tumulo, Cemiterio


class SepultadoAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    form = SepultadoForm
    inlines = [AnexoInline]  # mantém seu inline existente
    autocomplete_fields = ['tumulo']

    list_display = (
        'nome', 'data_nascimento', 'data_falecimento',
        'idade_ao_falecer', 'tumulo', 'status_display', 'link_pdf'
    )
    list_filter = ('estado_civil',)
    search_fields = (
        'nome', 'cartorio_nome', 'cartorio_numero_registro',
        'profissao', 'cidade'
    )
    readonly_fields = ('idade_ao_falecer', 'numero_sepultamento', 'informacoes_movimentacoes')

    fieldsets = (
        ('Identificação do Sepultamento', {
            'fields': ('numero_sepultamento',)
        }),
        ('Dados do Sepultado', {
            'fields': (
                'nome', 'cpf_sepultado', 'sexo', 'sexo_outro_descricao', 'data_nascimento', 'local_nascimento',
                'nacionalidade', 'cor_pele', 'estado_civil', 'nome_conjuge', "nome_pai", "nome_mae",
                'profissao', 'grau_instrucao', 'informacoes_movimentacoes'
            )
        }),
        ('Endereço Residencial', {
            'fields': (
                'logradouro', 'numero', 'bairro',
                'cidade', 'estado',
            )
        }),
        ('Falecimento', {
            'fields': (
                'data_falecimento', 'hora_falecimento', 'local_falecimento',
                'causa_morte', 'medico_responsavel', 'crm_medico',
                'idade_ao_falecer'
            )
        }),
        ('Registro em Cartório', {
            'fields': (
                'cartorio_nome', 'cartorio_numero_registro',
                'cartorio_livro', 'cartorio_folha', 'cartorio_data_registro',
            )
        }),
        ('Local de Sepultamento', {
            'fields': (
                'tumulo', 'data_sepultamento',
                'observacoes',
            )
        }),
        ('Pagamento', {
            'fields': (
                'forma_pagamento', 'quantidade_parcelas', 'valor',
            )
        }),
        ('Responsável pelo Sepultamento', {
            'fields': (
                'nome_responsavel', 'cpf', 'endereco', 'telefone',
            )
        }),
    )

    def get_queryset(self, request):
        """
        Lista apenas sepultados do CEMITÉRIO ativo.
        OBS: Sepultado não tem campo 'prefeitura'; filtramos pelo caminho via Túmulo→Cemitério (que tem prefeitura).
        Cobre os dois jeitos de modelar Túmulo: com FK direta para Cemiterio OU via Quadra→Cemiterio.
        """
        qs = super().get_queryset(request).select_related(
            "tumulo", "tumulo__cemiterio", "tumulo__quadra", "tumulo__quadra__cemiterio"
        )

        # Prefeitura ativa (opcional, via caminho do cemitério)
        prefeitura_ativa = getattr(request, "prefeitura_ativa", None)

        # Cemitério ativo (middleware)…
        cemiterio_ativo = getattr(request, "cemiterio_ativo", None)
        # …ou via sessão
        if cemiterio_ativo is None:
            cem_id = request.session.get("cemiterio_ativo_id")
            if cem_id:
                try:
                    cemiterio_ativo = Cemiterio.objects.get(pk=cem_id)
                except Cemiterio.DoesNotExist:
                    cemiterio_ativo = None

        # Sem cemitério ativo: não mostra nada
        if cemiterio_ativo is None:
            return qs.none()

        # Filtra por cemitério ativo (cobre as duas formas)
        qs = qs.filter(
            Q(tumulo__cemiterio=cemiterio_ativo) |
            Q(tumulo__quadra__cemiterio=cemiterio_ativo)
        )

        # Se quiser garantir também a prefeitura (sem quebrar):
        if prefeitura_ativa:
            qs = qs.filter(
                Q(tumulo__cemiterio__prefeitura=prefeitura_ativa) |
                Q(tumulo__quadra__cemiterio__prefeitura=prefeitura_ativa)
            )

        return qs


    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """
        Restringe o campo Túmulo ao CEMITÉRIO ativo.
        Cobre túmulos com FK direta para Cemiterio ou via Quadra→Cemiterio.
        """
        if db_field.name == 'tumulo':
            # Do middleware…
            cemiterio_ativo = getattr(request, "cemiterio_ativo", None)
            # …ou da sessão
            if cemiterio_ativo is None:
                cem_id = request.session.get("cemiterio_ativo_id")
                if cem_id:
                    try:
                        cemiterio_ativo = Cemiterio.objects.get(pk=cem_id)
                    except Cemiterio.DoesNotExist:
                        cemiterio_ativo = None

            if cemiterio_ativo:
                kwargs["queryset"] = Tumulo.objects.filter(
                    Q(cemiterio=cemiterio_ativo) |            # FK direta
                    Q(quadra__cemiterio=cemiterio_ativo)      # via quadra
                ).select_related("quadra", "cemiterio")
            else:
                kwargs["queryset"] = Tumulo.objects.none()

        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def informacoes_movimentacoes(self, obj):
        if not obj:
            return format_html(
                "<div class='caixa-movimentacoes'>Informações disponíveis após salvar o sepultado.</div>"
            )

        exumacoes = Exumacao.objects.filter(sepultado=obj).order_by('-data')
        translados = Translado.objects.filter(sepultado=obj).order_by('-data')

        html = "<div class='caixa-movimentacoes'>"

        if exumacoes.exists():
            html += f"<strong>Exumado em:</strong> {exumacoes.first().data.strftime('%d/%m/%Y')}<br>"
        else:
            html += "<strong>Exumado:</strong> Não<br>"

        if translados.exists():
            html += f"<strong>Trasladado em:</strong> {translados.first().data.strftime('%d/%m/%Y')}<br>"
        else:
            html += "<strong>Trasladado:</strong> Não<br>"

        html += "</div>"
        return format_html(html)

    informacoes_movimentacoes.short_description = "Informações de movimentações"

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)

        if 'sexo' in form.base_fields:
            form.base_fields['sexo'].widget.attrs.update({
                'onchange': 'mostrarCampoOutroSexo(this);'
            })
        if 'estado_civil' in form.base_fields:
            form.base_fields['estado_civil'].widget.attrs.update({
                'onchange': 'mostrarCampoConjuge(this);'
            })

        form.base_fields['data_falecimento'].required = True
        form.base_fields['data_sepultamento'].required = True
        return form

    def link_pdf(self, obj):
        url = reverse('sepultados_gestao:gerar_guia_sepultamento_pdf', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)

    link_pdf.short_description = "Guia PDF"

    class Media:
        js = (
            'custom_admin/js/sexo_outro.js',
            'custom_admin/js/sepultado_pagamento.js',
        )





from django.contrib import admin
from django.contrib import messages
from django.urls import reverse
from django.utils.html import format_html
from .models import ConcessaoContrato
from .forms import ConcessaoContratoForm
from .mixins import PrefeituraObrigatoriaAdminMixin

@admin.register(ConcessaoContrato)
class ConcessaoContratoAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    form = ConcessaoContratoForm
    inlines = [AnexoInline]
    autocomplete_fields = ['tumulo']
    list_display = (
        'numero_contrato', 'nome', 'cpf',
        'tumulo_exibicao', 'prefeitura', 'valor_total',
        'data_contrato', 'link_pdf'
    )
    search_fields = ('nome', 'cpf', 'tumulo__identificador')
    list_filter = ('prefeitura', 'data_contrato')
    readonly_fields = ('numero_contrato',)

    fieldsets = (
        (None, {
            'fields': (
                'numero_contrato',
                'nome',
                'cpf',
                'telefone',
                'logradouro',
                'endereco_numero',
                'endereco_bairro',
                'endereco_cidade',
                'endereco_estado',
                'endereco_cep',
                'tumulo',
                'forma_pagamento',
                'quantidade_parcelas',
                'valor_total',
                'observacoes',
            )
        }),
    )

    def tumulo_exibicao(self, obj):
        return obj.tumulo.identificador if obj.tumulo else "-"
    tumulo_exibicao.short_description = "Túmulo"

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related(
            "tumulo", "tumulo__cemiterio", "tumulo__quadra", "tumulo__quadra__cemiterio"
        )

               # prefeitura ativa (igual ao que você já fazia)
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        if prefeitura_id:
            qs = qs.filter(prefeitura_id=prefeitura_id)

        # NOVO: filtrar também pelo cemitério ativo (middleware ou sessão)
        cem = getattr(request, "cemiterio_ativo", None)
        cem_id = getattr(cem, "id", None) or request.session.get("cemiterio_ativo_id")

        if cem_id:
            qs = qs.filter(
                Q(tumulo__cemiterio_id=cem_id) |          # FK direta
                Q(tumulo__quadra__cemiterio_id=cem_id)    # via quadra -> cemitério
            )
        # se não houver cemitério selecionado, mantém o que já filtrou por prefeitura

        return qs

    def get_form(self, request, obj=None, **kwargs):
        form_class = super().get_form(request, obj, **kwargs)

        class FormComRequest(form_class):
            def __init__(self, *args, **inner_kwargs):
                inner_kwargs['request'] = request
                super().__init__(*args, **inner_kwargs)

            def is_valid(self):
                valid = super().is_valid()
                if not valid:
                    print(">>> FORM INVÁLIDO <<<")
                    print(self.errors.as_json())
                return valid

        return FormComRequest

    def save_model(self, request, obj, form, change):
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        if not prefeitura_id:
            raise ValidationError("Nenhuma prefeitura ativa selecionada.")

        obj.prefeitura_id = prefeitura_id
        obj.usuario_registro = request.user
        super().save_model(request, obj, form, change)

    def delete_model(self, request, obj):
        try:
            obj.delete()
            self.message_user(request, "Contrato excluído com sucesso.", level=messages.SUCCESS)
        except ValidationError as e:
            self.message_user(request, str(e.message), level=messages.ERROR)
        except Exception as e:
            self.message_user(request, str(e), level=messages.ERROR)

    def delete_queryset(self, request, queryset):
        from .models import Receita
        contratos_com_receita = Receita.objects.filter(contrato__in=queryset).exists()
        if contratos_com_receita:
            self.message_user(
                request,
                "Alguns contratos possuem receitas vinculadas e não podem ser excluídos.",
                level=messages.ERROR
            )
            return
        super().delete_queryset(request, queryset)

    def has_delete_permission(self, request, obj=None):
        from .models import Receita, Sepultado

        if not request.user.is_superuser and not getattr(request.user, "is_master", False):
            return False

        if obj:
            if Receita.objects.filter(contrato=obj).exists():
                return False

            if Sepultado.objects.filter(tumulo=obj.tumulo, exumado=False, trasladado=False).exists():
                return False

        return True

    def link_pdf(self, obj):
        url = reverse('sepultados_gestao:gerar_contrato_pdf', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)
    link_pdf.short_description = "Contrato"

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "tumulo":
            cem = getattr(request, "cemiterio_ativo", None)
            cem_id = getattr(cem, "id", None) or request.session.get("cemiterio_ativo_id")

            if cem_id:
                kwargs["queryset"] = Tumulo.objects.filter(
                    Q(cemiterio_id=cem_id) | Q(quadra__cemiterio_id=cem_id)
                ).select_related("cemiterio", "quadra", "quadra__cemiterio")
            else:
                kwargs["queryset"] = Tumulo.objects.none()

        return super().formfield_for_foreignkey(db_field, request, **kwargs)


    class Media:
        js = ('custom_admin/js/contrato.js',)


from django.contrib import admin
from django.utils.html import format_html
from .models import Exumacao
from .forms import ExumacaoForm, TransladoForm
from .mixins import PrefeituraObrigatoriaAdminMixin
from .models import Exumacao, Translado, Sepultado, Receita  # etc.
from django.db.models import Q
from django.core.exceptions import ValidationError
from django.contrib import messages
from django.contrib import admin, messages
from .models import Exumacao, Receita
from django.urls import reverse



@admin.register(Exumacao)
class ExumacaoAdmin(admin.ModelAdmin):
    form = ExumacaoForm
    inlines = [AnexoInline]
    autocomplete_fields = ['sepultado', 'tumulo']
    readonly_fields = ['numero_documento']
    list_display = [
        'numero_documento', 'data', 'get_nome_sepultado',
        'valor_formatado', 'forma_pagamento', 'status_receita', 'link_pdf'
    ]
    list_filter = ['forma_pagamento']
    search_fields = ['sepultado__nome', 'numero_documento', 'nome_responsavel', 'cpf']
    ordering = ['-data']

    fieldsets = (
        ("Informações da Exumação", {
            'fields': ('numero_documento', 'data', 'sepultado', 'tumulo', 'motivo', 'observacoes')
        }),
        ("Pagamento", {
            'fields': ('forma_pagamento', 'quantidade_parcelas', 'valor')
        }),
        ("Responsável pela Solicitação", {
            'fields': ('nome_responsavel', 'cpf', 'endereco', 'telefone')
        }),
    )

  


    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related(
            "sepultado", "tumulo",
            "tumulo__quadra", "tumulo__cemiterio",
            "sepultado__tumulo", "sepultado__tumulo__quadra", "sepultado__tumulo__cemiterio",
        )

        # filtra por prefeitura (como você já fazia)
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        if prefeitura_id:
            qs = qs.filter(prefeitura_id=prefeitura_id)

        # NOVO: filtra também pelo cemitério ativo (middleware ou sessão)
        cem = getattr(request, "cemiterio_ativo", None)
        cem_id = getattr(cem, "id", None) or request.session.get("cemiterio_ativo_id")

        if cem_id:
            qs = qs.filter(
                Q(tumulo__cemiterio_id=cem_id) |
                Q(tumulo__quadra__cemiterio_id=cem_id) |
                Q(sepultado__tumulo__cemiterio_id=cem_id) |
                Q(sepultado__tumulo__quadra__cemiterio_id=cem_id)
            )
        else:
            # sem cemitério selecionado: não exibe nada para evitar mistura
            qs = qs.none()

        return qs

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        cem = getattr(request, "cemiterio_ativo", None)
        cem_id = getattr(cem, "id", None) or request.session.get("cemiterio_ativo_id")

        if db_field.name == "tumulo":
            if cem_id:
                kwargs["queryset"] = Tumulo.objects.filter(
                    Q(cemiterio_id=cem_id) | Q(quadra__cemiterio_id=cem_id)
                ).select_related("cemiterio", "quadra", "quadra__cemiterio")
            else:
                kwargs["queryset"] = Tumulo.objects.none()

        if db_field.name == "sepultado":
            if cem_id:
                kwargs["queryset"] = Sepultado.objects.filter(
                    Q(tumulo__cemiterio_id=cem_id) | Q(tumulo__quadra__cemiterio_id=cem_id)
                ).select_related("tumulo", "tumulo__cemiterio", "tumulo__quadra", "tumulo__quadra__cemiterio")
            else:
                kwargs["queryset"] = Sepultado.objects.none()

        return super().formfield_for_foreignkey(db_field, request, **kwargs)


    def get_nome_sepultado(self, obj):
        return obj.sepultado.nome if obj.sepultado else "-"
    get_nome_sepultado.short_description = "Sepultado"

    def valor_formatado(self, obj):
        return f"R$ {obj.valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    valor_formatado.short_description = "Valor"

    def status_receita(self, obj):
        receitas = obj.receitas.all()
        if not receitas:
            return "-"
        status = list(receitas.values_list('status', flat=True))
        if not status:
            return "-"
        if all(s.lower() == 'pago' for s in status):
            cor = 'green'
        elif any(s.lower() == 'parcial' for s in status):
            cor = 'orange'
        else:
            cor = 'red'
        return format_html(f'<b style="color: {cor}">{status[0].capitalize()}</b>')
    status_receita.short_description = "Status"

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)

        class FormComRequest(form):
            def __new__(cls, *args, **kwargs):
                kwargs['request'] = request
                return form(*args, **kwargs)

        return FormComRequest

    def delete_model(self, request, obj):
        if obj.receitas.exists():
            self.message_user(
                request,
                "Não é possível excluir esta exumação porque há receita vinculada.",
                level=messages.ERROR
            )
            return

        sepultado = obj.sepultado
        super().delete_model(request, obj)

        # Restaurar status do sepultado
        sepultado.exumado = False
        sepultado.save()

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            if obj.receitas.exists():
                self.message_user(
                    request,
                    f"Não é possível excluir a exumação de {obj.sepultado} porque há receita vinculada.",
                    level=messages.ERROR
                )
                continue

            sepultado = obj.sepultado
            obj.delete()
            sepultado.exumado = False
            sepultado.save()

    def link_pdf(self, obj):
        url = reverse('sepultados_gestao:pdf_exumacao', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)
    link_pdf.short_description = "Guia PDF"


    class Media:
        js = ('custom_admin/js/formulario_exumacao_translado.js',)

# certo
from sepultados_gestao.utils import obter_prefeitura_ativa_do_request



@admin.register(Translado)
class TransladoAdmin(admin.ModelAdmin):
    form = TransladoForm
    inlines = [AnexoInline]
    search_fields = ['sepultado__nome']
    autocomplete_fields = ['sepultado', 'tumulo_destino']
    readonly_fields = ['numero_documento']
    list_display = ['numero_documento', 'data', 'sepultado', 'destino', 'valor', 'forma_pagamento', 'link_pdf']
    list_filter = ['destino']
    fieldsets = (
        (None, {
            'fields': ('numero_documento', 'data', 'sepultado')
        }),
        ("Detalhes", {
            'fields': (
                'motivo', 'observacoes',
                'destino', 'tumulo_destino',
                'cemiterio_nome', 'cemiterio_endereco',
            )
        }),
        ("Pagamento", {
            'fields': ('forma_pagamento', 'quantidade_parcelas', 'valor')
        }),
        ("Responsável pela solicitação", {
            'fields': ('nome_responsavel', 'cpf', 'endereco', 'telefone')
        }),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related(
            "sepultado",
            "sepultado__tumulo", "sepultado__tumulo__quadra", "sepultado__tumulo__cemiterio",
            "tumulo_destino", "tumulo_destino__quadra", "tumulo_destino__cemiterio",
        )

        # prefeitura ativa (você já usava util)
        pref = obter_prefeitura_ativa_do_request(request)
        if pref:
            qs = qs.filter(
                Q(sepultado__tumulo__quadra__cemiterio__prefeitura=pref) |
                Q(tumulo_destino__quadra__cemiterio__prefeitura=pref)
            )

        # NOVO: cemitério ativo (middleware ou sessão)
        cem = getattr(request, "cemiterio_ativo", None)
        cem_id = getattr(cem, "id", None) or request.session.get("cemiterio_ativo_id")

        if cem_id:
            qs = qs.filter(
                Q(sepultado__tumulo__cemiterio_id=cem_id) |
                Q(sepultado__tumulo__quadra__cemiterio_id=cem_id) |
                Q(tumulo_destino__cemiterio_id=cem_id) |
                Q(tumulo_destino__quadra__cemiterio_id=cem_id)
            )
        else:
            # sem cemitério selecionado, não lista (evita mistura)
            qs = qs.none()

        return qs

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        cem = getattr(request, "cemiterio_ativo", None)
        cem_id = getattr(cem, "id", None) or request.session.get("cemiterio_ativo_id")

        if db_field.name == "sepultado":
            if cem_id:
                kwargs["queryset"] = Sepultado.objects.filter(
                    Q(tumulo__cemiterio_id=cem_id) | Q(tumulo__quadra__cemiterio_id=cem_id)
                ).select_related("tumulo", "tumulo__quadra", "tumulo__cemiterio")
            else:
                kwargs["queryset"] = Sepultado.objects.none()

        if db_field.name == "tumulo_destino":
            if cem_id:
                kwargs["queryset"] = Tumulo.objects.filter(
                    Q(cemiterio_id=cem_id) | Q(quadra__cemiterio_id=cem_id)
                ).select_related("cemiterio", "quadra", "quadra__cemiterio")
            else:
                kwargs["queryset"] = Tumulo.objects.none()

        return super().formfield_for_foreignkey(db_field, request, **kwargs)


    def delete_model(self, request, obj):
        if obj.receitas.exists():
            from django.contrib import messages
            messages.error(request, "Não é possível excluir: existem receitas vinculadas.")
            return

        sep = obj.sepultado

        # Reverter status para exumado no túmulo original
        sep.trasladado = False
        sep.data_translado = None
        sep.exumado = True
        sep.save(update_fields=['trasladado', 'data_translado', 'exumado'])

        # Importante: limpa o cache da propriedade status_display
        if 'status_display' in sep.__dict__:
            del sep.__dict__['status_display']

        super().delete_model(request, obj)





    def link_pdf(self, obj):
        url = reverse('sepultados_gestao:pdf_translado', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)
    link_pdf.short_description = "Guia PDF"








@admin.register(Plano)
class PlanoAdmin(admin.ModelAdmin):
    form = PlanoForm
    list_display = (
        'nome', 'preco_mensal', 'usuarios_min', 'usuarios_max',
        'sepultados_max', 'inclui_api', 'inclui_erp', 'inclui_suporte_prioritario'
    )
    list_filter = ('inclui_api', 'inclui_erp', 'inclui_suporte_prioritario')
    search_fields = ('nome',)
    ordering = ('preco_mensal',)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('<int:pk>/json/', self.admin_site.admin_view(self.plano_json_view), name='plano_json'),
        ]
        return custom_urls + urls

    def plano_json_view(self, request, pk):
        plano = self.get_object(request, pk)
        if plano:
            return JsonResponse({'preco_mensal': str(plano.preco_mensal)})
        return JsonResponse({'erro': 'Plano não encontrado'}, status=404)

    class Media:
        js = ('custom_admin/js/moeda.js',)

@admin.register(Licenca)
class LicencaAdmin(admin.ModelAdmin):
    list_display = (
        'prefeitura', 'plano', 'data_inicio', 'data_fim_formatada',
        'valor_mensal_atual', 'valor_mensal_reajustado',
    )
    list_filter = ('plano',)
    search_fields = ('prefeitura__nome',)
    readonly_fields = ('data_fim_formatada', 'valor_mensal_reajustado')

    def data_fim_formatada(self, obj):
        if obj.data_inicio and obj.anos_contratados:
            data_fim = obj.data_inicio + relativedelta(years=obj.anos_contratados)
            return data_fim.strftime('%d/%m/%Y')
        return "-"
    data_fim_formatada.short_description = "Data de Vencimento"

    def get_fields(self, request, obj=None):
        fields = [
            'prefeitura', 'plano', 'data_inicio', 'anos_contratados',
            'valor_mensal_atual', 'data_fim_formatada',
            'valor_mensal_reajustado',
        ]
        if request.user.is_superuser:
            fields.insert(5, 'percentual_reajuste_anual')
        return fields

    def get_readonly_fields(self, request, obj=None):
        readonly = list(self.readonly_fields)
        if not request.user.is_superuser:
            readonly.append('percentual_reajuste_anual')
        return readonly

    def get_form(self, request, obj=None, **kwargs):
        kwargs['form'] = LicencaForm
        form_class = super().get_form(request, obj, **kwargs)

        class FormWithUser(form_class):
            def __init__(self2, *args, **kw):
                kw['user'] = request.user
                super().__init__(*args, **kw)

        return FormWithUser

    def has_change_permission(self, request, obj=None):
        return True

    def has_delete_permission(self, request, obj=None):
        return True

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'plano/<int:pk>/json/',
                self.admin_site.admin_view(self.plano_json_view),
                name='plano_json'
            ),
        ]
        return custom_urls + urls

    def plano_json_view(self, request, pk):
        from .models import Plano
        plano = Plano.objects.get(pk=pk)
        return JsonResponse({'preco_mensal': float(plano.preco_mensal)})

    class Media:
        js = ('custom_admin/js/licenca_auto_valor.js',)


admin.site.register(Quadra, QuadraAdmin)
admin.site.register(Sepultado, SepultadoAdmin)



# === Ajuste final para controle de exibição no menu lateral ===
from django.contrib import admin
from django.apps import apps

# Modelos SEMPRE visíveis (antes de selecionar prefeitura/cemitério)
MODELOS_SEM_DEPENDENCIA = [
    'prefeitura', 'plano', 'licenca',
    'tipousuario',
    'user',                 # Usuários
    'quadra', 'sepultado',  # manter visíveis p/ autocomplete
]

# NÃO toque em User/Group aqui (sem unregister/register)
# Apenas controlamos visibilidade dos demais ModelAdmins
for model, model_admin in list(admin.site._registry.items()):
    model_name = model.__name__.lower()

    # ⬇️ Esconde SEMPRE o Group (Tipos de Usuário)
    if model_name == 'group':
        def _hide(self, request):
            return {}
        model_admin.get_model_perms = _hide
        continue

    if model_name in MODELOS_SEM_DEPENDENCIA:
        continue  # sempre visível

    original_get_model_perms = model_admin.get_model_perms

    # usa default-arg pra não sofrer com late-binding no loop
    def wrapped(self, request, _original=original_get_model_perms):
        prefeitura_ok = bool(request.session.get("prefeitura_ativa_id"))
        cemiterio_ok = bool(request.session.get("cemiterio_ativo_id"))
        if not (prefeitura_ok and cemiterio_ok):
            return {}
        return _original(request)

    model_admin.get_model_perms = wrapped

# Renomeia apps no menu (seguro e sem duplicação)
apps.get_app_config('auth').verbose_name = "Administração Geral"
apps.get_app_config('sepultados_gestao').verbose_name = "Sepultados Gestão"




from django.contrib import admin
from django.contrib.admin import AdminSite
from django.apps import apps

class CustomAdminSite(AdminSite):
    site_header = "Sepultados.com Administração"
    site_title = "Administração"
    index_title = "Administração Geral"

    def get_app_list(self, request):
        original_app_list = super().get_app_list(request)

        # 🔸 NÃO listar “Tipos de Usuário” aqui
        modelos_administracao_geral = {
            # "Tipos de Usuário",  # removido
            "Usuários",
            "Prefeituras",
            "Planos",
            "Licenças"
        }

        modelos_gestao = {
            "Cemiterio", "Quadra", "Tumulo", "Sepultado",
            "ConcessaoContrato", "Exumacao", "Translado",
            "Receita", "RegistroAuditoria",
        }

        modelos_com_prefeitura_apenas = {
            "Cemiterio", "TipoServicoFinanceiro", "Receita",
            "Tiposervicofinanceiro"
        }

        grupo_geral = {
            "name": "Administração Geral",
            "app_label": "admin_geral",
            "models": []
        }

        grupo_gestao = {
            "name": "Sepultados Gestão",
            "app_label": "sepultados_gestao",
            "models": []
        }

        grupo_importacoes = {
            "name": "Importações",
            "app_label": "importacoes",
            "models": []
        }

        grupo_relatorios = {
            "name": "Relatórios",
            "app_label": "menu_relatorios",
            "models": []
        }

        prefeitura_ativa_id = request.session.get("prefeitura_ativa_id")
        cemiterio_ativo_id = request.session.get("cemiterio_ativo_id")

        for app in original_app_list:
            for model in app["models"]:
                if model["name"] in modelos_administracao_geral:
                    grupo_geral["models"].append(model)
                elif model["object_name"] in modelos_gestao and prefeitura_ativa_id:
                    if model["object_name"] in modelos_com_prefeitura_apenas:
                        grupo_gestao["models"].append(model)
                    elif model["object_name"] == "RegistroAuditoria":
                        grupo_gestao["models"].append(model)
                    elif cemiterio_ativo_id:
                        grupo_gestao["models"].append(model)

        # Botão de Backup (só para superusuários)
        if request.user.is_superuser:
            grupo_geral["models"].append({
                "name": "Backup do Sistema",
                "object_name": "BackupSistema",
                "admin_url": "/backup/"
            })

        if prefeitura_ativa_id and cemiterio_ativo_id:
            grupo_importacoes["models"].append({
                "name": "Importar Quadras",
                "object_name": "ImportarQuadras",
                "admin_url": "/importar/quadras/",
                "add_url": "/importar/quadras/"
            })
            grupo_importacoes["models"].append({
                "name": "Importar Túmulos",
                "object_name": "ImportarTumulos",
                "admin_url": "/importar/tumulos/",
                "add_url": "/importar/tumulos/"
            })
            grupo_importacoes["models"].append({
                "name": "Importar Sepultados",
                "object_name": "ImportarSepultados",
                "admin_url": "/importar/sepultados/",
                "add_url": "/importar/sepultados/"
            })

            grupo_relatorios["models"].extend([
                {
                    "name": "Relatório de Sepultados",
                    "object_name": "RelatorioSepultados",
                    "admin_url": "/relatorios/sepultados/"
                },
                {
                    "name": "Relatório de Exumações",
                    "object_name": "RelatorioExumacoes",
                    "admin_url": "/relatorios/exumacoes/"
                },
                {
                    "name": "Relatório de Translados",
                    "object_name": "RelatorioTranslados",
                    "admin_url": "/relatorios/translados/"
                },
                {
                    "name": "Relatório de Contratos",
                    "object_name": "RelatorioContratos",
                    "admin_url": "/relatorios/contratos/"
                },
                {
                    "name": "Relatório de Receitas",
                    "object_name": "RelatorioReceitas",
                    "admin_url": "/relatorios/receitas/"
                },
                {
                    "name": "Relatório de Túmulos",
                    "object_name": "RelatorioTumulos",
                    "admin_url": "/relatorios/tumulos/"
                },
            ])

        resultado = []
        if grupo_geral["models"]:
            resultado.append(grupo_geral)
        if grupo_gestao["models"]:
            resultado.append(grupo_gestao)
        if grupo_importacoes["models"]:
            resultado.append(grupo_importacoes)
        if grupo_relatorios["models"]:
            resultado.append(grupo_relatorios)

        return resultado

    def register_models(self):
        for model, model_admin in admin.site._registry.items():
            self.register(model, model_admin.__class__)


from django.contrib import admin
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.encoding import force_str
from .models import Receita
from .forms import ReceitaForm
from .views import gerar_recibo_pdf 



@admin.register(Receita)
class ReceitaAdmin(admin.ModelAdmin):
    form = ReceitaForm
    list_display = (
        'numero_documento',
        'descricao_segura',
        'nome',
        'cpf',
        'data_vencimento',
        'status_colorido',
        'valor_total_formatado',
        'valor_pago_formatado',
        'valor_em_aberto_formatado',
        'link_pdf',
    )

    readonly_fields = (
        'numero_documento',
        'descricao',
        'nome',
        'cpf',
        'valor_total_formatado',
        'valor_em_aberto_formatado',
        'multa_formatada',
        'juros_formatado',
        'mora_diaria_formatada',
        'status',
        'data_vencimento',
        'data_pagamento',
    )

    fieldsets = (
        ("Identificação da Receita", {
            'fields': (
                'numero_documento',
                'descricao',
            )
        }),
        ("Dados do Comprador", {
            'fields': (
                'nome',
                'cpf',
            )
        }),
        ("Valores", {
            'fields': (
                'valor_total_formatado',
                'desconto',
                'valor_pago',
                'valor_em_aberto_formatado',
            )
        }),
        ("Vencimento e Pagamento", {
            'fields': (
                'data_vencimento',
                'data_pagamento',
            )
        }),
        ("Status e Juros", {
            'fields': (
                'status',
                'multa_formatada',
                'juros_formatado',
                'mora_diaria_formatada',
            )
        }),
    )

    search_fields = ('numero_documento', 'descricao', 'nome', 'cpf')
    list_filter = ('status', 'data_vencimento')
    ordering = ('-data_vencimento',)

    class Media:
        js = ('custom_admin/js/moeda.js',)

    def moeda(self, valor):
        if valor is None:
            return "R$ 0,00"
        return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    def valor_total_formatado(self, obj):
        return self.moeda(obj.valor_total)
    valor_total_formatado.short_description = "Valor total"

    def valor_em_aberto_formatado(self, obj):
        return self.moeda(obj.valor_em_aberto)
    valor_em_aberto_formatado.short_description = "Valor em aberto"

    def multa_formatada(self, obj):
        return self.moeda(obj.multa)
    multa_formatada.short_description = "Multa"

    def juros_formatado(self, obj):
        return self.moeda(obj.juros)
    juros_formatado.short_description = "Juros"

    def mora_diaria_formatada(self, obj):
        return self.moeda(obj.mora_diaria)
    mora_diaria_formatada.short_description = "Mora diária"

    def valor_pago_formatado(self, obj):
        return self.moeda(obj.valor_pago)
    valor_pago_formatado.short_description = "Valor pago"

    def status_colorido(self, obj):
        cor = {
            'aberto': 'red',
            'parcial': 'blue',
            'pago': 'green'
        }.get(obj.status.lower(), 'black')
        return format_html('<strong style="color: {};">{}</strong>', cor, obj.get_status_display())
    status_colorido.short_description = "Status"

    def descricao_segura(self, obj):
        return force_str(obj.descricao, errors='ignore')
    descricao_segura.short_description = "Descrição"

    def link_pdf(self, obj):
        url = reverse('admin:gerar_recibo_pdf', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)
    link_pdf.short_description = "Recibo"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'recibo/<int:receita_id>/pdf/',
                self.admin_site.admin_view(gerar_recibo_pdf),
                name='gerar_recibo_pdf',
            ),
        ]
        return custom_urls + urls

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser or getattr(request.user, 'is_master', False)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        if not prefeitura_id:
            return qs.none()
        return qs.filter(prefeitura_id=prefeitura_id)

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        return bool(prefeitura_id and self.model.objects.filter(prefeitura_id=prefeitura_id).exists())

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser or bool(request.session.get("prefeitura_ativa_id"))

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser or bool(request.session.get("prefeitura_ativa_id"))

    def has_add_permission(self, request):
        return False

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'prefeitura':
            kwargs['disabled'] = True
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

        acao = 'change' if change else 'add'
        registrar_auditoria(
            usuario=request.user,
            acao=acao,
            modelo="Receita",
            objeto_id=obj.pk,
            representacao=str(obj),
            prefeitura=getattr(obj, "prefeitura", None)
        )

    def delete_model(self, request, obj):
        registrar_auditoria(
            usuario=request.user,
            acao='delete',
            modelo="Receita",
            objeto_id=obj.pk,
            representacao=str(obj),
            prefeitura=getattr(obj, "prefeitura", None)
        )
        super().delete_model(request, obj)



from django.contrib import admin
from django.core.exceptions import PermissionDenied
from .models import RegistroAuditoria

@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    list_display = ('data_hora', 'acao', 'modelo', 'objeto_id', 'usuario')
    list_filter = ('acao', 'modelo', 'data_hora')
    search_fields = ('modelo', 'representacao', 'usuario__username')
    readonly_fields = ('acao', 'usuario', 'modelo', 'objeto_id', 'representacao', 'data_hora', 'prefeitura')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        prefeitura = getattr(request, 'prefeitura_ativa', None)
        if prefeitura:
            return qs.filter(prefeitura=prefeitura)
        return qs.none()


    def get_object(self, request, object_id, from_field=None):
        obj = super().get_object(request, object_id)
        if obj is None:
            return None
        if request.user.is_superuser:
            return obj
        prefeitura = getattr(request, 'prefeitura_ativa', None)
        if obj.prefeitura != prefeitura:
            raise PermissionDenied("Você não tem permissão para acessar esse registro.")
        return obj

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False  # Nenhuma edição permitida

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        if obj is None or request.user.is_superuser:
            return True
        prefeitura = getattr(request, 'prefeitura_ativa', None)
        return obj.prefeitura == prefeitura
    
