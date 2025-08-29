# sepultados_gestao/views_reports.py
from datetime import datetime
import os
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.conf import settings
from django.db.models import Q

from .models import RegistroAuditoria, Prefeitura, Cemiterio

try:
    from weasyprint import HTML
    USE_WEASYPRINT = True
except Exception:
    USE_WEASYPRINT = False


def _parse_date(s):
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            pass
    return None


def _file_uri(path):
    if not path:
        return ""
    if path.startswith("file://"):
        return path
    return "file:///" + path.replace("\\", "/")


def auditorias_pdf(request):
    """
    Usa o template: custom_admin/templates/pdf/sepultados_auditorias.html
    (não renomear)
    """
    # 1) Sessão (backend)
    pref = getattr(request, "prefeitura_ativa", None)
    cem = getattr(request, "cemiterio_ativo", None)

    # 2) Fallback por querystring (?prefeitura= / ?cemiterio=)
    if not pref:
        pref_id = request.GET.get("prefeitura") or request.GET.get("prefeitura_id") or request.GET.get("pref")
        if pref_id:
            try:
                pref = Prefeitura.objects.filter(id=int(pref_id)).first()
            except Exception:
                pref = Prefeitura.objects.filter(id=pref_id).first()

    if not cem:
        cem_id = request.GET.get("cemiterio") or request.GET.get("cemiterio_id") or request.GET.get("cem")
        if cem_id:
            try:
                cem = Cemiterio.objects.filter(id=int(cem_id)).first()
            except Exception:
                cem = Cemiterio.objects.filter(id=cem_id).first()

    # 3) Se houver só cemitério, deduz a prefeitura via FK
    if not pref and cem and hasattr(cem, "prefeitura"):
        try:
            pref = cem.prefeitura
        except Exception:
            pref = None

    # 4) Reforço: tenta pegar do usuário autenticado
    if not pref and getattr(request, "user", None) and request.user.is_authenticated:
        uid = (
            getattr(request.user, "prefeitura_id", None)
            or getattr(getattr(request.user, "prefeitura", None), "id", None)
        )
        if uid:
            pref = Prefeitura.objects.filter(id=uid).first()

    # ----------------- Query base (sem filtro de prefeitura ainda) -----------------
    di = _parse_date(request.GET.get("data_inicio") or "")
    df = _parse_date(request.GET.get("data_fim") or "")
    acao_f = (request.GET.get("acao") or "").strip().lower()
    usuario_f = (request.GET.get("usuario") or "").strip()
    entidade_f = (request.GET.get("entidade") or "").strip().lower()
    busca = (request.GET.get("q") or "").strip()

    qs = RegistroAuditoria.objects.select_related("usuario", "prefeitura")
    qs = qs.exclude(usuario__is_superuser=True)

    if di:
        qs = qs.filter(data_hora__date__gte=di)
    if df:
        qs = qs.filter(data_hora__date__lte=df)

    if acao_f and acao_f != "todas":
        aliases = {"adicao": "adição", "criacao": "adição", "edição": "edição", "exclusao": "exclusão"}
        qs = qs.filter(acao__iexact=aliases.get(acao_f, acao_f))

    if usuario_f and usuario_f.lower() != "todos":
        try:
            qs = qs.filter(usuario_id=int(usuario_f))
        except Exception:
            qs = qs.filter(Q(usuario__username__iexact=usuario_f) | Q(usuario__email__iexact=usuario_f))

    if entidade_f and entidade_f != "todas":
        qs = qs.filter(modelo__iexact=entidade_f)

    if busca:
        termo = Q(representacao__icontains=busca) | Q(usuario__username__icontains=busca) | Q(usuario__email__icontains=busca)
        if busca.isdigit():
            termo |= Q(objeto_id=int(busca))
        qs = qs.filter(termo)
    # -----------------------------------------------------------------------------

    # 5) Se ainda não temos prefeitura, tente deduzir:
    #    (a) única prefeitura nos registros filtrados
    #    (b) primeira prefeitura do banco como último recurso
    if not pref:
        pids = list(qs.values_list("prefeitura_id", flat=True).distinct())
        pids = [p for p in pids if p is not None]
        if len(pids) == 1:
            pref = Prefeitura.objects.filter(id=pids[0]).first()
        if not pref:
            pref = Prefeitura.objects.order_by("id").first()

    # 6) Com a prefeitura definida, filtramos o queryset por ela (quando existir)
    if pref and getattr(pref, "id", None):
        qs = qs.filter(prefeitura_id=pref.id)

    qs = qs.order_by("-data_hora", "-id")

    # ---------------------------- Métricas e linhas -------------------------------
    total = qs.count()
    criacoes = qs.filter(acao__in=["adição", "adicao", "add", "criação", "criacao", "create"]).count()
    atualizacoes = qs.filter(acao__in=["edição", "edicao", "change", "update"]).count()
    exclusoes = qs.filter(acao__in=["exclusão", "exclusao", "delete"]).count()
    falhas = qs.filter(acao__in=["falha", "fail", "erro", "error"]).count()

    def norm(a):
        a = (a or "").lower()
        if a in ("adicao", "adição", "add", "create", "criação", "criacao"):
            return "Adição"
        if a in ("edicao", "edição", "update", "change"):
            return "Edição"
        if a in ("exclusao", "exclusão", "delete"):
            return "Exclusão"
        if a in ("falha", "fail", "erro", "error"):
            return "Falha"
        return a or "-"

    linhas = [{
        "data_hora": r.data_hora,
        "usuario": getattr(r.usuario, "email", None) or getattr(r.usuario, "username", None) or "-",
        "acao": norm(r.acao),
        "modelo": r.modelo or "-",
        "objeto_id": r.objeto_id,
        "detalhes": r.representacao or "-",
    } for r in qs]
    # -----------------------------------------------------------------------------

    # ------------------------------ Cabeçalho (UI) --------------------------------
    brasao_uri = ""
    if pref and getattr(pref, "brasao", None):
        try:
            brasao_uri = _file_uri(pref.brasao.path)
        except Exception:
            try:
                brasao_uri = _file_uri(os.path.join(settings.MEDIA_ROOT, pref.brasao.name))
            except Exception:
                brasao_uri = ""

    # Nome (cemitério se existir; senão, prefeitura)
    org_nome = (getattr(cem, "nome", None) or getattr(pref, "nome", None) or "")

    # Endereço (da prefeitura)
    def g(obj, attr):
        return getattr(obj, attr, None) if obj else None

    org_end_l1 = ", ".join([x for x in [g(pref, "logradouro"), g(pref, "endereco_numero")] if x]) or ""
    cidade = g(pref, "endereco_cidade")
    uf = g(pref, "endereco_estado")
    linha_cidade = f"{cidade} – {uf}" if cidade and uf else (cidade or uf or "")
    org_end_l2 = "  ".join([x for x in [g(pref, "endereco_bairro"), linha_cidade] if x]) or ""
    org_cep = g(pref, "endereco_cep")
    # -----------------------------------------------------------------------------

    contexto = {
        # cabeçalho
        "org_nome": org_nome,
        "org_end_l1": org_end_l1,
        "org_end_l2": org_end_l2,
        "org_cep": org_cep,
        "brasao_uri": brasao_uri,
        "org_titulo": "Relatório de Auditorias",

        # filtros/contadores
        "data_inicio": di,
        "data_fim": df,
        "acao_filtro": request.GET.get("acao") or "todas",
        "usuario_filtro": request.GET.get("usuario") or "todos",
        "entidade_filtro": request.GET.get("entidade") or "todas",
        "busca": busca or "-",

        "total": total,
        "criacoes": criacoes,
        "atualizacoes": atualizacoes,
        "exclusoes": exclusoes,
        "falhas": falhas,

        # dados
        "linhas": linhas,
    }

    html = render_to_string("pdf/sepultados_auditorias.html", contexto)

    if USE_WEASYPRINT:
        pdf = HTML(string=html, base_url=getattr(settings, "BASE_DIR", None)).write_pdf()
        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = 'inline; filename="relatorio_auditorias.pdf"'
        return resp
    else:
        return HttpResponse(html)
