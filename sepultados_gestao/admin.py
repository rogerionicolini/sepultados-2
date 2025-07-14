from django.contrib import admin, messages
from django.utils.html import format_html
from django.urls import reverse
from django.shortcuts import redirect
from dateutil.relativedelta import relativedelta
from datetime import date

from .models import (
    Prefeitura, Cemiterio, Quadra, Tumulo,
    Sepultado, ConcessaoContrato, MovimentacaoSepultado,
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

class AnexoInline(GenericTabularInline):
    model = Anexo
    extra = 1
    verbose_name = "Anexo"
    verbose_name_plural = "Arquivos Anexados"



@admin.register(Prefeitura)
class PrefeituraAdmin(admin.ModelAdmin):
    list_display = ('nome', 'endereco_cidade', 'cnpj', 'usuario')
    list_filter = ('endereco_estado',)
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
            'fields': ('logo', 'brasao')
        }),
        ('Configurações financeiras', {
            'fields': ('multa_percentual', 'juros_mensal_percentual'),
            'description': 'Parâmetros de multa e juros para cobrança de serviços.'
        }),
        ('Contrato - Cláusulas Padrão', {
            'fields': ('clausulas_contrato',),
            'description': 'Esse texto será inserido automaticamente no meio dos contratos PDF.'
        }),
    )




@admin.register(Cemiterio)
class CemiterioAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    list_display = ("nome", "cidade", "estado", "telefone", "tempo_minimo_exumacao")
    search_fields = ("nome", "cidade")
    list_filter = ("estado",)

    def get_fields(self, request, obj=None):
        return [
            "nome",
            "endereco",
            "telefone",
            "cidade",
            "estado",
            "tempo_minimo_exumacao"
        ]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        return qs.filter(prefeitura_id=prefeitura_id)




# sepultados_gestao/admin.py

from django.contrib import admin, messages
from .models import Quadra
from .forms import QuadraForm

class QuadraAdmin(admin.ModelAdmin):
    form = QuadraForm
    list_display = ("codigo", "cemiterio")
    list_filter = ("cemiterio",)
    search_fields = ("codigo",)

    def get_form(self, request, obj=None, **kwargs):
        class CustomForm(self.form):
            def __init__(self_inner, *args, **kwargs_inner):
                kwargs_inner['request'] = request
                super().__init__(*args, **kwargs_inner)

            def add_error(self_inner, field, error):
                # Garante que erros em campos ocultos não gerem ValueError
                if field and field not in self_inner.fields:
                    field = None
                super().add_error(field, error)

        kwargs['form'] = CustomForm
        return super().get_form(request, obj, **kwargs)

    def save_model(self, request, obj, form, change):
        obj.prefeitura = request.prefeitura_ativa

        # Define o cemitério ativo da sessão
        cemiterio_id = request.session.get("cemiterio_ativo_id")
        if not cemiterio_id:
            messages.error(request, "Selecione um cemitério antes de cadastrar.")
            return

        obj.cemiterio_id = cemiterio_id
        super().save_model(request, obj, form, change)



    def get_queryset(self, request):
        qs = super().get_queryset(request)
        cemiterio_id = request.session.get("cemiterio_ativo_id")
        if cemiterio_id:
            return qs.filter(cemiterio_id=cemiterio_id)
        return qs.none()

    def get_model_perms(self, request):
        if not request.session.get("cemiterio_ativo_id"):
            return {}
        return super().get_model_perms(request)







@admin.register(Tumulo)
class TumuloAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    search_fields = ['identificacao', 'quadra__nome']
    form = TumuloForm
    list_display = (
        "tipo_estrutura", "identificador", "quadra",
        "status_com_cor", "usar_linha", "linha", "reservado"
    )
    list_filter = ("status", "quadra", "usar_linha", "reservado")
    search_fields = ("identificador", "linha", "quadra__numero", "quadra__cemiterio__nome")
    readonly_fields = ("status",)
    fields = (
        "tipo_estrutura", "identificador", "capacidade", "quadra",
        "usar_linha", "linha", "reservado", "motivo_reserva", "status"
    )

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



from django.contrib import admin
from django.utils.html import format_html
from .models import Sepultado, Tumulo
from .mixins import PrefeituraObrigatoriaAdminMixin
from .forms import SepultadoForm



class SepultadoAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    form = SepultadoForm
    inlines = [AnexoInline]
    autocomplete_fields = ['tumulo']
    list_display = (
        'nome', 'data_nascimento', 'data_falecimento',
        'idade_ao_falecer', 'tumulo', 'link_pdf'
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
                'nome', 'sexo', 'sexo_outro_descricao', 'data_nascimento', 'local_nascimento',
                'nacionalidade', 'cor_pele', 'estado_civil', 'nome_conjuge',
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

    def informacoes_movimentacoes(self, obj):
        if not obj:
            return "Informações disponíveis após salvar o sepultado."
        
        exumacoes = obj.movimentacaosepultado_set.filter(tipo='EXUMACAO').order_by('-data')
        translados = obj.movimentacaosepultado_set.filter(tipo='TRANSLADO').order_by('-data')

        html = "<div style='padding:8px; border:1px solid #ccc; background:#f8f8f8;'>"
        if exumacoes.exists():
            html += f"<p><strong>Exumado em:</strong> {exumacoes.first().data.strftime('%d/%m/%Y')}</p>"
        else:
            html += "<p><strong>Exumado:</strong> Não</p>"

        if translados.exists():
            html += f"<p><strong>Transladado em:</strong> {translados.first().data.strftime('%d/%m/%Y')}</p>"
        else:
            html += "<p><strong>Transladado:</strong> Não</p>"

        html += "</div>"
        return format_html(html)

    informacoes_movimentacoes.short_description = "Exumações / Translado"

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

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'tumulo':
            cemiterio_id = request.session.get("cemiterio_ativo_id")
            if cemiterio_id:
                kwargs["queryset"] = Tumulo.objects.filter(quadra__cemiterio_id=cemiterio_id)
            else:
                kwargs["queryset"] = Tumulo.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def link_pdf(self, obj):
            url = reverse('sepultados_gestao:gerar_guia_sepultamento_pdf', args=[obj.pk])
            return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)

    link_pdf.short_description = "Guia PDF"
    
    class Media:
        js = (
            'custom_admin/js/sexo_outro.js',
            'custom_admin/js/sepultado_pagamento.js',  # novo
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
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        return qs.filter(prefeitura_id=prefeitura_id)

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

    
    from django.contrib import messages

    def delete_model(self, request, obj):
        from .models import Receita
        existe_receita = Receita.objects.filter(contrato=obj).exists()
        if existe_receita:
            self.message_user(
                request,
                "Este contrato possui receita vinculada e não pode ser excluído.",
                level=messages.ERROR
            )
            return
        super().delete_model(request, obj)

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
        from .models import Receita
        if not request.user.is_superuser and not getattr(request.user, "is_master", False):
            return False
        if obj:
            return not Receita.objects.filter(contrato=obj).exists()
        return True



    def link_pdf(self, obj):
        url = reverse('sepultados_gestao:gerar_contrato_pdf', args=[obj.pk])
        return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)
    link_pdf.short_description = "Contrato"

    class Media:
        js = ('custom_admin/js/contrato.js',)
    



from .forms import MovimentacaoSepultadoForm



class MovimentacaoSepultadoAdmin(PrefeituraObrigatoriaAdminMixin, admin.ModelAdmin):
    form = MovimentacaoSepultadoForm
    inlines = [AnexoInline]
    autocomplete_fields = ['sepultado', 'tumulo_origem', 'tumulo_destino']
    readonly_fields = ['tumulo_origem_exibicao', 'numero_movimentacao']
    list_display = (
        "sepultado", "tipo", "data", "motivo", "tumulo_origem_exibicao",
        "tipo_destino_formatado", "tumulo_destino", "destino_resumido", "botao_pdf"
    )
    list_filter = ("tipo", "data", "destino_tipo")

    fieldsets = (
        ("Dados da Movimentação", {
            'fields': (
                "numero_movimentacao",
                "sepultado",
                "tipo",
                "data",
                "motivo",
                "tumulo_origem",
                "observacoes",
                "destino_tipo",
                "tumulo_destino",
                "cemiterio_destino_nome",
                "cidade_destino",
                "estado_destino",
                "forma_pagamento",
                "quantidade_parcelas",
                "valor",             
            )
        }),
        ("Responsável", {
            'fields': (
                "nome",
                "cpf",
                "endereco",
                "telefone",
            )
        }),
    )

    
    def tumulo_origem_exibicao(self, obj):
        if obj.sepultado and obj.sepultado.tumulo:
            return str(obj.sepultado.tumulo)
        return "-"
    tumulo_origem_exibicao.short_description = "Túmulo de Origem"

    def receita_associada(self, obj):
        if hasattr(obj, 'receita'):
            url = reverse('admin:sepultados_gestao_receita_change', args=[obj.receita.id])
            return format_html('<a href="{}">Ver Receita</a>', url)
        return "-"
    receita_associada.short_description = "Receita Gerada"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        prefeitura_id = request.session.get("prefeitura_ativa_id")
        if not prefeitura_id:
            return qs.none()
        return qs.select_related(
            'sepultado__tumulo__quadra__cemiterio',
            'tumulo_destino__quadra__cemiterio',
        ).filter(
            sepultado__tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id
        )


    def get_model_perms(self, request):
        if not request.session.get("prefeitura_ativa_id"):
            return {}
        return super().get_model_perms(request)

    def tipo_destino_formatado(self, obj):
        return obj.get_destino_tipo_display() if obj.destino_tipo != "NAO_INFORMADO" else "-"
    tipo_destino_formatado.short_description = "Tipo de Destino"

    def destino_resumido(self, obj):
        if obj.destino_tipo == 'EXTERNO':
            if obj.cemiterio_destino_nome or obj.cidade_destino or obj.estado_destino:
                return f"{obj.cemiterio_destino_nome or 'Outro cemitério'} ({obj.cidade_destino}-{obj.estado_destino})"
            return "Outro cemitério"
        elif obj.destino_tipo == 'INTERNO':
            return f"Túmulo {obj.tumulo_destino}" if obj.tumulo_destino else "Túmulo não informado"
        elif obj.destino_tipo == 'OSSARIO':
            return "Ossário"
        return "-"
    destino_resumido.short_description = "Destino"

    def delete_model(self, request, obj):
        obj.delete()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name in ['tumulo_origem', 'tumulo_destino']:
            cemiterio_id = request.session.get("cemiterio_ativo_id")

            if not cemiterio_id:
                sepultado_id = request.POST.get("sepultado")
                if sepultado_id:
                    try:
                        sepultado = Sepultado.objects.get(pk=sepultado_id)
                        if sepultado.tumulo and sepultado.tumulo.quadra:
                            cemiterio_id = sepultado.tumulo.quadra.cemiterio_id
                    except Sepultado.DoesNotExist:
                        pass

            kwargs["queryset"] = Tumulo.objects.filter(
                quadra__cemiterio_id=cemiterio_id
            ) if cemiterio_id else Tumulo.objects.none()

        elif db_field.name == 'sepultado':
            prefeitura_id = request.session.get("prefeitura_ativa_id")
            cemiterio_id = request.session.get("cemiterio_ativo_id")
            if prefeitura_id and cemiterio_id:
                kwargs["queryset"] = Sepultado.objects.filter(
                    tumulo__quadra__cemiterio__prefeitura_id=prefeitura_id,
                    tumulo__quadra__cemiterio_id=cemiterio_id
                )
            else:
                kwargs["queryset"] = Sepultado.objects.none()

        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def render_change_form(self, request, context, *args, **kwargs):
        sepultado_id = request.GET.get('sepultado') or ''
        context['adminform'].form.fields['sepultado'].widget.attrs['data-url'] = '/admin/obter-tumulo-origem/'
        context['additional_html'] = f'''
            <div id="tumulo-origem-info" style="margin-top: 10px; font-weight: bold; color: #003300;"></div>
            <script>
                document.addEventListener("DOMContentLoaded", function () {{
                    const sepultadoField = document.getElementById("id_sepultado");
                    const tumuloDiv = document.getElementById("tumulo-origem-info");
                    function atualizarTumulo() {{
                        const id = sepultadoField.value;
                        const url = sepultadoField.dataset.url;
                        if (id) {{
                            fetch(`${{url}}?id=${{id}}`)
                                .then(response => response.json())
                                .then(data => {{
                                    tumuloDiv.textContent = data.tumulo || "Nenhum túmulo encontrado";
                                }});
                        }} else {{
                            tumuloDiv.textContent = "";
                        }}
                    }}
                    sepultadoField.addEventListener("change", atualizarTumulo);
                    atualizarTumulo();
                }});
            </script>
        '''
        context['additional_form_content'] = context.get('additional_html', '')
        return super().render_change_form(request, context, *args, **kwargs)

    from django.urls import reverse
    from django.utils.html import format_html

    def botao_pdf(self, obj):
        if obj.tipo == 'EXUMACAO':
            url = reverse("sepultados_gestao:pdf_exumacao", args=[obj.pk])
        elif obj.tipo == 'TRANSLADO':
            url = reverse("sepultados_gestao:pdf_translado", args=[obj.pk])
        else:
            return "-"
        return format_html('<a href="{}" target="_blank">📄 PDF</a>', url)

    botao_pdf.short_description = "Guia"


    
    class Media:
        js = ['custom_admin/js/movimentacao.js']


@admin.register(Plano)
class PlanoAdmin(admin.ModelAdmin):
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
admin.site.register(MovimentacaoSepultado, MovimentacaoSepultadoAdmin)
admin.site.register(Sepultado, SepultadoAdmin)


# === Ajuste final para controle de exibição no menu lateral ===

MODELOS_SEM_DEPENDENCIA = [
    'prefeitura', 'plano', 'licenca',
    'tipousuario', 'user',  # "user" é do próprio auth.User
]

from django.contrib.auth.models import User, Group

class AlwaysVisibleAdmin(admin.ModelAdmin):
    def get_model_perms(self, request):
        return super().get_model_perms(request)

# Garante que usuários e grupos estejam sempre visíveis
admin.site.unregister(User)
admin.site.register(User, AlwaysVisibleAdmin)

admin.site.unregister(Group)
admin.site.register(Group, AlwaysVisibleAdmin)

# Altera dinamicamente os outros ModelAdmins registrados
for model, model_admin in admin.site._registry.items():
    model_name = model.__name__.lower()

    if model_name in MODELOS_SEM_DEPENDENCIA:
        continue  # Sempre visível

    original_get_model_perms = model_admin.get_model_perms

    def make_wrapped_get_model_perms(original_func):
        def wrapped(self, request):
            prefeitura_ok = bool(request.session.get("prefeitura_ativa_id"))
            cemiterio_ok = bool(request.session.get("cemiterio_ativo_id"))
            if not (prefeitura_ok and cemiterio_ok):
                return {}
            return original_func(request)
        return wrapped.__get__(model_admin, model_admin.__class__)

    model_admin.get_model_perms = make_wrapped_get_model_perms(original_get_model_perms)


from django.contrib.auth.models import User, Group

class AlwaysVisibleAdmin(admin.ModelAdmin):
    def get_model_perms(self, request):
        return super().get_model_perms(request)

# Garante que usuários e grupos estejam sempre visíveis
admin.site.unregister(User)
admin.site.register(User, AlwaysVisibleAdmin)

admin.site.unregister(Group)
admin.site.register(Group, AlwaysVisibleAdmin)

from django.apps import apps

# Renomeia o app "auth" para exibir "Administração Geral" no menu
auth_app_config = apps.get_app_config('auth')
auth_app_config.verbose_name = "Administração Geral"

# Renomeia o seu app para exibir "Sepultados Gestão"
sepultados_app_config = apps.get_app_config('sepultados_gestao')
sepultados_app_config.verbose_name = "Sepultados Gestão"

# === AGRUPAMENTO VISUAL NO MENU LATERAL ===

from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.auth.models import User, Group
from django.apps import apps

class CustomAdminSite(AdminSite):
    site_header = "Sepultados.com Administração"
    site_title = "Administração"
    index_title = "Administração Geral"

    def get_app_list(self, request):
        original_app_list = super().get_app_list(request)

        modelos_administracao_geral = {
            "Tipos de Usuário",
            "Usuários",
            "Prefeituras",
            "Planos",
            "Licenças"
        }

        modelos_gestao = {
            "Cemiterio", "Quadra", "Tumulo", "Sepultado",
            "ConcessaoContrato", "MovimentacaoSepultado",
            "TipoServicoFinanceiro", "Receita"
        }

        modelos_com_prefeitura_apenas = {
            "Cemiterio", "TipoServicoFinanceiro", "Receita",
            "Tiposervicofinanceiro"  # Adicione esta variação para garantir
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

        prefeitura_ativa_id = request.session.get("prefeitura_ativa_id")
        cemiterio_ativo_id = request.session.get("cemiterio_ativo_id")

        for app in original_app_list:
            for model in app["models"]:
                if model["name"] in modelos_administracao_geral:
                    grupo_geral["models"].append(model)
                elif model["object_name"] in modelos_gestao and prefeitura_ativa_id:
                    if model["object_name"] in modelos_com_prefeitura_apenas:
                        grupo_gestao["models"].append(model)
                    elif cemiterio_ativo_id:
                        grupo_gestao["models"].append(model)


        resultado = []
        if grupo_geral["models"]:
            resultado.append(grupo_geral)
        if grupo_gestao["models"]:
            resultado.append(grupo_gestao)
        return resultado

    def register_models(self):
        from django.contrib import admin
        for model, model_admin in admin.site._registry.items():
            self.register(model, model_admin.__class__)



from django.contrib import admin
from django.utils.html import format_html
from .models import Receita

@admin.register(Receita)
class ReceitaAdmin(admin.ModelAdmin):
    list_display = (
        'numero_documento',
        'descricao',
        'nome',
        'cpf',
        'data_vencimento',
        'status_colorido',
        'valor_total',
        'valor_pago',
        'valor_em_aberto',
    )

    readonly_fields = (
        'numero_documento',
        'descricao',
        'nome',
        'cpf',
        'valor_total',
        'valor_em_aberto',
        'status',
        'multa',
        'juros',
        'mora_diaria',
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
                'valor_total',
                'desconto',
                'valor_pago',
                'valor_em_aberto',
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
                'multa',
                'juros',
                'mora_diaria',
            )
        }),
    )

    search_fields = ('numero_documento', 'descricao', 'nome', 'cpf')
    list_filter = ('status', 'data_vencimento')
    ordering = ('-data_vencimento',)

    def status_colorido(self, obj):
        cor = {
            'Aberto': 'red',
            'Parcial': 'blue',
            'Pago': 'green'
        }.get(obj.status, 'black')
        return format_html('<strong style="color: {};">{}</strong>', cor, obj.status)
    status_colorido.short_description = "Status"


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
        if not prefeitura_id:
            return False
        return self.model.objects.filter(prefeitura_id=prefeitura_id).exists()

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser or bool(request.session.get("prefeitura_ativa_id"))

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser or bool(request.session.get("prefeitura_ativa_id"))

    def has_add_permission(self, request):
        return False

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name in ['prefeitura']:
            kwargs['disabled'] = True
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


