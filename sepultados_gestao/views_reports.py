# sepultados_gestao/views_reports.py
from datetime import datetime
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.conf import settings
from django.db.models import Q

from .models import RegistroAuditoria

# se você já tem helper de PDF (ex.: render_pdf_from_html), pode usar aqui.
try:
    from weasyprint import HTML, CSS
    USE_WEASYPRINT = True
except Exception:
    USE_WEASYPRINT = False


def _parse_date(s):
    if not s:
        return None
    # aceita dd/mm/aaaa e aaaa-mm-dd
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            pass
    return None


def auditorias_pdf(request):
    """
    Gera o PDF de Auditorias, usando o template:
    custom_admin/templates/pdf/relatorio_auditorias.html
    """
    # prefeitura ativa (seu middleware/setter já grava isso na request)
    pref = getattr(request, "prefeitura_ativa", None)
    qs = RegistroAuditoria.objects.select_related("usuario", "prefeitura")
    if pref and getattr(pref, "id", None):
        qs = qs.filter(prefeitura_id=pref.id)

    # não mostra ações de superusuários do backend
    qs = qs.exclude(usuario__is_superuser=True)

    # filtros vindos por GET (mesmos nomes do seu front/admin)
    di = _parse_date(request.GET.get("data_inicio") or "")
    df = _parse_date(request.GET.get("data_fim") or "")
    acao = (request.GET.get("acao") or "").strip().lower()
    usuario = (request.GET.get("usuario") or "").strip()
    entidade = (request.GET.get("entidade") or "").strip().lower()
    q = (request.GET.get("q") or "").strip()

    if di:
        qs = qs.filter(data_hora__date__gte=di)
    if df:
        qs = qs.filter(data_hora__date__lte=df)

    if acao and acao not in ("todas",):
        aliases = {
            "adicao": "adição",
            "criacao": "adição",
            "edicao": "edição",
            "exclusao": "exclusão",
        }
        acao_norm = aliases.get(acao, acao)
        qs = qs.filter(acao__iexact=acao_norm)

    if usuario and usuario.lower() != "todos":
        try:
            qs = qs.filter(usuario_id=int(usuario))
        except Exception:
            qs = qs.filter(usuario__username__iexact=usuario)

    if entidade and entidade not in ("todas",):
        qs = qs.filter(modelo__iexact=entidade)

    if q:
        termo = Q(representacao__icontains=q) | Q(usuario__username__icontains=q) | Q(usuario__email__icontains=q)
        if q.isdigit():
            termo |= Q(objeto_id=int(q))
        qs = qs.filter(termo)

    qs = qs.order_by("-data_hora", "-id")

    # métricas
    def _norm(a):
        a = (a or "").lower()
        if a in ("adicao", "adição", "create", "criação", "criacao", "add"):
            return "adição"
        if a in ("edicao", "edição", "update", "change"):
            return "edição"
        if a in ("exclusao", "exclusão", "delete"):
            return "exclusão"
        if a in ("falha", "fail", "erro", "error"):
            return "falha"
        return a

    total = qs.count()
    add = qs.filter(acao__in=["adição", "adicao", "add", "criação", "criacao", "create"]).count()
    change = qs.filter(acao__in=["edição", "edicao", "change", "update"]).count()
    delete = qs.filter(acao__in=["exclusão", "exclusao", "delete"]).count()
    fail = qs.filter(acao__in=["falha", "fail", "erro", "error"]).count()

    # contexto pro template
    contexto = {
        "prefeitura": pref,
        "cemiterio": getattr(request, "cemiterio_ativo", None),
        "data_inicio": di,
        "data_fim": df,
        "acao": request.GET.get("acao") or "todas",
        "usuario": request.GET.get("usuario") or "todos",
        "entidade": request.GET.get("entidade") or "todas",
        "busca": q,
        "total": total,
        "criacoes": add,
        "atualizacoes": change,
        "exclusoes": delete,
        "falhas": fail,
        "linhas": [
            {
                "data_hora": r.data_hora,
                "usuario": (getattr(r.usuario, "email", None) or getattr(r.usuario, "username", None) or "-"),
                "acao": _norm(r.acao),
                "modelo": r.modelo or "-",
                "objeto_id": r.objeto_id,
                "detalhes": r.representacao or "-",
            }
            for r in qs
        ],
    }

    html = render_to_string("pdf/sepultados_auditorias.html", contexto)


    # Se você já usa outro gerador (ex: xhtml2pdf / render_to_pdf_response), troque aqui.
    if USE_WEASYPRINT:
        pdf = HTML(string=html, base_url=getattr(settings, "BASE_DIR", None)).write_pdf()
        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = 'inline; filename="relatorio_auditorias.pdf"'
        return resp
    else:
        # Fallback: entrega o HTML (útil em desenvolvimento)
        return HttpResponse(html)
