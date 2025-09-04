    # sepultados_gestao/views_api.py
from datetime import date
import uuid
import base64

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import send_mail
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Anexo
from .serializers import AnexoSerializer
from django.contrib.contenttypes.models import ContentType

from rest_framework import mixins
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError, PermissionDenied


from .models import (
    Prefeitura,
    Cemiterio,
    ConcessaoContrato,
    Exumacao,
    Quadra,
    Receita,
    RegistroAuditoria,
    Sepultado,
    Translado,
    Tumulo,
    EmailConfirmacao,
    CadastroPrefeituraPendente,
    Plano,
    Licenca,
)
from .serializers import (
    PrefeituraSerializer,
    PlanoSerializer,
    CemiterioSerializer,
    ConcessaoContratoSerializer,
    ExumacaoSerializer,
    QuadraSerializer,
    ReceitaSerializer,
    RegistroAuditoriaSerializer,
    SepultadoSerializer,
    TransladoSerializer,
    TumuloSerializer,
)

# Tenta importar a função que gera o PDF do túmulo (ajuste o caminho se necessário)
try:
    # Ex.: arquivo sepultados_gestao/relatorios/tumulo.py com função build_tumulo_pdf(tumulo) -> bytes
    from .relatorios.tumulo import build_tumulo_pdf  # <-- AJUSTE se o caminho for outro
except Exception:
    build_tumulo_pdf = None


# ===========================
# MIXINS DE FILTRAGEM
# ===========================
class PrefeituraRestritaQuerysetMixin:
    """
    - Se existir request.prefeitura_ativa, usa ela.
    - Caso contrário, aceita ?prefeitura=<id> na querystring.
    - Se nada disso existir, retorna queryset vazio.
    """
    prefeitura_field = "prefeitura"  # nome do campo FK para Prefeitura

    def get_queryset(self):
        qs = self.queryset
        req = self.request

        if not req.user.is_authenticated:
            return qs.none()

        pref = getattr(req, "prefeitura_ativa", None)
        if not pref:
            pref_id = req.query_params.get("prefeitura")
            if pref_id:
                pref = Prefeitura.objects.filter(pk=pref_id).first()

        if not pref:
            return qs.none()

        # aceita objeto ou id; se seu campo for *_id, troque para f"{self.prefeitura_field}_id"
        return qs.filter(**{self.prefeitura_field: pref})


class ContextoRestritoQuerysetMixin:
    """
    Filtra por cemitério (se informado `cemiterio_field` e houver `cemiterio` na query/sessão)
    ou então por prefeitura (se informado `prefeitura_field`).
    Se nada disso existir, retorna vazio.
    """
    cemiterio_field = None       # ex.: "cemiterio", "quadra__cemiterio"
    prefeitura_field = None      # ex.: "prefeitura", "cemiterio__prefeitura"

    def get_queryset(self):
        qs = self.queryset
        req = self.request

        if not req.user.is_authenticated:
            return qs.none()

        cem_id = req.query_params.get("cemiterio") or req.session.get("cemiterio_ativo")

        pref_id = req.query_params.get("prefeitura")
        if not pref_id:
            pref = getattr(req, "prefeitura_ativa", None)
            pref_id = getattr(pref, "id", None) if pref else None

        if cem_id and self.cemiterio_field:
            return qs.filter(**{self.cemiterio_field: cem_id})

        if pref_id and self.prefeitura_field:
            return qs.filter(**{self.prefeitura_field: pref_id})

        return qs.none()


# imports no topo do arquivo
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny

class CemiterioViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ModelViewSet):
    queryset = Cemiterio.objects.all()
    serializer_class = CemiterioSerializer
    prefeitura_field = "prefeitura"
    permission_classes = [IsAuthenticated]

    # <- apenas o retrieve (GET /api/cemiterios/<id>/) fica público; o resto continua exigindo login
    def get_permissions(self):
        if getattr(self, "action", None) == "retrieve":
            return [AllowAny()]
        return [IsAuthenticated()]

    # <- para retrieve, não aplicamos a restrição de prefeitura_ativa, senão dá 404 mesmo público
    def get_queryset(self):
        if getattr(self, "action", None) == "retrieve":
            # DRF ainda aplica o filtro por pk na hora de buscar o objeto
            return Cemiterio.objects.all()

        if getattr(self, "action", None) == "list":
            # se quiser listar por prefeitura via querystring (sem sessão)
            pref_id = self.request.query_params.get("prefeitura")
            if pref_id:
                return Cemiterio.objects.filter(prefeitura_id=pref_id)

        # para criar/alterar/excluir (ou list sem prefeitura), segue a regra do mixin (usuário logado)
        return super().get_queryset()

    def perform_create(self, serializer):
        pref = getattr(self.request, "prefeitura_ativa", None)
        if not pref:
            pref_id = self.request.query_params.get("prefeitura")
            if pref_id:
                pref = Prefeitura.objects.filter(pk=pref_id).first()
        serializer.save(prefeitura=pref)



# views_api.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny

class QuadraViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Quadra.objects.all()
    serializer_class = QuadraSerializer
    cemiterio_field = "cemiterio"
    prefeitura_field = "cemiterio__prefeitura"

    # 🔓 Leitura pública; gravação exige login
    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        cid = self.request.query_params.get("cemiterio")
        if cid:
            qs = qs.filter(cemiterio_id=cid)
        return qs

    def perform_create(self, serializer):
        cid = self.request.data.get("cemiterio") or self.request.query_params.get("cemiterio")
        serializer.save(cemiterio_id=cid)





from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.db.models import Exists, OuterRef, Subquery

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# MODELOS / SERIALIZERS
from .models import Tumulo, ConcessaoContrato  # <— garante o import do contrato
from .serializers import TumuloSerializer

# mesma view de PDF usada no admin (views.py)
from .views import gerar_pdf_sepultados_tumulo as pdf_view


class TumuloViewSet(viewsets.ModelViewSet):
    """
    ViewSet dos Túmulos com:
      - filtro por quadra/cemitério/prefeitura (via querystring ou sessão)
      - anotação de informações de contrato (tem_contrato_ativo / id / numero)
      - action GET /api/tumulos/<id>/pdf_sepultados/ para abrir o mesmo PDF do admin
    """
    queryset = Tumulo.objects.all()
    serializer_class = TumuloSerializer
    permission_classes = [IsAuthenticated]

    # campos relacionais para facilitar filtros
    _cemiterio_field = "quadra__cemiterio_id"
    _prefeitura_field = "quadra__cemiterio__prefeitura_id"

    # ----------------- utils -----------------
    def _to_int(self, v):
        try:
            return int(v)
        except Exception:
            return None

    def _context_ids(self, request):
        """
        Coleta ids de contexto; querystring tem prioridade sobre sessão.
        Suporta as duas chaves de sessão que você usa: cemiterio_ativo e cemiterio_ativo_id.
        """
        pref_qs   = request.query_params.get("prefeitura")  or request.query_params.get("prefeitura_id")
        cem_qs    = request.query_params.get("cemiterio")   or request.query_params.get("cemiterio_id")
        quadra_qs = request.query_params.get("quadra")      or request.query_params.get("quadra_id")

        pref_sess = request.session.get("prefeitura_ativa_id")
        cem_sess  = request.session.get("cemiterio_ativo") or request.session.get("cemiterio_ativo_id")

        pref_id   = self._to_int(pref_qs)   or self._to_int(pref_sess)
        cem_id    = self._to_int(cem_qs)    or self._to_int(cem_sess)
        quadra_id = self._to_int(quadra_qs)

        return pref_id, cem_id, quadra_id

    # ----------------- queryset -----------------
    def get_queryset(self):
        qs = super().get_queryset().select_related("quadra", "quadra__cemiterio")

        if not self.request.user.is_authenticated:
            return qs.none()

        pref_id, cem_id, quadra_id = self._context_ids(self.request)

        # Prioridade: quadra > cemitério > prefeitura
        if quadra_id:
            qs = qs.filter(quadra_id=quadra_id)
        elif cem_id:
            qs = qs.filter(**{self._cemiterio_field: cem_id})
        elif pref_id:
            qs = qs.filter(**{self._prefeitura_field: pref_id})
        else:
            # sem contexto, não retorna nada
            return qs.none()

        # Anota se há contrato e pega o 1º contrato (id / numero) para listar
        contrato_qs = ConcessaoContrato.objects.filter(tumulo_id=OuterRef("pk")).order_by("-id")
        qs = qs.annotate(
            tem_contrato_ativo=Exists(contrato_qs),
            contrato_id=Subquery(contrato_qs.values("id")[:1]),
            # ajuste o nome do campo abaixo se no seu modelo for diferente de "numero_contrato"
            contrato_numero=Subquery(contrato_qs.values("numero_contrato")[:1]),
        )

        return qs

    # ----------------- actions -----------------
    @action(detail=True, methods=["get"], url_path="pdf_sepultados")
    def pdf_sepultados(self, request, pk=None):
        """
        Abre o mesmo PDF do admin.
        Ex.: GET /api/tumulos/<id>/pdf_sepultados/?cemiterio=<id>&prefeitura=<id>
        """
        tumulo = get_object_or_404(
            Tumulo.objects.select_related("quadra", "quadra__cemiterio"), pk=pk
        )

        pref_id, cem_id, _ = self._context_ids(request)

        # checagens de escopo/segurança por contexto
        if cem_id and str(tumulo.quadra.cemiterio_id) != str(cem_id):
            return Response({"detail": "Acesso negado para este túmulo (cemitério)."}, status=403)
        if pref_id and str(tumulo.quadra.cemiterio.prefeitura_id) != str(pref_id):
            return Response({"detail": "Acesso negado para este túmulo (prefeitura)."}, status=403)

        # chama a mesma view que o admin usa
        try:
            return pdf_view(request._request, tumulo_pk=tumulo.pk)
        except TypeError:
            try:
                return pdf_view(request._request, pk=tumulo.pk)
            except TypeError:
                try:
                    return pdf_view(request._request, id=tumulo.pk)
                except TypeError as e:
                    return Response(
                        {"detail": f"Assinatura inesperada da view de PDF: {e}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
        except Exception as e:
            return Response({"detail": f"Erro ao gerar PDF: {e}"}, status=500)


# views_api.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.authentication import JWTAuthentication

from .views import gerar_guia_sepultamento_pdf  # <- função correta do views.py

class SepultadoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Sepultado.objects.all()
    serializer_class = SepultadoSerializer
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .select_related("tumulo", "tumulo__quadra", "tumulo__quadra__cemiterio")
            .order_by("-data_sepultamento", "-id")
        )
        # filtro específico do túmulo passado na query (?tumulo=ID)
        tumulo_id = self.request.query_params.get("tumulo")
        if tumulo_id:
            qs = qs.filter(tumulo_id=tumulo_id)
        return qs

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """
        /api/sepultados/<id>/pdf/?cemiterio=<id>
        Gera a mesma 'Guia de Sepultamento' usada no admin.
        """
        sep = get_object_or_404(Sepultado, pk=pk)

        # a função do seu views.py aceita 'pk'
        try:
            return gerar_guia_sepultamento_pdf(request._request, pk=sep.pk)
        except TypeError:
            # fallback caso em algum ambiente ela espere outro nome de argumento
            return gerar_guia_sepultamento_pdf(request._request, sepultado_pk=sep.pk)




from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response


from .mixins import ContextoRestritoQuerysetMixin
from .models import ConcessaoContrato
from .serializers import ConcessaoContratoSerializer


class ConcessaoContratoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    """
    API de Contratos de Concessão, restrita por cemitério/prefeitura via querystring.
    Endpoints extra:
      GET /api/contratos/<id>/pdf/
      GET /api/contratos/<id>/relatorio_pdf/  (alias)
      GET /api/contratos/<id>/report/         (alias)
    """
    queryset = ConcessaoContrato.objects.all()
    serializer_class = ConcessaoContratoSerializer

    # usados pelo mixin de contexto
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"

    permission_classes = [IsAuthenticated]

    # ----------------- helpers -----------------
    def _prefeitura_from_request_or_tumulo(self, validated_data):
        pref = getattr(self.request, "prefeitura_ativa", None) or getattr(
            self.request.user, "prefeitura", None
        )
        if pref:
            return pref
        tumulo = validated_data.get("tumulo")
        if tumulo and getattr(tumulo, "quadra", None) and getattr(tumulo.quadra, "cemiterio", None):
            return tumulo.quadra.cemiterio.prefeitura
        return None

    # ----------------- CRUD -----------------
    def perform_create(self, serializer):
        validated = dict(serializer.validated_data)
        pref = self._prefeitura_from_request_or_tumulo(validated)
        if not pref:
            raise ValidationError({"detail": "Não foi possível determinar a prefeitura para este contrato."})

        instance = ConcessaoContrato(**validated)
        instance.prefeitura = pref
        instance.usuario_registro = self.request.user

        try:
            instance.full_clean()
            with transaction.atomic():
                instance.save()
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict or {"detail": e.messages})

        serializer.instance = instance

    def perform_update(self, serializer):
        instance = self.get_object()
        validated = dict(serializer.validated_data)
        pref = self._prefeitura_from_request_or_tumulo(validated)
        if not pref:
            raise ValidationError({"detail": "Não foi possível determinar a prefeitura para este contrato."})

        for k, v in validated.items():
            setattr(instance, k, v)
        instance.prefeitura = pref
        instance.usuario_registro = self.request.user

        try:
            instance.full_clean()
            with transaction.atomic():
                instance.save()
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict or {"detail": e.messages})

    def perform_destroy(self, instance):
        try:
            with transaction.atomic():
                instance.delete()
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict or {"detail": e.messages})

    # ----------------- PDF -----------------
    # views_api.py (dentro de ConcessaoContratoViewSet)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """
        GET /api/contratos/<id>/pdf/?cemiterio=<id>

        - Injeta prefeitura/cemitério na sessão (usado pela sua gerar_contrato_pdf)
        - Desembrulha decoradores e chama com a assinatura correta (contrato_id)
        """
        # pegamos o contrato já com relações necessárias
        contrato = get_object_or_404(
            ConcessaoContrato.objects.select_related(
                "prefeitura", "tumulo__quadra__cemiterio"
            ),
            pk=pk,
        )

        http_request = getattr(request, "_request", request)

        # garante o mesmo usuário na view clássica
        try:
            http_request.user = request.user
        except Exception:
            pass

        # >>>>>> AQUI: preenche a sessão que a sua view exige <<<<<<
        try:
            if hasattr(http_request, "session"):
                # prefeitura ativa usada pela gerar_contrato_pdf
                http_request.session["prefeitura_ativa_id"] = contrato.prefeitura_id
                http_request.session["prefeitura_ativa_nome"] = getattr(
                    getattr(contrato, "prefeitura", None), "nome", ""
                )

                # cemitério ativo (se vier na query, prioriza ele; senão usa do contrato)
                cem_id = request.query_params.get("cemiterio") or getattr(
                    getattr(getattr(contrato, "tumulo", None), "quadra", None)
                    .cemiterio if getattr(getattr(contrato, "tumulo", None), "quadra", None) else None,
                    "id",
                    None,
                )
                cem_nome = getattr(
                    getattr(getattr(contrato, "tumulo", None), "quadra", None)
                    .cemiterio if getattr(getattr(contrato, "tumulo", None), "quadra", None) else None,
                    "nome",
                    "",
                )
                if cem_id:
                    http_request.session["cemiterio_ativo_id"] = int(cem_id)
                    http_request.session["cemiterio_ativo_nome"] = cem_nome
        except Exception:
            pass

        # importa sua função real
        try:
            from .views import gerar_contrato_pdf as raw_view
        except Exception:
            return Response(
                {"detail": "Função gerar_contrato_pdf não encontrada em sepultados_gestao.views."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # remove decoradores (login_required / staff_member_required)
        func = raw_view
        for _ in range(5):
            wrapped = getattr(func, "__wrapped__", None)
            if not wrapped:
                break
            func = wrapped

        # chama com a assinatura que você usa: contrato_id
        try:
            return func(http_request, contrato_id=contrato.pk)
        except TypeError:
            # fallbacks comuns, se no futuro mudar
            for kwargs in ({"pk": contrato.pk}, {"contrato_pk": contrato.pk}, {}):
                try:
                    return func(http_request, **kwargs)
                except TypeError:
                    continue

        return Response(
            {"detail": "View de PDF encontrada, mas a assinatura não foi reconhecida."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    @action(detail=True, methods=["get"], url_path="relatorio_pdf")
    def relatorio_pdf(self, request, pk=None):
        return self.pdf(request, pk)

    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        return self.pdf(request, pk)


from datetime import date
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from sepultados_gestao.services.arquivamento import sync_sepultado_status

class ExumacaoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    queryset = Exumacao.objects.all().select_related(
        "sepultado", "tumulo", "tumulo__quadra", "tumulo__quadra__cemiterio"
    )
    serializer_class = ExumacaoSerializer
    cemiterio_field = "tumulo__quadra__cemiterio"
    prefeitura_field = "tumulo__quadra__cemiterio__prefeitura"
    permission_classes = [IsAuthenticated]

    def _prefeitura_from_request_or_relations(self, validated):
        pref = getattr(self.request, "prefeitura_ativa", None) or getattr(self.request.user, "prefeitura", None)
        if pref:
            return pref
        tum = validated.get("tumulo")
        if tum and getattr(tum, "quadra", None) and getattr(tum.quadra, "cemiterio", None):
            return tum.quadra.cemiterio.prefeitura
        sep = validated.get("sepultado")
        if sep and getattr(sep, "tumulo", None) and getattr(sep.tumulo, "quadra", None):
            return sep.tumulo.quadra.cemiterio.prefeitura
        return None

    # também lista por cemitério do sepultado se necessário
    def get_queryset(self):
        qs = super().get_queryset()
        cem = self.request.query_params.get("cemiterio")
        if cem:
            qs = qs.filter(
                Q(tumulo__quadra__cemiterio_id=cem) |
                Q(sepultado__tumulo__quadra__cemiterio_id=cem)
            )
        return qs

    def _normalize_validated(self, validated):
        # herda tumulo do sepultado se não veio
        sep = validated.get("sepultado")
        if not validated.get("tumulo") and sep and getattr(sep, "tumulo", None):
            validated["tumulo"] = sep.tumulo

        # limpa hífen de número de documento
        nd = validated.get("numero_documento")
        if nd == "-" or nd == "":
            validated.pop("numero_documento", None)

        return validated

    def perform_create(self, serializer):
        validated = self._normalize_validated(dict(serializer.validated_data))
        pref = self._prefeitura_from_request_or_relations(validated)
        if not pref:
            raise ValidationError({"detail": "Não foi possível determinar a prefeitura."})

        instance = Exumacao(**validated)
        instance.prefeitura = pref
        instance.usuario_registro = self.request.user

        # default para data, se o model exigir
        if getattr(instance, "data", None) in (None, ""):
            try:
                instance._meta.get_field("data")  # só se o campo existir
                instance.data = date.today()
            except Exception:
                pass

        try:
            instance.full_clean()
            with transaction.atomic():
                instance.save()
        except DjangoValidationError as e:
            payload = {}

            # 1) Dict por campo (ex.: {"data": ["..."], "__all__": ["..."]})
            if getattr(e, "message_dict", None):
                payload = dict(e.message_dict)

            # 2) "__all__" -> non_field_errors
            if "__all__" in payload:
                msgs = payload.pop("__all__") or []
                if not isinstance(msgs, (list, tuple)):
                    msgs = [msgs]
                payload.setdefault("non_field_errors", [])
                payload["non_field_errors"].extend(msgs)

            # 3) lista simples -> non_field_errors
            if not payload and getattr(e, "messages", None):
                msgs = e.messages
                if not isinstance(msgs, (list, tuple)):
                    msgs = [msgs]
                payload = {"non_field_errors": msgs}

            # 4) default se vazio
            if not payload:
                payload = {"non_field_errors": ["Não foi possível validar a exumação."]}

            # 5) Se ficou genérica, calcula e injeta "faltam X dia(s)"
            try:
                gen_texts = (
                    "Não foi possível validar a data da exumação",
                    "Nao foi possivel validar a data da exumacao",
                )
                has_generic = any(any(gt in str(m) for gt in gen_texts)
                                  for m in payload.get("non_field_errors", []))

                sep = validated.get("sepultado")
                tum = validated.get("tumulo") or (getattr(sep, "tumulo", None) if sep else None)
                cem = getattr(getattr(tum, "quadra", None), "cemiterio", None) if tum else None
                meses = int(getattr(cem, "tempo_minimo_exumacao", 0) or 0)
                dt_sep = getattr(sep, "data_sepultamento", None) if sep else None
                dt_exu = validated.get("data")

                if meses and dt_sep and dt_exu:
                    if hasattr(dt_sep, "date"):
                        dt_sep = dt_sep.date()
                    if hasattr(dt_exu, "date"):
                        dt_exu = dt_exu.date()

                    from calendar import monthrange
                    from datetime import date as _date

                    def _add_months(d: _date, m: int) -> _date:
                        y = d.year + (d.month - 1 + m) // 12
                        mo = (d.month - 1 + m) % 12 + 1
                        day = min(d.day, monthrange(y, mo)[1])
                        return _date(y, mo, day)

                    data_min = _add_months(dt_sep, meses)
                    if dt_exu < data_min:
                        faltam = (data_min - dt_exu).days
                        claro = f"Exumação só é permitida após {meses} mês(es) do sepultamento. Faltam {faltam} dia(s)."
                        payload.setdefault("data", []).append(claro)
                        payload.setdefault("non_field_errors", []).append(claro)
                        # remove genérica, se presente
                        payload["non_field_errors"] = [
                            m for m in payload["non_field_errors"]
                            if not any(gt in str(m) for gt in gen_texts)
                        ]
            except Exception:
                pass

            raise ValidationError(payload)

    def perform_update(self, serializer):
        instance = self.get_object()
        validated = self._normalize_validated(dict(serializer.validated_data))
        pref = self._prefeitura_from_request_or_relations(validated)
        if not pref:
            raise ValidationError({"detail": "Não foi possível determinar a prefeitura."})

        for k, v in validated.items():
            setattr(instance, k, v)
        instance.prefeitura = pref
        instance.usuario_registro = self.request.user

        if getattr(instance, "data", None) in (None, ""):
            try:
                instance._meta.get_field("data")
                instance.data = date.today()
            except Exception:
                pass

        try:
            instance.full_clean()
            with transaction.atomic():
                instance.save()
        except DjangoValidationError as e:
            payload = {}

            # 1) Dict por campo
            if getattr(e, "message_dict", None):
                payload = dict(e.message_dict)

            # 2) "__all__" -> non_field_errors
            if "__all__" in payload:
                msgs = payload.pop("__all__") or []
                if not isinstance(msgs, (list, tuple)):
                    msgs = [msgs]
                payload.setdefault("non_field_errors", [])
                payload["non_field_errors"].extend(msgs)

            # 3) lista simples -> non_field_errors
            if not payload and getattr(e, "messages", None):
                msgs = e.messages
                if not isinstance(msgs, (list, tuple)):
                    msgs = [msgs]
                payload = {"non_field_errors": msgs}

            # 4) default se vazio
            if not payload:
                payload = {"non_field_errors": ["Não foi possível validar a exumação."]}

            # 5) Se ficou genérica, calcula e injeta "faltam X dia(s)"
            try:
                gen_texts = (
                    "Não foi possível validar a data da exumação",
                    "Nao foi possivel validar a data da exumacao",
                )
                has_generic = any(any(gt in str(m) for gt in gen_texts)
                                  for m in payload.get("non_field_errors", []))

                sep = validated.get("sepultado")
                tum = validated.get("tumulo") or (getattr(sep, "tumulo", None) if sep else None)
                cem = getattr(getattr(tum, "quadra", None), "cemiterio", None) if tum else None
                meses = int(getattr(cem, "tempo_minimo_exumacao", 0) or 0)
                dt_sep = getattr(sep, "data_sepultamento", None) if sep else None
                dt_exu = validated.get("data")

                if meses and dt_sep and dt_exu:
                    if hasattr(dt_sep, "date"):
                        dt_sep = dt_sep.date()
                    if hasattr(dt_exu, "date"):
                        dt_exu = dt_exu.date()

                    from calendar import monthrange
                    from datetime import date as _date

                    def _add_months(d: _date, m: int) -> _date:
                        y = d.year + (d.month - 1 + m) // 12
                        mo = (d.month - 1 + m) % 12 + 1
                        day = min(d.day, monthrange(y, mo)[1])
                        return _date(y, mo, day)

                    data_min = _add_months(dt_sep, meses)
                    if dt_exu < data_min:
                        faltam = (data_min - dt_exu).days
                        claro = f"Exumação só é permitida após {meses} mês(es) do sepultamento. Faltam {faltam} dia(s)."
                        payload.setdefault("data", []).append(claro)
                        payload.setdefault("non_field_errors", []).append(claro)
                        payload["non_field_errors"] = [
                            m for m in payload["non_field_errors"]
                            if not any(gt in str(m) for gt in gen_texts)
                        ]
            except Exception:
                pass

            raise ValidationError(payload)

    def perform_destroy(self, instance):
        sep = instance.sepultado
        with transaction.atomic():
            super().perform_destroy(instance)
            sync_sepultado_status(sep)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        # Busca a exumação (e garante permissão via queryset do ViewSet)
        exumacao = get_object_or_404(Exumacao, pk=pk)

        # Importa a view que já gera o PDF no admin
        from .views import pdf_exumacao as raw_view

        # Desencapsula decoradores (ex.: @staff_member_required), se houver
        func = raw_view
        for _ in range(5):
            wrapped = getattr(func, "__wrapped__", None)
            if not wrapped:
                break
            func = wrapped

        # Chama com a assinatura esperada; fallback para variações
        http_request = request._request
        try:
            return func(http_request, pk=exumacao.pk)
        except TypeError:
            try:
                return func(http_request, id=exumacao.pk)
            except TypeError:
                return func(http_request, exumacao_pk=exumacao.pk)

    @action(detail=True, methods=["get"], url_path="relatorio_pdf")
    def relatorio_pdf(self, request, pk=None):
        return self.pdf(request, pk)

    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        return self.pdf(request, pk)



from datetime import date
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError, FieldError
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.http import HttpResponse
from django.template.loader import render_to_string
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from weasyprint import HTML
from django.conf import settings
import os

from .models import Translado, Sepultado
from .serializers import TransladoSerializer
from sepultados_gestao.services.arquivamento import sync_sepultado_status
from .mixins import ContextoRestritoQuerysetMixin


class TransladoViewSet(ContextoRestritoQuerysetMixin, viewsets.ModelViewSet):
    """
    - Lista por CEMITÉRIO do túmulo ATUAL do sepultado OU do TÚMULO DE DESTINO.
    - Gera PDF em: /api/traslados/<id>/pdf/ (aliases: /relatorio_pdf/ e /report/)
    """
    queryset = Translado.objects.all()
    serializer_class = TransladoSerializer
    cemiterio_field = "tumulo_destino__quadra__cemiterio"
    prefeitura_field = "tumulo_destino__quadra__cemiterio__prefeitura"
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    # -------------------- Queryset / Filtros --------------------
    def get_queryset(self):
        qs = self.queryset.select_related(
            "sepultado__tumulo__quadra__cemiterio__prefeitura",
            "tumulo_destino__quadra__cemiterio__prefeitura",
        )

        req = self.request
        cem_id = (
            req.query_params.get("cemiterio")
            or req.query_params.get("cemiterio_id")
            or req.session.get("cemiterio_ativo_id")
            or req.session.get("cemiterio_ativo")
        )
        if cem_id:
            return qs.filter(
                Q(sepultado__tumulo__quadra__cemiterio_id=cem_id) |
                Q(tumulo_destino__quadra__cemiterio_id=cem_id)
            ).order_by("-data", "-id")

        pref_id = (
            req.query_params.get("prefeitura")
            or getattr(getattr(req, "prefeitura_ativa", None), "id", None)
        )
        if pref_id:
            return qs.filter(
                Q(sepultado__tumulo__quadra__cemiterio__prefeitura_id=pref_id) |
                Q(tumulo_destino__quadra__cemiterio__prefeitura_id=pref_id)
            ).order_by("-data", "-id")

        return qs.none()

    # -------------------- Helpers --------------------
    def _normalize_validated(self, validated):
        nd = validated.get("numero_documento")
        if nd == "-" or nd == "":
            validated.pop("numero_documento", None)
        return validated

    def _ativos_no_tumulo(self, tumulo):
        """
        Ocupantes *ativos* no túmulo (exumado=False e, se existir,
        trasladado=False).
        """
        if not tumulo:
            return 0
        qs = Sepultado.objects.filter(tumulo=tumulo, exumado=False)
        try:
            qs = qs.filter(trasladado=False)
        except FieldError:
            pass
        return qs.count()

    def _checar_capacidade_destino(self, destino, sepultado=None):
        """
        Valida a capacidade do destino considerando apenas ativos.
        Se o próprio 'sepultado' já estiver nesse destino, não soma +1.
        """
        if not destino:
            return
        cap = getattr(destino, "capacidade", None)
        if cap is None:
            return

        ativos = self._ativos_no_tumulo(destino)
        extra = 0
        if sepultado is None or sepultado.tumulo_id != getattr(destino, "id", None):
            extra = 1

        if (ativos + extra) > cap:
            raise ValidationError({
                "tumulo_destino": [
                    f"O túmulo de destino atingiu sua capacidade máxima de {cap} sepultado(s)."
                ]
            })

    def _mover_sepultado_para_destino(self, translado: Translado):
        """
        Efeito do translado: coloca o sepultado no tumulo_destino
        e preenche campos usuais, se existirem.
        """
        s = translado.sepultado
        d = translado.tumulo_destino
        if not s or not d:
            return

        fields = []

        if getattr(s, "tumulo_id", None) != getattr(d, "id", None):
            s.tumulo = d
            fields.append("tumulo")

        # Se o modelo tiver esses campos, mantém atualizado:
        if hasattr(s, "trasladado"):
            if s.trasladado is not True:
                s.trasladado = True
                fields.append("trasladado")

        if hasattr(s, "data_translado") and getattr(translado, "data", None):
            if s.data_translado != translado.data:
                s.data_translado = translado.data
                fields.append("data_translado")

        if fields:
            s.save(update_fields=list(set(fields)))

    def _render_pdf(self, translado):
        """Gera o PDF (usa prefeitura do destino; se não houver, da origem)."""
        prefeitura = (
            getattr(getattr(getattr(translado, "tumulo_destino", None), "quadra", None), "cemiterio", None)
            and translado.tumulo_destino.quadra.cemiterio.prefeitura
        ) or (translado.sepultado and translado.sepultado.tumulo
              and translado.sepultado.tumulo.quadra.cemiterio.prefeitura)

        brasao_path = ""
        if prefeitura and getattr(prefeitura, "brasao", None):
            brasao_absoluto = os.path.join(settings.MEDIA_ROOT, prefeitura.brasao.name)
            brasao_path = f"file:///{brasao_absoluto.replace(os.sep, '/')}"

        html = render_to_string("pdf/translado.html", {
            "movimentacao": translado,
            "brasao_path": brasao_path,
        })
        return HTML(string=html).write_pdf()

    # -------------------- Create / Update / Delete --------------------
    def perform_create(self, serializer):
        validated = self._normalize_validated(dict(serializer.validated_data))
        destino = validated.get("tumulo_destino")
        sep = validated.get("sepultado")

        # Apenas garante capacidade (não há regra de tempo mínimo aqui)
        self._checar_capacidade_destino(destino, sepultado=sep)

        instance = Translado(**validated)
        instance.usuario_registro = self.request.user

        if getattr(instance, "data", None) in (None, ""):
            try:
                instance._meta.get_field("data")
                instance.data = date.today()
            except Exception:
                pass

        try:
            with transaction.atomic():
                instance.full_clean()
                instance.save()
                # move efetivamente o sepultado
                self._mover_sepultado_para_destino(instance)
                if instance.sepultado_id:
                    sync_sepultado_status(instance.sepultado)
        except DjangoValidationError as e:
            payload = {}
            if getattr(e, "message_dict", None):
                payload = dict(e.message_dict)
            if "__all__" in payload:
                msgs = payload.pop("__all__") or []
                if not isinstance(msgs, (list, tuple)):
                    msgs = [msgs]
                payload.setdefault("non_field_errors", [])
                payload["non_field_errors"].extend(msgs)
            if not payload and getattr(e, "messages", None):
                msgs = e.messages
                if not isinstance(msgs, (list, tuple)):
                    msgs = [msgs]
                payload = {"non_field_errors": msgs}
            if not payload:
                payload = {"non_field_errors": ["Não foi possível validar o traslado."]}
            raise ValidationError(payload)

        serializer.instance = instance

    def perform_update(self, serializer):
        instance = self.get_object()
        validated = self._normalize_validated(dict(serializer.validated_data))
        destino = validated.get("tumulo_destino") or instance.tumulo_destino
        sep = validated.get("sepultado") or instance.sepultado

        self._checar_capacidade_destino(destino, sepultado=sep)

        for k, v in validated.items():
            setattr(instance, k, v)
        instance.usuario_registro = self.request.user

        if getattr(instance, "data", None) in (None, ""):
            try:
                instance._meta.get_field("data")
                instance.data = date.today()
            except Exception:
                pass

        try:
            with transaction.atomic():
                instance.full_clean()
                instance.save()
                self._mover_sepultado_para_destino(instance)
                if instance.sepultado_id:
                    sync_sepultado_status(instance.sepultado)
        except DjangoValidationError as e:
            payload = {}
            if getattr(e, "message_dict", None):
                payload = dict(e.message_dict)
            if "__all__" in payload:
                msgs = payload.pop("__all__") or []
                if not isinstance(msgs, (list, tuple)):
                    msgs = [msgs]
                payload.setdefault("non_field_errors", [])
                payload["non_field_errors"].extend(msgs)
            if not payload and getattr(e, "messages", None):
                msgs = e.messages
                if not isinstance(msgs, (list, tuple)):
                    msgs = [msgs]
                payload = {"non_field_errors": msgs}
            if not payload:
                payload = {"non_field_errors": ["Não foi possível validar o traslado."]}
            raise ValidationError(payload)

    def perform_destroy(self, instance):
        sep = instance.sepultado
        with transaction.atomic():
            super().perform_destroy(instance)
            # Recalcula flags; (não tentamos "desmover" automaticamente)
            if sep:
                sync_sepultado_status(sep)

    # -------------------- Actions (PDF) --------------------
    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        translado = get_object_or_404(
            Translado.objects.select_related(
                "sepultado__tumulo__quadra__cemiterio__prefeitura",
                "tumulo_destino__quadra__cemiterio__prefeitura",
            ),
            pk=pk,
        )
        pdf_bytes = self._render_pdf(translado)
        return HttpResponse(pdf_bytes, content_type="application/pdf")

    @action(detail=True, methods=["get"], url_path="relatorio_pdf")
    def relatorio_pdf(self, request, pk=None):
        return self.pdf(request, pk)

    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        return self.pdf(request, pk)


# views_api.py (trecho)

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from sepultados_gestao.models import Receita
from sepultados_gestao.serializers import ReceitaSerializer

class ReceitaViewSet(viewsets.ModelViewSet):
    """
    ViewSet das receitas.
    Filtra por prefeitura via querystring (?prefeitura=) quando informada,
    senão usa request.prefeitura_ativa. Sem escopo => vazio.
    """
    queryset = Receita.objects.all().select_related("prefeitura")
    serializer_class = ReceitaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()

        req = self.request
        pref_id = (
            req.query_params.get("prefeitura")
            or req.query_params.get("prefeitura_id")
        )
        if pref_id:
            return qs.filter(prefeitura_id=pref_id).order_by("-id")

        pref_ativa = getattr(req, "prefeitura_ativa", None)
        if pref_ativa:
            return qs.filter(prefeitura=pref_ativa).order_by("-id")

        return qs.none()

    # PDF individual (recibo)
    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        from .views import gerar_recibo_pdf
        return gerar_recibo_pdf(request, receita_id=pk)



from datetime import datetime
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import RegistroAuditoria
from .serializers import RegistroAuditoriaSerializer
from .mixins import PrefeituraRestritaQuerysetMixin

class RegistroAuditoriaViewSet(PrefeituraRestritaQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = RegistroAuditoria.objects.all()
    serializer_class = RegistroAuditoriaSerializer
    prefeitura_field = "prefeitura"
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication, SessionAuthentication]

    def _parse_date(self, s: str):
        try: return datetime.strptime(s, "%Y-%m-%d").date()
        except Exception: return None

    def get_queryset(self):
        qs = super().get_queryset().select_related("usuario", "prefeitura")  # ✅ usa o mixin

        # oculta superusuário e (opcional) contas internas
        qs = qs.exclude(usuario__is_superuser=True)
        # qs = qs.exclude(usuario__email__iendswith='@sepultados.com')  # ative se quiser ocultar time interno

        p = self.request.query_params

        di = self._parse_date(p.get("data_inicio") or "")
        df = self._parse_date(p.get("data_fim") or "")
        if di: qs = qs.filter(data_hora__date__gte=di)
        if df: qs = qs.filter(data_hora__date__lte=df)

        acao = (p.get("acao") or "").strip().lower()
        if acao and acao not in {"todas", "todos"}:
            mapa = {
                "adição":"add","adicao":"add","add":"add","create":"add","criação":"add","criacao":"add",
                "edição":"change","edicao":"change","change":"change","update":"change","edit":"change",
                "exclusão":"delete","exclusao":"delete","delete":"delete","remoção":"delete","remocao":"delete","remove":"delete",
            }
            code = mapa.get(acao, acao)
            if code in {"add","change","delete"}:
                qs = qs.filter(acao__iexact=code)

        usuario = (p.get("usuario") or "").strip()
        if usuario and usuario.lower() != "todos":
            if usuario.isdigit(): qs = qs.filter(usuario_id=int(usuario))
            else: qs = qs.filter(Q(usuario__email__iexact=usuario) | Q(usuario__username__iexact=usuario))

        entidade = (p.get("entidade") or "").strip()
        if entidade and entidade.lower() not in {"todas","todos"}:
            qs = qs.filter(modelo__iexact=entidade)

        q = (p.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(modelo__icontains=q) |
                Q(representacao__icontains=q) |
                Q(objeto_id__icontains=q) |
                Q(usuario__email__icontains=q) |
                Q(usuario__username__icontains=q)
            )

        return qs.order_by("-data_hora", "-id")



# ===========================
# FLUXO DE CADASTRO/EMAIL
# ===========================
User = get_user_model()

class RegistrarPrefeituraAPIView(APIView):
    permission_classes = []

    def enviar_email_confirmacao(self, usuario):
        token = uuid.uuid4()

        EmailConfirmacao.objects.update_or_create(
            email=usuario.email,
            defaults={
                'token': token,
                'criado_em': timezone.now(),
                'usado': False,
            }
        )

        link = f"{settings.FRONTEND_URL}/verificar-email/{token}"

        from django.template.loader import render_to_string
        html_content = render_to_string(
            "emails/email_confirmacao_usuario.html",
            {"usuario": usuario, "link": link, "ano_atual": date.today().year}
        )

        send_mail(
            subject="Confirmação de E-mail - Sepultados.com",
            message=f"Confirme seu e-mail acessando: {link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[usuario.email],
            html_message=html_content,
            fail_silently=False,
        )

    def post(self, request):
        try:
            from django.db import transaction
            with transaction.atomic():
                d = request.data
                campos = {
                    "nome": d.get("nome"),
                    "cnpj": d.get("cnpj"),
                    "responsavel": d.get("responsavel"),
                    "telefone": d.get("telefone"),
                    "email": d.get("email"),
                    "senha": d.get("senha"),
                    "logradouro": d.get("logradouro"),
                    "endereco_numero": d.get("endereco_numero"),
                    "endereco_bairro": d.get("endereco_bairro"),
                    "endereco_cidade": d.get("endereco_cidade"),
                    "endereco_estado": d.get("endereco_estado"),
                    "endereco_cep": d.get("endereco_cep"),
                    "plano_id": int(d.get("plano_id")) if d.get("plano_id") else None,
                    "duracao_anos": int(d.get("duracao_anos", 1)),
                    "logo_base64": d.get("logo_base64"),
                    "brasao_base64": d.get("brasao_base64"),
                }

                obrig = ["nome","cnpj","responsavel","telefone","email","senha",
                         "logradouro","endereco_numero","endereco_cidade",
                         "endereco_estado","endereco_cep","plano_id"]
                if not all(campos[k] for k in obrig):
                    return Response({"detail": "Todos os campos obrigatórios devem ser preenchidos."}, status=400)

                if User.objects.filter(email=campos["email"], is_active=True).exists():
                    return Response({"detail": "Já existe um usuário ativo com esse e-mail."}, status=400)

                CadastroPrefeituraPendente.objects.update_or_create(
                    email=campos["email"], defaults=campos
                )

                user = User.objects.filter(email=campos["email"]).first()
                if not user:
                    user = User.objects.create_user(
                        email=campos["email"], password=campos["senha"],
                        is_active=False, is_staff=True
                    )
                else:
                    if user.is_active:
                        user.is_active = False
                        user.save(update_fields=["is_active"])

                self.enviar_email_confirmacao(user)

                return Response({"detail": "Enviamos um e-mail para confirmação. Verifique sua caixa de entrada."}, status=200)

        except Exception as e:
            return Response({"detail": f"Erro: {e}"}, status=500)


class ListaPlanosAPIView(APIView):
    permission_classes = []

    def get(self, request):
        planos = Plano.objects.all().order_by('preco_mensal')
        serializer = PlanoSerializer(planos, many=True)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def licenca_da_prefeitura(request, prefeitura_id):
    if not (request.user.is_superuser or request.user.is_staff):
        if getattr(request.user, "prefeitura_id", None) != prefeitura_id:
            return Response({"detail": "Proibido."}, status=status.HTTP_403_FORBIDDEN)

    agora = timezone.now()
    licenca = (
        Licenca.objects
        .filter(prefeitura_id=prefeitura_id, data_inicio__lte=agora)
        .order_by('-data_inicio')
        .first()
    )
    if not licenca:
        return Response({"detail": "Licença não encontrada."}, status=status.HTTP_404_NOT_FOUND)

    from .serializers import LicencaSerializer
    serializer = LicencaSerializer(licenca)
    return Response(serializer.data, status=status.HTTP_200_OK)


def enviar_email_confirmacao(email):
    token = uuid.uuid4()

    EmailConfirmacao.objects.update_or_create(
        email=email,
        defaults={'token': token, 'criado_em': timezone.now(), 'usado': False}
    )

    link = f"{settings.FRONTEND_URL}/verificar-email/{token}"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 40px;">
      <div style="max-width: 600px; background: #ffffff; margin: auto; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <h2 style="color: #2f855a; text-align: center;">Confirmação de E-mail</h2>
        <p>Olá,</p>
        <p>Recebemos seu cadastro no <strong>Sepultados.com</strong>.</p>
        <p>Para ativar sua conta, clique no botão abaixo:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{link}" target="_blank" style="background-color: #2f855a; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Confirmar E-mail
          </a>
        </div>
        <p style="font-size: 14px; color: #666;">Se você não fez esse cadastro, ignore esta mensagem.</p>
        <hr style="margin: 30px 0;">
        <p style="font-size: 12px; text-align: center; color: #aaa;">Sepultados.com • Sistema de Gestão de Cemitérios</p>
      </div>
    </div>
    """

    send_mail(
        subject="Confirmação de E-mail - Sepultados.com",
        message=f"Olá! Confirme seu e-mail clicando neste link: {link}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        html_message=html_content,
        fail_silently=False,
    )


@api_view(['GET'])
def verificar_email(request, token):
    try:
        confirmacao = EmailConfirmacao.objects.get(token=token)

        if confirmacao.usado:
            return Response({"detail": "Este link já foi utilizado."}, status=400)

        confirmacao.usado = True
        confirmacao.save()

        user = User.objects.filter(email=confirmacao.email).first()
        if not user:
            return Response({"detail": "Usuário não encontrado para este e-mail."}, status=404)

        user.is_active = True
        user.save()

        cadastro = CadastroPrefeituraPendente.objects.filter(email=confirmacao.email).first()
        if not cadastro:
            return Response({"detail": "Cadastro pendente não encontrado."}, status=404)

        prefeitura = Prefeitura.objects.create(
            usuario=user,
            nome=cadastro.nome,
            cnpj=cadastro.cnpj,
            responsavel=cadastro.responsavel,
            telefone=cadastro.telefone,
            email=cadastro.email,
            logradouro=cadastro.logradouro,
            endereco_numero=cadastro.endereco_numero,
            endereco_bairro=cadastro.endereco_bairro,
            endereco_cidade=cadastro.endereco_cidade,
            endereco_estado=cadastro.endereco_estado,
            endereco_cep=cadastro.endereco_cep,
        )

        def salvar_imagem(base64_str):
            format, imgstr = base64_str.split(';base64,')
            ext = format.split('/')[-1]
            nome_arquivo = f"{uuid.uuid4()}.{ext}"
            return ContentFile(base64.b64decode(imgstr), name=nome_arquivo)

        if cadastro.logo_base64:
            prefeitura.logo = salvar_imagem(cadastro.logo_base64)
        if cadastro.brasao_base64:
            prefeitura.brasao = salvar_imagem(cadastro.brasao_base64)
        prefeitura.save()

        # vincula prefeitura ao usuário
        user.prefeitura = prefeitura
        user.save()

        plano = Plano.objects.get(pk=cadastro.plano_id)

        Licenca.objects.create(
            prefeitura=prefeitura,
            plano=plano,
            valor_mensal_atual=plano.preco_mensal,
            percentual_reajuste_anual=5.0,
            anos_contratados=cadastro.duracao_anos,
            usuarios_min=plano.usuarios_min,
            usuarios_max=plano.usuarios_max,
            sepultados_max=plano.sepultados_max,
            inclui_api=plano.inclui_api,
            inclui_erp=plano.inclui_erp,
            inclui_suporte_prioritario=plano.inclui_suporte_prioritario,
            data_inicio=timezone.now(),
        )

        cadastro.delete()

        return Response({"detail": "E-mail confirmado com sucesso. Prefeitura e licença criadas automaticamente."}, status=200)

    except EmailConfirmacao.DoesNotExist:
        return Response({"detail": "Token inválido ou inexistente."}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def usuario_logado(request):
    user = request.user
    prefeitura = getattr(user, "prefeitura", None)
    if not prefeitura:
        prefeitura = Prefeitura.objects.filter(usuario=user).first()

    brasao_url = None
    if prefeitura and prefeitura.brasao and hasattr(prefeitura.brasao, 'url'):
        try:
            brasao_url = request.build_absolute_uri(prefeitura.brasao.url)
        except ValueError:
            brasao_url = None

    return Response({
        "usuario": {"nome": getattr(user, "nome", user.email), "email": user.email},
        "prefeitura": {
            "id": prefeitura.id if prefeitura else None,
            "nome": prefeitura.nome if prefeitura else None,
            "logo_url": brasao_url,
        }
    })


class PrefeituraLogadaAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        prefeitura = Prefeitura.objects.filter(usuario=request.user).first()
        if not prefeitura:
            return Response({"detail": "Prefeitura não encontrada."}, status=404)
        serializer = PrefeituraSerializer(prefeitura)
        return Response(serializer.data)

    def patch(self, request):
        prefeitura = Prefeitura.objects.filter(usuario=request.user).first()
        if not prefeitura:
            return Response({"detail": "Prefeitura não encontrada."}, status=404)
        serializer = PrefeituraSerializer(prefeitura, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class CemiterioLogadoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cem_id = request.session.get("cemiterio_ativo")
        cem = Cemiterio.objects.filter(id=cem_id).first() if cem_id else None
        data = CemiterioSerializer(cem).data if cem else None
        return Response(data)

    def post(self, request):
        cem_id = request.data.get("cemiterio")
        if not cem_id:
            return Response({"detail": "Campo 'cemiterio' obrigatório."}, status=400)

        pref = getattr(request, "prefeitura_ativa", None)
        qs = Cemiterio.objects.all()
        if pref:
            qs = qs.filter(prefeitura=pref)

        cem = qs.filter(id=cem_id).first()
        if not cem:
            return Response({"detail": "Cemitério inválido."}, status=400)

        request.session["cemiterio_ativo"] = cem.id
        return Response({"ok": True})


def _prefeitura_id_from_obj(obj):
    try:
        # 1) objeto com FK direta
        if hasattr(obj, "prefeitura_id") and obj.prefeitura_id:
            return obj.prefeitura_id
        # 2) via túmulo -> quadra -> cemitério
        t = getattr(obj, "tumulo", None)
        if t and getattr(t, "quadra", None) and getattr(t.quadra, "cemiterio", None):
            return t.quadra.cemiterio.prefeitura_id
        # 3) objetos que tenham cemiterio direto
        if getattr(obj, "cemiterio", None):
            return obj.cemiterio.prefeitura_id
    except Exception:
        pass
    return None


# views_api.py
from django.shortcuts import get_object_or_404
from django.contrib.contenttypes.models import ContentType
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied

from .models import Anexo
from .serializers import AnexoSerializer

def _prefeitura_id_from_obj(obj):
    try:
        if hasattr(obj, "prefeitura_id") and obj.prefeitura_id:
            return obj.prefeitura_id
        t = getattr(obj, "tumulo", None)
        if t and getattr(t, "quadra", None) and getattr(t.quadra, "cemiterio", None):
            return t.quadra.cemiterio.prefeitura_id
        if getattr(obj, "cemiterio", None):
            return obj.cemiterio.prefeitura_id
    except Exception:
        pass
    return None


class AnexoViewSet(mixins.ListModelMixin,
                   mixins.CreateModelMixin,
                   mixins.DestroyModelMixin,
                   viewsets.GenericViewSet):
    queryset = Anexo.objects.all().order_by("-data_upload")
    serializer_class = AnexoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    # --- helpers ---------------------------------------------------------
    def _parse_ct(self, s: str) -> ContentType:
        try:
            app_label, model = s.split(".", 1)
            return ContentType.objects.get(app_label=app_label, model=model.lower())
        except Exception:
            raise ValidationError({
                "content_type": "Use app_label.model (ex.: sepultados_gestao.sepultado)."
            })

    def _check_scope(self, ct: ContentType, obj_id: str):
        try:
            obj = ct.get_object_for_this_type(id=int(obj_id))
        except Exception:
            raise ValidationError({"object_id": "Objeto não encontrado."})

        pref_ativa = getattr(self.request, "prefeitura_ativa", None)
        pref_ativa_id = getattr(pref_ativa, "id", None)
        obj_pref_id = _prefeitura_id_from_obj(obj)

        if pref_ativa_id and obj_pref_id and str(pref_ativa_id) != str(obj_pref_id):
            raise PermissionDenied("Sem permissão para anexos deste registro.")
        return obj

    # --- list ------------------------------------------------------------
    def get_queryset(self):
        qs = super().get_queryset()
        ct_param = self.request.query_params.get("ct") or self.request.query_params.get("content_type")
        obj_id = self.request.query_params.get("object_id")
        if not (ct_param and obj_id):
            return qs.none()
        ct = self._parse_ct(ct_param)
        self._check_scope(ct, obj_id)
        return qs.filter(content_type=ct, object_id=int(obj_id))

    # --- create (sobrescrita para normalizar antes da validação) ---------
    def create(self, request, *args, **kwargs):
        data = request.data.copy()

        ct_param = (
            data.get("content_type") or data.get("ct")
            or request.query_params.get("content_type") or request.query_params.get("ct")
        )
        obj_id = data.get("object_id") or request.query_params.get("object_id")

        if not (ct_param and obj_id):
            raise ValidationError({"detail": "content_type e object_id são obrigatórios."})

        ct = self._parse_ct(ct_param)
        self._check_scope(ct, obj_id)

        # injeta PKs que o serializer espera
        data["content_type"] = ct.pk
        data["object_id"] = int(obj_id)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)  # manter para setar campos calculados se desejar
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    # ainda mantém perform_create para garantir os campos corretos no save
    def perform_create(self, serializer):
        # como já validamos/normalizamos, isto é só para garantir consistência
        ct_pk = serializer.validated_data.get("content_type").pk if hasattr(serializer.validated_data.get("content_type"), "pk") else serializer.validated_data.get("content_type")
        ct = ContentType.objects.get(pk=ct_pk)
        obj_id = serializer.validated_data.get("object_id")
        serializer.save(content_type=ct, object_id=obj_id)

    # --- delete ----------------------------------------------------------
    def get_object(self):
        obj = get_object_or_404(Anexo, pk=self.kwargs["pk"])
        self._check_scope(obj.content_type, obj.object_id)
        return obj



# sepultados_gestao/views_api.py
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny  # <- AllowAny opcional em dev
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
import pandas as pd

from .models import Quadra, Tumulo, Sepultado

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication
from django.db import transaction
from .utils import gerar_numero_sequencial_global


class BaseImportAPIView(APIView):
    authentication_classes = (JWTAuthentication, SessionAuthentication)
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def _get_cemiterio_id(self, request):
        # 1) querystring: ?cemiterio=<id> ou ?cemiterio_id=<id>
        cid = request.query_params.get("cemiterio") or request.query_params.get("cemiterio_id")
        if cid:
            try:
                return int(cid)
            except Exception:
                pass
        # 2) form-data: cemiterio_id
        cid = request.data.get("cemiterio") or request.data.get("cemiterio_id")
        if cid:
            try:
                return int(cid)
            except Exception:
                pass
        # 3) sessão
        return request.session.get("cemiterio_ativo_id")  # <- chave correta

    def _read_dataframe(self, arquivo):
        nome = arquivo.name.lower()
        if nome.endswith(".csv"):
            return pd.read_csv(arquivo)
        if nome.endswith(".xls") or nome.endswith(".xlsx"):
            return pd.read_excel(arquivo)
        raise ValueError("Formato de arquivo não suportado. Use .csv, .xls ou .xlsx.")


# sepultados_gestao/views_api.py
import json
import re
import pandas as pd
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Quadra

class ImportQuadrasAPIView(APIView):
    """
    Importa Quadras para o cemitério ativo/da querystring.

    Colunas aceitas (minúsculas):
      - codigo (obrigatória)
      - UMA coluna de polígono (opcional): poligono_mapa | limites | polygon | wkt | latlng | lat_lng
      - grid_cols, grid_rows (opcionais)
      - angulo (opcional) OU grid_angulo (opcional)

    Formatos de polígono aceitos:
      1) Texto com pares: "lat,lng lat,lng lat,lng" (apenas espaço entre pares) — também aceita ; / e quebras de linha
      2) JSON: [{"lat":-23.4,"lng":-51.9}, ...] ou [[-23.4, -51.9], ...]
      3) WKT: POLYGON((lng lat, lng lat, ...))  (atenção: WKT é LON,LAT)
    """
    permission_classes = [IsAuthenticated]

    _FLOAT_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")
    _POLY_COLUMNS = ("poligono_mapa", "limites", "polygon", "wkt", "latlng", "lat_lng")

    # ---------- helpers ----------
    @staticmethod
    def _read_df(uploaded_file):
        name = uploaded_file.name.lower()
        if name.endswith(".csv"):
            df = pd.read_csv(uploaded_file)
        elif name.endswith(".xls") or name.endswith(".xlsx"):
            df = pd.read_excel(uploaded_file)
        else:
            raise ValueError("Formato de arquivo não suportado. Use CSV/XLS/XLSX.")
        df.columns = [str(c).strip().lower() for c in df.columns]
        return df

    def _parse_pairs(self, s: str):
        """
        Varre TODOS os números e agrupa de 2 em 2 (lat,lng).
        Funciona quando os pares estão apenas separados por ESPAÇO.
        Também tolera ; / e quebras de linha.
        """
        if s is None:
            return []
        # normaliza separadores estranhos em espaço (para não atrapalhar a regex)
        s = str(s).replace("|", " ").replace(";", " ").replace("/", " ").replace("\n", " ")
        s = " ".join(s.split())  # colapsa múltiplos espaços
        nums = self._FLOAT_RE.findall(s)
        pts = []
        for i in range(0, len(nums) - 1, 2):
            try:
                lat = float(nums[i])
                lng = float(nums[i + 1])
                pts.append({"lat": lat, "lng": lng})
            except Exception:
                # ignora par quebrado no final
                pass
        return pts

    def _parse_wkt(self, s: str):
        txt = s.strip()
        if txt.upper().startswith("POLYGON"):
            txt = txt[txt.find("((") + 2 : txt.rfind("))")]
        pairs = [p.strip() for p in txt.split(",") if p.strip()]
        pts = []
        for p in pairs:
            nums = self._FLOAT_RE.findall(p)
            if len(nums) >= 2:
                lng = float(nums[0]); lat = float(nums[1])  # WKT é LON,LAT
                pts.append({"lat": lat, "lng": lng})
        return pts

    def _parse_polygon_cell(self, cell):
        """Retorna list[{'lat','lng'}] ou []. Aceita lista, JSON, WKT ou texto com pares."""
        if cell is None or (isinstance(cell, float) and pd.isna(cell)):
            return []

        # lista já estruturada
        if isinstance(cell, list):
            if cell and isinstance(cell[0], dict) and "lat" in cell[0] and "lng" in cell[0]:
                return [{"lat": float(p["lat"]), "lng": float(p["lng"])} for p in cell]
            if cell and isinstance(cell[0], (list, tuple)) and len(cell[0]) >= 2:
                return [{"lat": float(p[0]), "lng": float(p[1])} for p in cell]

        s = str(cell).strip()
        if not s:
            return []

        # JSON string
        if s.startswith("[") or s.startswith("{"):
            try:
                j = json.loads(s)
                return self._parse_polygon_cell(j)
            except Exception:
                pass

        # WKT
        if s.upper().startswith("POLYGON"):
            try:
                return self._parse_wkt(s)
            except Exception:
                pass

        # Texto livre (pares separados por espaço/;///\n)
        return self._parse_pairs(s)

    def _process_df(self, df, cemiterio_id: int):
        total, atualizados, erros = 0, 0, []
        for idx, row in df.iterrows():
            try:
                codigo = str(row.get("codigo") or "").strip()
                if not codigo:
                    continue

                # 1) pega a primeira coluna de polígono existente e não vazia
                pol_cell = None
                for k in self._POLY_COLUMNS:
                    if k in df.columns:
                        pol_cell = row.get(k)
                        if pol_cell is not None and not (isinstance(pol_cell, float) and pd.isna(pol_cell)):
                            break
                poligono = self._parse_polygon_cell(pol_cell) if pol_cell is not None else []

                # 2) grid (cols/rows/angulo)
                grid = {}
                if "grid_cols" in df.columns and pd.notna(row.get("grid_cols")):
                    try:
                        grid["cols"] = int(float(row.get("grid_cols")))
                    except Exception:
                        pass
                if "grid_rows" in df.columns and pd.notna(row.get("grid_rows")):
                    try:
                        grid["rows"] = int(float(row.get("grid_rows")))
                    except Exception:
                        pass

                # ângulo: prioriza 'angulo'; se não tiver, usa 'grid_angulo'
                ang_val = None
                if "angulo" in df.columns and pd.notna(row.get("angulo")) and str(row.get("angulo")) != "":
                    ang_val = float(row.get("angulo"))
                elif "grid_angulo" in df.columns and pd.notna(row.get("grid_angulo")) and str(row.get("grid_angulo")) != "":
                    ang_val = float(row.get("grid_angulo"))
                if ang_val is not None:
                    # normaliza para 0..360 (opcional)
                    while ang_val < 0:
                        ang_val += 360.0
                    while ang_val >= 360.0:
                        ang_val -= 360.0
                    grid["angulo"] = ang_val

                # 3) defaults para update_or_create
                defaults = {}
                if poligono:
                    defaults["poligono_mapa"] = poligono
                if grid:
                    defaults["grid_params"] = grid

                with transaction.atomic():
                    obj, created = Quadra.objects.update_or_create(
                        cemiterio_id=cemiterio_id,
                        codigo=codigo,
                        defaults=defaults or {},
                    )

                total += 1
                if not created and defaults:
                    atualizados += 1

            except Exception as e:
                erros.append(f"Linha {idx + 2}: {e}")
        return total, atualizados, erros

    # ---------- POST ----------
    def post(self, request):
        if "arquivo" not in request.FILES:
            return Response({"detail": "Envie o arquivo em 'arquivo'."}, status=400)

        cemiterio_id = (
            request.query_params.get("cemiterio")
            or request.session.get("cemiterio_ativo_id")
            or request.session.get("cemiterio_ativo")
        )
        if not cemiterio_id:
            return Response({"detail": "Defina o cemitério (?cemiterio=) ou selecione no sistema."}, status=400)

        try:
            df = self._read_df(request.FILES["arquivo"])
            total, atualizados, erros = self._process_df(df, int(cemiterio_id))
            return Response({"importados": total, "atualizados": atualizados, "erros": erros}, status=200)
        except Exception as e:
            return Response({"detail": f"Erro ao importar: {e}"}, status=400)




# --- Substitua sua ImportTumulosAPIView por esta versão compatível ---

import re
from decimal import Decimal, InvalidOperation
import pandas as pd
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import Tumulo, Quadra
from .views_api import BaseImportAPIView  # se esta classe já está neste arquivo, pode remover esta linha

class ImportTumulosAPIView(BaseImportAPIView):
    permission_classes = [IsAuthenticated]

    MAPA_TIPO = {
        "túmulo": "tumulo", "tumulo": "tumulo",
        "perpétua": "perpetua", "perpetua": "perpetua",
        "sepultura": "sepultura", "jazigo": "jazigo", "gaveta": "gaveta",
        "outro": "outro"
    }

    # -------- helpers (mesmos do backend) --------
    _NUM_RE = re.compile(r'[-+]?\d+(?:\.\d+)?')

    @staticmethod
    def _as_decimal(v, allow_none=True):
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return None if allow_none else Decimal("0")
        s = str(v).strip()
        if not s:
            return None if allow_none else Decimal("0")
        s = s.replace(",", ".")
        try:
            return Decimal(s)
        except InvalidOperation:
            raise ValueError(f"número inválido: {v!r}")

    @staticmethod
    def _as_int(v, allow_none=True):
        if v is None or (isinstance(v, float) and pd.isna(v)) or str(v).strip() == "":
            return None if allow_none else 0
        try:
            return int(float(str(v).replace(",", ".").strip()))
        except Exception:
            raise ValueError(f"inteiro inválido: {v!r}")

    @staticmethod
    def _as_bool(v):
        s = str(v).strip().lower()
        return s in {"1", "true", "t", "sim", "s", "yes", "y"}

    def _parse_coord(self, s):
        if s is None or (isinstance(s, float) and pd.isna(s)) or str(s).strip() == "":
            return None
        txt = str(s).strip()
        txt = re.sub(r'^[\(\[]\s*|\s*[\)\]]$', '', txt)
        nums = self._NUM_RE.findall(txt.replace(",", " ").replace(";", " ").replace("/", " "))
        if len(nums) >= 2:
            lat = float(nums[0]); lng = float(nums[1])
            return {"lat": lat, "lng": lng}
        raise ValueError(f"coordenada inválida: {s!r}. Use '-23.44, -51.92'")

    # -------------- POST --------------
    def post(self, request):
        if "arquivo" not in request.FILES:
            return Response({"detail": "Envie o arquivo em 'arquivo'."}, status=400)

        cemiterio_id = self._get_cemiterio_id(request)
        if not cemiterio_id:
            return Response({"detail": "Defina o cemitério (?cemiterio=) ou selecione no sistema."}, status=400)

        try:
            df = self._read_dataframe(request.FILES["arquivo"])
            df.columns = [str(c).strip().lower() for c in df.columns]
        except Exception as e:
            return Response({"detail": f"Erro ao ler planilha: {e}"}, status=400)

        esperados = {
            "tipo_estrutura","identificador","capacidade","quadra_codigo",
            "usar_linha","linha","angulo","comprimento_m","largura_m","coordenada"
        }
        faltando = [c for c in esperados if c not in df.columns]
        if faltando:
            return Response({"detail": f"Colunas faltando: {', '.join(faltando)}"}, status=400)

        total, atualizados, erros = 0, 0, []
        for i, r in df.iterrows():
            linha = i + 2  # cabeçalho = linha 1
            try:
                ident  = str(r.get("identificador") or "").strip()
                if not ident:
                    raise ValueError("identificador vazio")

                qcod = str(r.get("quadra_codigo") or "").strip()
                if not qcod:
                    raise ValueError("quadra_codigo vazio")

                quadra_id = Quadra.objects.filter(
                    codigo__iexact=qcod,
                    cemiterio_id=cemiterio_id
                ).values_list("id", flat=True).first()
                if not quadra_id:
                    raise ValueError(f"quadra '{qcod}' não encontrada neste cemitério")

                tipo_raw   = str(r.get("tipo_estrutura") or "").strip().lower()
                tipo       = self.MAPA_TIPO.get(tipo_raw, "tumulo")
                capacidade = self._as_int(r.get("capacidade")) or 1
                usar_linha = self._as_bool(r.get("usar_linha"))
                n_linha    = self._as_int(r.get("linha")) if usar_linha else None

                # novos campos
                angulo_graus  = self._as_decimal(r.get("angulo"))
                comprimento_m = self._as_decimal(r.get("comprimento_m"))
                largura_m     = self._as_decimal(r.get("largura_m"))
                localizacao   = self._parse_coord(r.get("coordenada"))

                defaults = {
                    "tipo_estrutura": tipo,
                    "capacidade": capacidade,
                    "usar_linha": usar_linha,
                    "linha": n_linha,
                    "quadra_id": quadra_id,
                }
                if angulo_graus is not None:
                    defaults["angulo_graus"] = angulo_graus
                if comprimento_m is not None:
                    defaults["comprimento_m"] = comprimento_m
                if largura_m is not None:
                    defaults["largura_m"] = largura_m
                if localizacao is not None:
                    defaults["localizacao"] = localizacao

                with transaction.atomic():
                    obj, created = Tumulo.objects.update_or_create(
                        cemiterio_id=cemiterio_id,
                        identificador=ident,
                        defaults=defaults
                    )

                total += 1
                if not created:
                    atualizados += 1

            except Exception as e:
                erros.append(f"Linha {linha}: {e}")

        return Response(
            {"importados": total, "atualizados": atualizados, "erros": erros},
            status=200
        )



class ImportSepultadosAPIView(BaseImportAPIView):
    """
    Importa sepultados SEM exigir contrato (somente via importação).
    Gera o número global de sepultamento como no admin (save + fallback).
    Colunas principais esperadas:
      identificador_tumulo, quadra, usar_linha, linha, nome,
      data_falecimento, data_sepultamento, cpf_sepultado, data_nascimento, sexo,
      local_nascimento, local_falecimento, nome_pai, nome_mae
    """
    def post(self, request):
        if "arquivo" not in request.FILES:
            return Response({"detail": "Envie o arquivo em 'arquivo'."}, status=400)

        cemiterio_id = self._get_cemiterio_id(request)
        if not cemiterio_id:
            return Response({"detail": "Defina o cemitério (?cemiterio=) ou selecione no sistema."}, status=400)

        try:
            df = self._read_dataframe(request.FILES["arquivo"])
        except Exception as e:
            return Response({"detail": f"Erro ao ler planilha: {e}"}, status=400)

        # util de data seguro
        def _date(v):
            try:
                if pd.isna(v) or v is None or str(v).strip() == "":
                    return None
                d = pd.to_datetime(v, dayfirst=True, errors="coerce")
                return None if pd.isna(d) else d.date()
            except Exception:
                return None

        # parse lógico simples
        def _truthy(v):
            return str(v or "").strip().lower() in ("sim", "s", "true", "1", "yes", "y")

        # int seguro (aceita float/str, vazio -> None)
        def _int_or_none(v):
            try:
                if pd.isna(v) or v is None or str(v).strip() == "":
                    return None
                return int(float(v))
            except Exception:
                return None

        importados = 0
        erros = []
        tumulos_usados = set()

        for i, row in df.iterrows():
            try:
                quadra_codigo = str(row.get("quadra") or "").strip()
                ident_tumulo  = str(row.get("identificador_tumulo") or "").strip()
                if not quadra_codigo or not ident_tumulo:
                    continue

                quadra_id = Quadra.objects.filter(
                    codigo__iexact=quadra_codigo,
                    cemiterio_id=cemiterio_id,
                ).values_list("id", flat=True).first()
                if not quadra_id:
                    erros.append(f"Linha {i+2}: Quadra '{quadra_codigo}' não encontrada.")
                    continue

                tumulo = Tumulo.objects.filter(
                    quadra_id=quadra_id, identificador__iexact=ident_tumulo
                ).first()
                if not tumulo:
                    erros.append(
                        f"Linha {i+2}: Túmulo '{ident_tumulo}' não encontrado na quadra '{quadra_codigo}'."
                    )
                    continue

                # ========== VALIDAÇÃO DE LINHA (NOVA) ==========
                usar_linha_plan = _truthy(row.get("usar_linha"))
                linha_plan = _int_or_none(row.get("linha"))

                if tumulo.usar_linha:
                    # se o túmulo usa linha: planilha deve informar e deve bater
                    if linha_plan is None:
                        erros.append(
                            f"Linha {i+2}: Túmulo '{ident_tumulo}' usa linha ({tumulo.linha}), "
                            "mas a planilha não informou 'linha'."
                        )
                        continue
                    if int(linha_plan) != int(tumulo.linha or 0):
                        erros.append(
                            f"Linha {i+2}: Linha informada ({linha_plan}) difere da linha do túmulo ({tumulo.linha})."
                        )
                        continue
                # se o túmulo NÃO usa linha, ignoramos 'usar_linha'/'linha' da planilha
                # (NÃO alteramos tumulo.usar_linha / tumulo.linha)

                # cria e salva (gera número no save do model)
                with transaction.atomic():
                    sep = Sepultado(
                        nome=row.get("nome") or "",
                        cpf_sepultado=row.get("cpf_sepultado"),
                        data_nascimento=_date(row.get("data_nascimento")),
                        sexo=(row.get("sexo") or "NI")[:2].upper(),
                        local_nascimento=row.get("local_nascimento"),
                        local_falecimento=row.get("local_falecimento"),
                        data_falecimento=_date(row.get("data_falecimento")),
                        data_sepultamento=_date(row.get("data_sepultamento")),
                        nome_pai=row.get("nome_pai"),
                        nome_mae=row.get("nome_mae"),
                        tumulo=tumulo,
                        importado=True,  # marca como importado
                    )
                    # chama a lógica do model (gera número) e ignora contrato
                    sep.save(ignorar_validacao_contrato=True)

                    # fallback: se por algum motivo não veio número, força aqui
                    if not getattr(sep, "numero_sepultamento", None):
                        sep.numero_sepultamento = gerar_numero_sequencial_global(
                            tumulo.quadra.cemiterio.prefeitura
                        )
                        sep.save(update_fields=["numero_sepultamento"])

                tumulos_usados.add(tumulo.id)
                importados += 1

            except Exception as e:
                erros.append(f"Linha {i+2}: {e}")

        # marca túmulos como ocupados (se esse for o status padrão após sepultamento)
        if tumulos_usados:
            try:
                Tumulo.objects.filter(id__in=list(tumulos_usados)).update(status="ocupado")
            except Exception:
                pass  # não falha a importação por isso

        return Response({"importados": importados, "erros": erros}, status=200)


# --- CSRF helper (GET) permanece igual ---
from django.http import JsonResponse, HttpResponseNotAllowed
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie

@ensure_csrf_cookie
def csrf_get(request):
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])
    return JsonResponse({"csrfToken": get_token(request)})


# --- NOVO: selecionar cemitério pela sessão ---
from rest_framework.decorators import api_view, permission_classes

@api_view(["POST"])
@permission_classes([AllowAny])  # em produção troque por IsAuthenticated
def selecionar_cemiterio_api(request):
    cid = (
        request.data.get("cemiterio") or request.data.get("cemiterio_id")
        or request.query_params.get("cemiterio") or request.query_params.get("cemiterio_id")
    )
    if not cid:
        return Response({"detail": "Informe cemiterio (id)."}, status=400)
    try:
        cid = int(cid)
    except Exception:
        return Response({"detail": "cemiterio deve ser inteiro."}, status=400)

    request.session["cemiterio_ativo_id"] = cid
    return Response({"ok": True, "cemiterio": cid})


# --- BACKUP API ---
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.response import Response

def _unwrap(func):
    while hasattr(func, "__wrapped__"):
        func = func.__wrapped__
    return func

@api_view(["GET"])
@permission_classes([IsAuthenticated])
@authentication_classes([JWTAuthentication, SessionAuthentication])  # JWT ou sessão
def backup_prefeitura_api(request):
    pref_id = (
        request.query_params.get("prefeitura")
        or getattr(getattr(request, "prefeitura_ativa", None), "id", None)
    )
    if not pref_id:
        return Response({"detail": "Defina uma prefeitura ativa antes do backup."}, status=400)

    from .views_backup import backup_prefeitura_ativa as _admin_view
    raw_view = _unwrap(_admin_view)

    dj_req = request._request
    dj_req.session["prefeitura_ativa_id"] = int(pref_id)

    return raw_view(dj_req)



# --- Auditorias: URL JSON para abrir o PDF ---
from django.urls import reverse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.response import Response

@api_view(["GET"])
@permission_classes([IsAuthenticated])
@authentication_classes([JWTAuthentication, SessionAuthentication])
def auditorias_pdf_url(request):
    """
    Retorna {"pdf_url": "<absoluta>"} apontando para /relatorios/auditorias/pdf/
    preservando todos os filtros. Se não vier 'prefeitura' na query,
    tenta deduzir do contexto do usuário/sessão e injeta.
    """
    qs = request.GET.copy()

    # já veio? então só preserva
    if "prefeitura" not in qs and "prefeitura_id" not in qs:
        pref_id = (
            getattr(getattr(request, "prefeitura_ativa", None), "id", None)
            or getattr(request.user, "prefeitura_id", None)
            or getattr(getattr(request.user, "prefeitura", None), "id", None)
        )
        if pref_id:
            qs["prefeitura"] = pref_id

    url = reverse("sepultados_gestao:auditorias_pdf")
    qstr = qs.urlencode()
    if qstr:
        url = f"{url}?{qstr}"
    return Response({"pdf_url": request.build_absolute_uri(url)})


from datetime import date
from django.db.models import Q, Sum, Count, Value, IntegerField
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Tumulo, Sepultado, ConcessaoContrato


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_resumo_api(request):
    """
    GET /api/dashboard/resumo/?cemiterio=<id>
    (ou ?prefeitura=<id>; ou pega da sessão se existir)

    Regras aqui:
      - total_sepultados: conta TODOS (inclusive os do Ossário).
      - total_vagas / total_tumulos_livres / ocupação: **ignorando** túmulos identificados como "Ossário".
    """
    cem_id = request.query_params.get("cemiterio")
    pref_id = request.query_params.get("prefeitura")

    # Fallback: sessão
    if not cem_id and not pref_id:
        cem = getattr(request, "cemiterio_ativo", None)
        pref = getattr(request, "prefeitura_ativa", None)
        cem_id = getattr(cem, "id", None) if cem else None
        pref_id = getattr(pref, "id", None) if pref else None

    if not cem_id and not pref_id:
        return Response(
            {"detail": "Informe ?cemiterio=<id> ou ?prefeitura=<id> (ou selecione no sistema)."},
            status=400,
        )

    # ---------- TÚMULOS ----------
    tumulos = Tumulo.objects.all()
    if cem_id:
        tumulos = tumulos.filter(cemiterio_id=int(cem_id))
    else:
        tumulos = tumulos.filter(cemiterio__prefeitura_id=int(pref_id))

    # Definição do filtro para o Ossário (identificador "Ossário" ou "Ossario", ignorando caixa/acentuação)
    OSSARIO_Q = Q(identificador__iregex=r'^\s*oss[aá]rio\s*$')

    # Conjunto de túmulos que NÃO são Ossário (usado para vagas/ocupação)
    tumulos_sem_ossario = tumulos.exclude(OSSARIO_Q)

    # Capacidade total (vagas) — **sem Ossário**
    vagas_totais = tumulos_sem_ossario.aggregate(
        total=Coalesce(Sum("capacidade"), Value(0, output_field=IntegerField()))
    )["total"]

    # ---------- SEPULTADOS ----------
    # Todos os sepultados vinculados a algum túmulo do conjunto (INCLUI Ossário)
    sep_all = Sepultado.objects.filter(tumulo__in=tumulos)
    total_sepultados = sep_all.count()

    # Apenas os que AINDA OCUPAM vaga (sem exumação e sem translado, e não marcados como exumado/trasladado)
    sep_atuais = (
        sep_all.filter(data_exumacao__isnull=True, data_translado__isnull=True)
        .exclude(exumado=True)
        .exclude(trasladado=True)
    )
    # Para a conta de vagas/ocupação, **ignore Ossário**
    sep_atuais_sem_ossario = sep_atuais.filter(tumulo__in=tumulos_sem_ossario)

    # Ocupação por túmulo (quantos ocupantes atuais por tumulo_id) — **sem Ossário**
    occ_map = dict(
        sep_atuais_sem_ossario.values("tumulo_id")
        .annotate(ct=Count("id"))
        .values_list("tumulo_id", "ct")
    )

    # Túmulos livres = pelo menos 1 vaga disponível pela capacidade real — **sem Ossário**
    livres_tumulos = 0
    for t_id, cap in tumulos_sem_ossario.values_list("id", "capacidade"):
        if cap - occ_map.get(t_id, 0) > 0:
            livres_tumulos += 1

    # Ocupação/vagas (por pessoa) — **sem Ossário**
    ocupantes_atuais = sep_atuais_sem_ossario.count()
    vagas_ocupadas = min(ocupantes_atuais, vagas_totais)
    vagas_livres = max(vagas_totais - vagas_ocupadas, 0)
    percentual = round((vagas_ocupadas / vagas_totais * 100) if vagas_totais else 0, 1)

    # ---------- CONTRATOS ----------
    # (mantive com todos os túmulos; se quiser ignorar ossário aqui também, troque para tumulos_sem_ossario)
    contratos = ConcessaoContrato.objects.filter(tumulo__in=tumulos).distinct()
    contratos_ativos = contratos.count()

    # ---------- RESPOSTA ----------
    data = {
        "total_sepultados": total_sepultados,       # TODOS, inclusive Ossário
        "total_tumulos_livres": livres_tumulos,     # sem Ossário
        "total_vagas": vagas_totais,                # sem Ossário
        "contratos_ativos": contratos_ativos,
        "ocupacao": {
            "percentual": percentual,
            "vagas_totais": vagas_totais,
            "vagas_ocupadas": vagas_ocupadas,
            "vagas_livres": vagas_livres,
        },
    }
    return Response(data)

from rest_framework.viewsets import ModelViewSet


