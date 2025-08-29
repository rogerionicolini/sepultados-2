# sepultados_gestao/urls_api.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views_api import (
    csrf_get,
    # viewsets
    CemiterioViewSet,
    ConcessaoContratoViewSet,
    ExumacaoViewSet,
    QuadraViewSet,
    ReceitaViewSet,
    RegistroAuditoriaViewSet,
    SepultadoViewSet,
    TransladoViewSet,
    TumuloViewSet,
    AnexoViewSet,
    # APIs diversas
    RegistrarPrefeituraAPIView,
    ListaPlanosAPIView,
    licenca_da_prefeitura,
    verificar_email,
    usuario_logado,
    PrefeituraLogadaAPIView,
    CemiterioLogadoAPIView,
    # Importações
    ImportQuadrasAPIView,
    ImportTumulosAPIView,
    ImportSepultadosAPIView,
    # Seleção cemitério
    selecionar_cemiterio_api,
    # PDF auditorias (retorna URL)
    auditorias_pdf_url,
    # ✅ BACKUP (API)
    backup_prefeitura_api,
)

router = DefaultRouter()
router.register(r"cemiterios", CemiterioViewSet)
router.register(r"contratos", ConcessaoContratoViewSet, basename="contratos")
router.register(r"exumacoes", ExumacaoViewSet)
router.register(r"quadras", QuadraViewSet)
router.register(r"receitas", ReceitaViewSet)
router.register(r"auditorias", RegistroAuditoriaViewSet)
router.register(r"sepultados", SepultadoViewSet)
router.register(r"traslados", TransladoViewSet, basename="traslados")
router.register(r"tumulos", TumuloViewSet)
router.register(r"anexos", AnexoViewSet, basename="anexo")

urlpatterns = [
    # rotas “soltas” antes do router
    path("auditorias/pdf-url/", auditorias_pdf_url, name="auditorias-pdf-url"),

    # ✅ NOVO: backup por prefeitura (não depende do backend estar logado)
    path("backup/prefeitura/", backup_prefeitura_api, name="backup-prefeitura"),

    # viewsets
    path("", include(router.urls)),

    # diversos
    path("registrar-prefeitura/", RegistrarPrefeituraAPIView.as_view(), name="registrar-prefeitura"),
    path("planos/", ListaPlanosAPIView.as_view(), name="listar-planos"),
    path("licenca/<int:prefeitura_id>/", licenca_da_prefeitura, name="licenca-da-prefeitura"),
    path("verificar-email/<uuid:token>/", verificar_email, name="verificar-email"),
    path("usuario-logado/", usuario_logado, name="usuario-logado"),
    path("prefeitura-logada/", PrefeituraLogadaAPIView.as_view(), name="prefeitura-logada"),
    path("cemiterio-logado/", CemiterioLogadoAPIView.as_view(), name="cemiterio-logado"),

    # selecionar cemitério (grava em sessão)
    path("selecionar-cemiterio/", selecionar_cemiterio_api, name="selecionar-cemiterio"),

    # importações
    path("importacoes/quadras/", ImportQuadrasAPIView.as_view(), name="import-quadras"),
    path("importacoes/tumulos/", ImportTumulosAPIView.as_view(), name="import-tumulos"),
    path("importacoes/sepultados/", ImportSepultadosAPIView.as_view(), name="import-sepultados"),
    path("importar/quadras/", ImportQuadrasAPIView.as_view(), name="importar-quadras"),
    path("importar/tumulos/", ImportTumulosAPIView.as_view(), name="importar-tumulos"),
    path("importar/sepultados/", ImportSepultadosAPIView.as_view(), name="importar-sepultados"),

    # CSRF helper
    path("csrf/", csrf_get, name="api_csrf"),
]
