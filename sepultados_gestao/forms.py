from django import forms
from .models import ConcessaoContrato
from django import forms
from .models import Tumulo, Quadra, Cemiterio
from crum import get_current_request
from django.utils.safestring import mark_safe
from decimal import Decimal, InvalidOperation




from django.core.exceptions import ValidationError
import re

def validar_cpf_cnpj(valor):
    cpf_pattern = r'^\d{3}\.\d{3}\.\d{3}-\d{2}$'
    cnpj_pattern = r'^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'
    if not re.match(cpf_pattern, valor) and not re.match(cnpj_pattern, valor):
        raise ValidationError("Informe um CPF ou CNPJ válido com máscara.")

from django import forms
from .models import ConcessaoContrato, Tumulo
from django.core.exceptions import ValidationError
from crum import get_current_request


class ConcessaoContratoForm(forms.ModelForm):
    cpf = forms.CharField(
        label="CPF ou CNPJ",
        max_length=18,
        widget=forms.TextInput(attrs={
            'placeholder': '000.000.000-00 ou 00.000.000/0000-00',
            'data-mask-cpf-cnpj': 'true'
        })
    )

    telefone = forms.CharField(
        label="Telefone",
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': '(00) 00000-0000',
            'data-mask-telefone': 'true'
        })
    )

    valor_total = forms.CharField(
        label="Valor total",
        widget=forms.TextInput(attrs={
            'placeholder': 'R$ 0,00',
            'data-mask-moeda': 'true'
        })
    )

    quantidade_parcelas = forms.IntegerField(
        label="Quantidade de Parcelas",
        required=False,
        widget=forms.NumberInput(attrs={
            'data-show-if-parcelado': 'true'
        })
    )

    class Meta:
        model = ConcessaoContrato
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        request = kwargs.pop('request', get_current_request())
        super().__init__(*args, **kwargs)

        prefeitura_id = getattr(request, 'prefeitura_ativa_id', None)
        if prefeitura_id:
            self.fields['tumulo'].queryset = Tumulo.objects.filter(
                quadra__cemiterio__prefeitura_id=prefeitura_id
            )

        self.fields['valor_total'].required = True
        self.fields['cpf'].required = True
        self.fields['nome'].required = True

        # Detectar forma_pagamento da melhor fonte possível
        forma = self.data.get('forma_pagamento') or self.initial.get('forma_pagamento')
        if not forma and self.instance.pk:
            forma = self.instance.forma_pagamento

        # Esconde o campo se não for parcelado
        self.fields['quantidade_parcelas'].widget.attrs.update({
            'data-show-if-parcelado': 'true',
            'style': 'display:none;'
        })


    def clean_valor_total(self):
        valor = self.cleaned_data.get('valor_total')
        if isinstance(valor, str):
            valor = valor.replace("R$", "").replace(".", "").replace(",", ".").strip()
        try:
            return float(valor)
        except ValueError:
            raise ValidationError("Informe um valor válido.")


from django import forms
from django.core.exceptions import ValidationError
from django.forms import HiddenInput
from crum import get_current_request
import json, re

from .models import Quadra, Cemiterio

class QuadraForm(forms.ModelForm):
    # Campo pequeno para digitar só o grau (0–360)
    angulo = forms.IntegerField(
        label="Ângulo dos Túmulos (0–360)",
        min_value=0, max_value=360, required=False,
        help_text="Será salvo dentro de Grid params como {'angulo': X}."
    )

    # Campo prático para colar as coordenadas “lat, lng”
    coordenadas = forms.CharField(
        label="Coordenadas (lat, lng)",
        required=False,
        widget=forms.Textarea(attrs={"rows": 3}),
        help_text=(
            "Cole pontos como no Google Maps, ex.: -23.4399260983, -51.9283936978. "
            "Pode ser um por linha ou vários na mesma linha; par a par (lat, lng). "
            "Aceita parênteses e vírgulas; o form converte para JSON do campo Polígono."
        )
    )

    class Meta:
        model = Quadra
        fields = "__all__"
        widgets = {
            "grid_params": HiddenInput(),  # oculto; o form preenche/limpa
        }

    # ---------- Helpers ----------
    @staticmethod
    def _parse_coordenadas(texto: str):
        """
        Extrai números (lat/lng) de um texto livre e retorna uma lista
        de dicts [{'lat': x, 'lng': y}, ...]. Valida faixas.
        """
        nums = re.findall(r'[-+]?\d+(?:\.\d+)?', texto or "")
        if not nums:
            return []

        if len(nums) % 2 != 0:
            raise ValidationError({"coordenadas": "Quantidade de números ímpar. Forneça pares (lat, lng)."})

        pontos = []
        for i in range(0, len(nums), 2):
            lat = float(nums[i])
            lng = float(nums[i + 1])
            if not (-90 <= lat <= 90):
                raise ValidationError({"coordenadas": f"Latitude fora da faixa (-90..90): {lat}"})
            if not (-180 <= lng <= 180):
                raise ValidationError({"coordenadas": f"Longitude fora da faixa (-180..180): {lng}"})
            pontos.append({"lat": lat, "lng": lng})
        return pontos

    def __init__(self, *args, **kwargs):
        self.request = kwargs.pop('request', get_current_request())
        super().__init__(*args, **kwargs)

        # Esconde 'cemiterio' no form (você seta pela sessão)
        if 'cemiterio' in self.fields:
            self.fields['cemiterio'].widget = HiddenInput()

        # Pré-preenche ANGULO a partir de grid_params
        gp = getattr(self.instance, "grid_params", None)
        data = {}
        if gp:
            try:
                data = gp if isinstance(gp, dict) else json.loads(gp)
            except Exception:
                data = {}
        if self.fields["angulo"].initial is None:
            try:
                self.fields["angulo"].initial = int(data.get("angulo", 0))
            except Exception:
                self.fields["angulo"].initial = 0

        # Pré-preenche COORDENADAS a partir do poligono_mapa
        pm = getattr(self.instance, "poligono_mapa", None)
        try:
            lista = pm if isinstance(pm, list) else (json.loads(pm) if pm else [])
        except Exception:
            lista = []
        if lista and not self.initial.get("coordenadas"):
            linhas = []
            for p in lista:
                try:
                    linhas.append(f"{p.get('lat')}, {p.get('lng')}")
                except Exception:
                    pass
            self.initial["coordenadas"] = "\n".join(linhas)

        if "poligono_mapa" in self.fields and not self.fields["poligono_mapa"].help_text:
            self.fields["poligono_mapa"].help_text = (
                "Se preferir, edite o JSON bruto aqui (lista de objetos {'lat','lng'}). "
                "Mas o campo 'Coordenadas' acima já converte automaticamente."
            )

    def clean(self):
        cleaned_data = super().clean()

        # Garante cemitério via sessão
        cemiterio_id = self.request.session.get("cemiterio_ativo_id")
        if not cemiterio_id:
            raise ValidationError("Selecione um cemitério antes de cadastrar a quadra.")
        try:
            self.instance.cemiterio = Cemiterio.objects.get(id=cemiterio_id)
        except Cemiterio.DoesNotExist:
            raise ValidationError("Cemitério selecionado não encontrado.")

        # ----- ÂNGULO -----
        ang_raw = cleaned_data.get("angulo", None)
        if ang_raw in (None, ""):
            # usuário quer remover ângulo => grid_params será None no save()
            self._grid_params_dict = None
        else:
            try:
                ang = int(ang_raw)
            except (TypeError, ValueError):
                raise ValidationError({"angulo": "Valor inválido."})
            if not 0 <= ang <= 360:
                raise ValidationError({"angulo": "O ângulo deve estar entre 0 e 360."})
            self._grid_params_dict = {"angulo": ang}

        # ----- COORDENADAS -> poligono_mapa -----
        coords_txt = (cleaned_data.get("coordenadas") or "").strip()
        field_was_sent = "coordenadas" in (self.data or {})
        if coords_txt:
            self._poligono_lista = self._parse_coordenadas(coords_txt)  # substitui
        elif field_was_sent:
            # veio vazio explicitamente => limpar
            self._poligono_lista = []    # transformo em None no save()
        else:
            # não veio no POST => mantém
            self._poligono_lista = None

        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)

        # grid_params
        gp_data = getattr(self, "_grid_params_dict", None)
        gp_field = instance._meta.get_field("grid_params")
        try:
            is_json_gp = gp_field.get_internal_type() == "JSONField"
        except Exception:
            is_json_gp = False
        if gp_data is None:
            instance.grid_params = None
        else:
            instance.grid_params = gp_data if is_json_gp else json.dumps(gp_data, ensure_ascii=False)

        # poligono_mapa
        if getattr(self, "_poligono_lista", None) is not None:
            pm_field = instance._meta.get_field("poligono_mapa")
            try:
                is_json_pm = pm_field.get_internal_type() == "JSONField"
            except Exception:
                is_json_pm = False
            to_set = None if self._poligono_lista == [] else self._poligono_lista
            instance.poligono_mapa = (
                to_set if is_json_pm else json.dumps(to_set, ensure_ascii=False)
            )

        if commit:
            instance.save()
        return instance







from django import forms
from django.contrib.auth import authenticate
from .models import Prefeitura

class SelecionarPrefeituraForm(forms.Form):
    prefeitura = forms.ModelChoiceField(
        queryset=Prefeitura.objects.all(),
        label="Prefeitura",
        required=True
    )
    password = forms.CharField(
        label="Confirme sua senha",
        widget=forms.PasswordInput,
        required=True
    )

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)

        if not self.user.is_superuser:
            self.fields['prefeitura'].queryset = Prefeitura.objects.filter(usuario=self.user)

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")

        if not self.user.check_password(password):
            raise forms.ValidationError("Senha incorreta. Tente novamente.")

        return cleaned_data

from decimal import Decimal, InvalidOperation
from django import forms
from django.forms import TextInput
from .models import Licenca  # ajuste conforme seu app

class LicencaForm(forms.ModelForm):
    data_inicio = forms.DateField(
        widget=forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date', 'class': 'vDateField'}),
        input_formats=['%Y-%m-%d', '%d/%m/%Y'],
        required=True,
        label="Início"
    )

    class Meta:
        model = Licenca
        fields = [
            'prefeitura', 'plano', 'data_inicio', 'anos_contratados',
            'valor_mensal_atual',
            'usuarios_min', 'usuarios_max', 'sepultados_max',
            'inclui_api', 'inclui_erp', 'inclui_suporte_prioritario',
        ]
        labels = {
            'prefeitura': 'Prefeitura',
            'plano': 'Plano',
            'data_inicio': 'Início',
            'anos_contratados': 'Duração (anos)',
            'valor_mensal_atual': 'Valor Mensal Atual',
            'ativa': 'Licença Ativa',
            'usuarios_min': 'Usuários Mínimos',
            'usuarios_max': 'Usuários Máximos',
            'sepultados_max': 'Sepultados Máximos',
            'inclui_api': 'Inclui API',
            'inclui_erp': 'Inclui ERP',
            'inclui_suporte_prioritario': 'Suporte Prioritário',
        }

    def __init__(self, *args, **kwargs):
        self.current_user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)

        self.fields['valor_mensal_atual'].widget = TextInput(attrs={
            'placeholder': 'R$ 0,00',
            'class': 'vCurrencyField',  # isso ativa formatação no admin
            'inputmode': 'decimal'
        })

        if self.current_user and not self.current_user.is_superuser:
            for field in [
                'usuarios_min', 'usuarios_max', 'sepultados_max',
                'inclui_api', 'inclui_erp', 'inclui_suporte_prioritario'
            ]:
                self.fields.pop(field, None)

    def clean_valor_mensal_atual(self):
        valor = self.cleaned_data.get('valor_mensal_atual')
        if isinstance(valor, str):
            valor = valor.replace('R$', '').replace('.', '').replace(',', '.').strip()
            try:
                valor = Decimal(valor)
            except InvalidOperation:
                raise forms.ValidationError("Valor inválido.")
        return valor or Decimal("0.00")

    def save(self, commit=True):
        licenca = super().save(commit=False)

        if not licenca.pk:
            licenca.usuarios_min = licenca.plano.usuarios_min
            licenca.usuarios_max = licenca.plano.usuarios_max
            licenca.sepultados_max = licenca.plano.sepultados_max
            licenca.inclui_api = licenca.plano.inclui_api
            licenca.inclui_erp = licenca.plano.inclui_erp
            licenca.inclui_suporte_prioritario = licenca.plano.inclui_suporte_prioritario

        if commit:
            licenca.save()
        return licenca

    def set_user(self, user):
        self.current_user = user

from decimal import Decimal, InvalidOperation

from django import forms
from django.core.exceptions import ValidationError
from django.forms import HiddenInput
import json, re
from .models import Tumulo, Quadra


class TumuloForm(forms.ModelForm):
    coordenada = forms.CharField(
        label="Coordenada (lat, lng)",
        required=False,
        widget=forms.TextInput(attrs={
            "class": "vTextField",
            "size": 60,
            "style": "width: 42ch;"
        }),
        help_text="Ex.: -23.458582390430013, -52.03785445717775",
    )

    class Meta:
        model = Tumulo
        fields = "__all__"
        widgets = {
            "localizacao": HiddenInput(),   # não mostramos o JSON cru
            "cemiterio": HiddenInput(),
        }

    # ----------------- helpers -----------------
    @staticmethod
    def _parse_lat_lng(txt: str):
        if not txt or not txt.strip():
            return None
        s = re.sub(r'^[\(\[]\s*|\s*[\)\]]$', '', txt.strip())
        m = re.match(r'^([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)$', s)
        if not m:
            raise ValidationError({"coordenada": "Use o formato: -23.45, -52.03 (somente números e vírgula)."})
        lat = float(m.group(1)); lng = float(m.group(2))
        if not (-90 <= lat <= 90):   raise ValidationError({"coordenada": f"Latitude fora de -90..90: {lat}"})
        if not (-180 <= lng <= 180): raise ValidationError({"coordenada": f"Longitude fora de -180..180: {lng}"})
        return {"lat": lat, "lng": lng}

    @staticmethod
    def _point_from_localizacao(loc):
        if not loc:
            return None
        if isinstance(loc, str):
            try: loc = json.loads(loc)
            except Exception: return None
        if isinstance(loc, dict):
            if "lat" in loc and "lng" in loc:
                return {"lat": float(loc["lat"]), "lng": float(loc["lng"])}
            if "centro" in loc and isinstance(loc["centro"], dict):
                c = loc["centro"]
                if "lat" in c and "lng" in c:
                    return {"lat": float(c["lat"]), "lng": float(c["lng"])}
            return None
        if isinstance(loc, list) and loc:
            lats, lngs = [], []
            for p in loc:
                if isinstance(p, dict) and "lat" in p and "lng" in p:
                    lats.append(float(p["lat"])); lngs.append(float(p["lng"]))
                elif isinstance(p, (list, tuple)) and len(p) == 2:
                    lats.append(float(p[0])); lngs.append(float(p[1]))
            if lats and lngs:
                return {"lat": sum(lats)/len(lats), "lng": sum(lngs)/len(lngs)}
        return None

    # ----------------- init -----------------
    def __init__(self, *args, **kwargs):
        request = kwargs.pop('request', None)
        self.request = request
        super().__init__(*args, **kwargs)

        cemiterio_id = getattr(request.cemiterio_ativo, 'id', None) if request else None
        self.fields['quadra'].queryset = Quadra.objects.filter(cemiterio_id=cemiterio_id) if cemiterio_id else Quadra.objects.none()

        # pré-preenche coordenada a partir do que já está salvo (ponto/centro/polígono)
        p = self._point_from_localizacao(getattr(self.instance, "localizacao", None))
        if p:
            self.initial["coordenada"] = f"{p['lat']}, {p['lng']}"

    # ----------------- normalizações/validações -----------------
    def _parse_decimal(self, value, campo, padrao: Decimal) -> Decimal:
        """Aceita '2,00' ou '2.00'. Se vazio => usa padrão."""
        if value in (None, ""):
            return padrao
        if isinstance(value, Decimal):
            v = value
        else:
            s = str(value).strip().replace(",", ".")
            try:
                v = Decimal(s)
            except (InvalidOperation, ValueError):
                raise ValidationError({campo: "Valor inválido. Use número, ex.: 2,00"})
        if v <= 0:
            raise ValidationError({campo: "Informe um valor maior que zero."})
        return v

    def clean_comprimento_m(self):
        val = self.cleaned_data.get("comprimento_m", None)
        return self._parse_decimal(val, "comprimento_m", Tumulo.PADRAO_COMPRIMENTO_M)

    def clean_largura_m(self):
        val = self.cleaned_data.get("largura_m", None)
        return self._parse_decimal(val, "largura_m", Tumulo.PADRAO_LARGURA_M)

    def clean_angulo_graus(self):
        """Ângulo opcional; aceita vírgula. Intervalo [-360, 360]."""
        val = self.cleaned_data.get("angulo_graus", None)
        if val in (None, ""):
            return None
        try:
            v = Decimal(str(val).replace(",", "."))
        except (InvalidOperation, ValueError):
            raise ValidationError({"angulo_graus": "Ângulo inválido. Ex.: 12,5"})
        if v < Decimal("-360") or v > Decimal("360"):
            raise ValidationError({"angulo_graus": "Informe um valor entre -360 e 360 graus."})
        return v

    def clean(self):
        cleaned = super().clean()
        # valida formato da coordenada se foi informada (mas NÃO obriga)
        self._coordenada = self._parse_lat_lng(cleaned.get("coordenada"))
        return cleaned

    # ----------------- save -----------------
    def save(self, commit=True):
        tumulo = super().save(commit=False)

        if self.cleaned_data.get('quadra'):
            tumulo.cemiterio_id = self.cleaned_data['quadra'].cemiterio_id
        elif self.request and hasattr(self.request, 'cemiterio_ativo'):
            tumulo.cemiterio_id = getattr(self.request.cemiterio_ativo, 'id', None)

        # NÃO grava localizacao aqui: quem usa coordenada é o admin.save_model()
        if commit:
            tumulo.save()
        return tumulo



from django import forms
from .models import Sepultado
from decimal import Decimal

ESTADOS_BRASILEIROS = [
    ('', '---'),
    ('AC', 'Acre'), ('AL', 'Alagoas'), ('AP', 'Amapá'), ('AM', 'Amazonas'),
    ('BA', 'Bahia'), ('CE', 'Ceará'), ('DF', 'Distrito Federal'), ('ES', 'Espírito Santo'),
    ('GO', 'Goiás'), ('MA', 'Maranhão'), ('MT', 'Mato Grosso'), ('MS', 'Mato Grosso do Sul'),
    ('MG', 'Minas Gerais'), ('PA', 'Pará'), ('PB', 'Paraíba'), ('PR', 'Paraná'),
    ('PE', 'Pernambuco'), ('PI', 'Piauí'), ('RJ', 'Rio de Janeiro'), ('RN', 'Rio Grande do Norte'),
    ('RS', 'Rio Grande do Sul'), ('RO', 'Rondônia'), ('RR', 'Roraima'),
    ('SC', 'Santa Catarina'), ('SP', 'São Paulo'), ('SE', 'Sergipe'), ('TO', 'Tocantins'),
]

class SepultadoForm(forms.ModelForm):
    data_nascimento = forms.DateField(
        widget=forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date', 'class': 'vDateField'}),
        input_formats=['%Y-%m-%d', '%d/%m/%Y'],
        required=False,
        label="Data de Nascimento"
    )
    data_falecimento = forms.DateField(
        widget=forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date', 'class': 'vDateField'}),
        input_formats=['%Y-%m-%d', '%d/%m/%Y'],
        required=False,
        label="Data do Falecimento"
    )
    data_sepultamento = forms.DateField(
        widget=forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date', 'class': 'vDateField'}),
        input_formats=['%Y-%m-%d', '%d/%m/%Y'],
        required=False,
        label="Data do Sepultamento"
    )
    cartorio_data_registro = forms.DateField(
        widget=forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date', 'class': 'vDateField'}),
        input_formats=['%Y-%m-%d', '%d/%m/%Y'],
        required=False,
        label="Data do Registro em Cartório"
    )

    hora_falecimento = forms.TimeField(
        required=False,
        label="Hora falecimento",
        widget=forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'vTimeField'}),
    )

    cpf_sepultado = forms.CharField(
        label="CPF do Sepultado",
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': '000.000.000-00',
            'data-mask-cpf-sepultado': 'true'
        })
    )

    cpf_responsavel = forms.CharField(
        label="CPF do Responsável",
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': '000.000.000-00',
            'data-mask-cpf-responsavel': 'true'
        })
    )



    estado = forms.ChoiceField(
        choices=ESTADOS_BRASILEIROS,
        required=False,
        label="Estado (UF)"
    )

    estado_responsavel = forms.ChoiceField(
        choices=ESTADOS_BRASILEIROS,
        required=False,
        label="Estado do Responsável (UF)"
    )

    valor = forms.CharField(
        label="Valor",
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': 'R$ 0,00',
            'data-mask-moeda': 'true'
        })
    )

    quantidade_parcelas = forms.IntegerField(
        label="Quantidade de Parcelas",
        required=False,
        widget=forms.NumberInput(attrs={
            'data-show-if-parcelado': 'true'
        })
    )

    class Meta:
        model = Sepultado
        fields = '__all__'

    def clean_valor(self):
        valor_str = self.cleaned_data.get('valor')
        if valor_str:
            valor_str = valor_str.replace('R$', '').replace('.', '').replace(',', '.').strip()
            try:
                return Decimal(valor_str)
            except:
                raise forms.ValidationError("Valor inválido.")
        return Decimal("0.00")
    
    class Media:
        js = ('custom_admin/js/sexo_outro.js',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Aplica máscara ao CPF do SEPULTADO
        if 'cpf_sepultado' in self.fields:
            self.fields['cpf_sepultado'].widget.attrs.update({
                'data-mask-cpf': 'true',
                'placeholder': '000.000.000-00'
            })

        # Já havia o campo do responsável com CPF mascarado
        if 'cpf_responsavel' in self.fields:
            self.fields['cpf_responsavel'].widget.attrs.update({
                'data-mask-cpf': 'true',
                'placeholder': '000.000.000-00'
            })





from django import forms
from decimal import Decimal, InvalidOperation
from .models import Receita

class ReceitaForm(forms.ModelForm):
    # Força os campos como texto para aceitar entrada "R$ 1.000,00"
    desconto = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': 'R$ 0,00',
            'data-mask-moeda': 'true'
        })
    )
    valor_pago = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': 'R$ 0,00',
            'data-mask-moeda': 'true'
        })
    )

    class Meta:
        model = Receita
        fields = '__all__'

    def clean_desconto(self):
        valor = self.cleaned_data.get('desconto') or '0'
        valor = str(valor).replace('R$', '').replace('.', '').replace(',', '.').strip()
        try:
            return Decimal(valor)
        except InvalidOperation:
            raise forms.ValidationError('Informe um valor numérico válido para o desconto.')

    def clean_valor_pago(self):
        valor = self.cleaned_data.get('valor_pago') or '0'
        valor = str(valor).replace('R$', '').replace('.', '').replace(',', '.').strip()
        try:
            return Decimal(valor)
        except InvalidOperation:
            raise forms.ValidationError('Informe um valor numérico válido para o valor pago.')

from django import forms
from .models import Plano

class PlanoForm(forms.ModelForm):
    preco_mensal = forms.CharField(
        label="Preço mensal",
        widget=forms.TextInput(attrs={
            'data-mask-moeda': 'true',
            'class': 'vTextField',
            'placeholder': 'R$ 0,00'
        })
    )

    class Meta:
        model = Plano
        fields = '__all__'

    def clean_preco_mensal(self):
        valor = self.cleaned_data['preco_mensal']
        valor = valor.replace('R$', '').replace('.', '').replace(',', '.').strip()
        return float(valor)





from decimal import Decimal, InvalidOperation
from django import forms
from django.core.exceptions import ValidationError
from .models import Exumacao, Tumulo

class ExumacaoForm(forms.ModelForm):
    data = forms.DateField(
        widget=forms.DateInput(
            format='%Y-%m-%d',
            attrs={'type': 'date', 'class': 'vDateField'}
        ),
        input_formats=['%Y-%m-%d', '%d/%m/%Y'],
        required=True,
        label="Data"
    )
    valor = forms.CharField(
        label="Valor",
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': 'R$ 0,00',
            'style': 'width: 150px; text-align: right;',
            'data-mask-moeda': 'true'
        })
    )

    class Meta:
        model = Exumacao
        fields = '__all__'
        widgets = {
            'motivo': forms.TextInput(attrs={'placeholder': 'Informe o motivo', 'style': 'width: 260px;'}),
            'observacoes': forms.Textarea(attrs={'rows': 4, 'style': 'width: 400px;'}),
            'quantidade_parcelas': forms.NumberInput(attrs={'style': 'width: 80px;', 'data-show-if-parcelado': 'true'}),
            'valor': forms.TextInput(attrs={'style': 'width: 150px; text-align: right;', 'data-mask-moeda': 'true'}),
            'nome_responsavel': forms.TextInput(attrs={'style': 'width: 260px;'}),
            'cpf': forms.TextInput(attrs={'class': 'cpf', 'data-mask-cpf-cnpj': 'true', 'style': 'width: 260px;'}),
            'endereco': forms.TextInput(attrs={'style': 'width: 260px;'}),
            'telefone': forms.TextInput(attrs={'style': 'width: 260px;'}),
        }

    class Media:
        js = ('custom_admin/js/formulario_exumacao_translado.js',)

    def __init__(self, *args, **kwargs):
        request = kwargs.pop('request', None)
        super().__init__(*args, **kwargs)

        self.fields['sepultado'].widget.attrs.update({
            'class': 'admin-autocomplete',
            'data-autocomplete-light-function': 'select2',
            'style': 'width: 400px;'
        })

        if request and hasattr(request, 'cemiterio_ativo'):
            self.fields['tumulo'].queryset = Tumulo.objects.filter(quadra__cemiterio=request.cemiterio_ativo)
        else:
            self.fields['tumulo'].queryset = Tumulo.objects.none()

        self.fields['tumulo'].widget.attrs.update({'style': 'width: 400px;'})

    def clean(self):
        cleaned_data = super().clean()
        sepultado = cleaned_data.get('sepultado')
        data_exumacao = cleaned_data.get('data')
        tumulo_informado = cleaned_data.get('tumulo')
        forma_pagamento = cleaned_data.get('forma_pagamento')
        valor_raw = cleaned_data.get('valor')

        # Converte valor caso venha com máscara ou texto
        if isinstance(valor_raw, str):
            valor_raw = valor_raw.replace("R$", "").replace(".", "").replace(",", ".").strip()
        try:
            valor = Decimal(valor_raw)
        except (ValueError, TypeError, InvalidOperation):
            raise ValidationError("Informe um valor válido.")

        # Validação de valor com base na forma de pagamento
        if forma_pagamento == 'gratuito' and valor != Decimal("0.00"):
            valor = Decimal("0.00")
        elif forma_pagamento != 'gratuito' and valor <= Decimal("0.00"):
            raise ValidationError("Informe um valor maior que zero para pagamentos não gratuitos.")

        cleaned_data['valor'] = round(valor, 2)

        # Validação de prazo mínimo para exumação
        if sepultado and data_exumacao:
            sepultamento_data = sepultado.data_sepultamento
            if sepultamento_data and sepultado.tumulo:
                cemit = sepultado.tumulo.quadra.cemiterio
                minimo_meses = cemit.tempo_minimo_exumacao or 0
                if (data_exumacao - sepultamento_data).days < minimo_meses * 30:
                    raise ValidationError(
                        f"É necessário aguardar no mínimo {minimo_meses} meses após o sepultamento para realizar a exumação."
                    )

        # Validação do túmulo
        if tumulo_informado and sepultado and sepultado.tumulo and tumulo_informado != sepultado.tumulo:
            raise ValidationError("O túmulo selecionado não corresponde ao túmulo do sepultado.")

        if not tumulo_informado and sepultado and sepultado.tumulo:
            cleaned_data['tumulo'] = sepultado.tumulo

        return cleaned_data

    def clean_valor(self):
        valor_str = self.cleaned_data.get('valor')

        if isinstance(valor_str, str):
            valor_str = valor_str.replace("R$", "").replace(".", "").replace(",", ".").strip()

        try:
            valor = Decimal(valor_str)
        except:
            raise forms.ValidationError("Valor inválido.")

        forma_pagamento = self.cleaned_data.get('forma_pagamento')
        if forma_pagamento == 'gratuito' and valor != Decimal("0.00"):
            raise forms.ValidationError("Exumações gratuitas devem ter valor R$ 0,00.")
        elif forma_pagamento != 'gratuito' and valor <= 0:
            raise forms.ValidationError("Informe um valor maior que zero para exumações pagas.")

        return round(valor, 2)


from decimal import Decimal
from django import forms
from django.core.exceptions import ValidationError
from .models import Translado, Tumulo

class TransladoForm(forms.ModelForm):
    data = forms.DateField(
        widget=forms.DateInput(
            format='%Y-%m-%d',
            attrs={'type': 'date', 'class': 'vDateField'}
        ),
        input_formats=['%Y-%m-%d', '%d/%m/%Y'],
        required=True,
        label="Data"
    )

    valor = forms.CharField(
        label="Valor",
        required=False,
        widget=forms.TextInput(attrs={
            'placeholder': 'R$ 0,00',
            'style': 'width: 150px; text-align: right;',
            'data-mask-moeda': 'true',
        })
    )

    class Meta:
        model = Translado
        fields = '__all__'
        widgets = {
            'motivo': forms.TextInput(attrs={
                'placeholder': 'Informe o motivo',
                'style': 'width: 260px;',
            }),
            'observacoes': forms.Textarea(attrs={
                'rows': 4,
                'style': 'width: 400px;',
            }),
            'cemiterio_nome': forms.TextInput(attrs={
                'placeholder': 'Nome do Cemitério',
                'style': 'width: 300px;',
            }),
            'cemiterio_endereco': forms.TextInput(attrs={
                'placeholder': 'Endereço do Cemitério',
                'style': 'width: 400px;',
            }),
            'quantidade_parcelas': forms.NumberInput(attrs={
                'style': 'width: 80px;',
            }),
            'nome_responsavel': forms.TextInput(attrs={
                'style': 'width: 260px;',
            }),
            'cpf': forms.TextInput(attrs={
                'class': 'cpf',
                'data-mask-cpf-cnpj': 'true',
                'style': 'width: 260px;',
            }),
            'endereco': forms.TextInput(attrs={
                'style': 'width: 260px;',
            }),
            'telefone': forms.TextInput(attrs={
                'style': 'width: 260px;',
            }),
        }

    class Media:
        js = ('custom_admin/js/formulario_exumacao_translado.js',)

    def __init__(self, *args, **kwargs):
        request = kwargs.pop('request', None)
        super().__init__(*args, **kwargs)

        self.fields['tumulo_destino'].widget.attrs.update({
            'class': 'admin-autocomplete',
            'data-autocomplete-light-function': 'select2',
            'style': 'width: 400px;',
        })

        # Corrige o erro de "escolha não disponível"
        if self.instance and self.instance.tumulo_destino:
            self.fields['tumulo_destino'].queryset = Tumulo.objects.filter(pk=self.instance.tumulo_destino.pk)
        elif 'tumulo_destino' in self.data:
            try:
                pk = int(self.data.get('tumulo_destino'))
                self.fields['tumulo_destino'].queryset = Tumulo.objects.filter(pk=pk)
            except (ValueError, TypeError):
                self.fields['tumulo_destino'].queryset = Tumulo.objects.none()
        elif request and hasattr(request, 'cemiterio_ativo'):
            self.fields['tumulo_destino'].queryset = Tumulo.objects.filter(quadra__cemiterio=request.cemiterio_ativo)
        else:
            self.fields['tumulo_destino'].queryset = Tumulo.objects.none()

    def clean_valor(self):
        valor_str = self.cleaned_data.get('valor')
        forma_pagamento = self.cleaned_data.get('forma_pagamento')

        if isinstance(valor_str, str):
            valor_str = valor_str.replace("R$", "").replace(".", "").replace(",", ".").strip()

        try:
            valor = Decimal(valor_str)
        except (ValueError, TypeError, ArithmeticError):
            raise ValidationError("Informe um valor válido.")

        if forma_pagamento == 'gratuito' and valor != Decimal("0.00"):
            raise ValidationError("Traslados gratuitos devem ter valor R$ 0,00.")
        elif forma_pagamento != 'gratuito' and valor <= Decimal("0.00"):
            raise ValidationError("Informe um valor maior que zero para traslados pagos.")

        return round(valor, 2)

    def clean(self):
        cleaned_data = super().clean()
        destino = cleaned_data.get("destino")
        tumulo_destino = cleaned_data.get("tumulo_destino")

        from .models import ConcessaoContrato

        if destino == "outro_tumulo":
            if not tumulo_destino:
                raise ValidationError("Você deve selecionar um túmulo de destino.")

            contrato_existe = ConcessaoContrato.objects.filter(tumulo=tumulo_destino).exists()
            if not contrato_existe:
                raise ValidationError({
                    'tumulo_destino': "Este túmulo não possui contrato de concessão. A transferência não é permitida."
                })

# IMPORTAÇÃO DE DADOS POR PLANILHA
import csv
import io

from django import forms
from django.core.exceptions import ValidationError

class ImportarPlanilhaForm(forms.Form):
    arquivo = forms.FileField(
        label="Selecione um arquivo CSV ou XLSX",
        help_text="Somente arquivos .csv ou .xlsx são aceitos.",
    )

    def clean_arquivo(self):
        arquivo = self.cleaned_data.get("arquivo")
        if not arquivo:
            raise ValidationError("Você deve selecionar um arquivo.")

        extensao = arquivo.name.split(".")[-1].lower()
        if extensao not in ["csv", "xls", "xlsx"]:
            raise ValidationError("Formato de arquivo inválido. Use CSV ou Excel.")

        return arquivo
