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
    # Seleção de cemitério (nova)
    selecionar_cemiterio_api,
)

router = DefaultRouter()
router.register(r"cemiterios", CemiterioViewSet)
router.register(r"contratos", ConcessaoContratoViewSet)
router.register(r"exumacoes", ExumacaoViewSet)
router.register(r"quadras", QuadraViewSet)
router.register(r"receitas", ReceitaViewSet)
router.register(r"auditorias", RegistroAuditoriaViewSet)
router.register(r"sepultados", SepultadoViewSet)
router.register(r"traslados", TransladoViewSet)
router.register(r"tumulos", TumuloViewSet)
router.register(r"anexos", AnexoViewSet, basename="anexo")

urlpatterns = [
    path("", include(router.urls)),

    # Diversos
    path("registrar-prefeitura/", RegistrarPrefeituraAPIView.as_view(), name="registrar-prefeitura"),
    path("planos/", ListaPlanosAPIView.as_view(), name="listar-planos"),
    path("licenca/<int:prefeitura_id>/", licenca_da_prefeitura, name="licenca-da-prefeitura"),
    path("verificar-email/<uuid:token>/", verificar_email, name="verificar-email"),
    path("usuario-logado/", usuario_logado, name="usuario-logado"),
    path("prefeitura-logada/", PrefeituraLogadaAPIView.as_view(), name="prefeitura-logada"),
    path("cemiterio-logado/", CemiterioLogadoAPIView.as_view(), name="cemiterio-logado"),

    # Seleciona e grava o cemitério ativo na sessão
    path("selecionar-cemiterio/", selecionar_cemiterio_api, name="selecionar-cemiterio"),

    # Rotas antigas (mantidas)
    path("importacoes/quadras/", ImportQuadrasAPIView.as_view(), name="import-quadras"),
    path("importacoes/tumulos/", ImportTumulosAPIView.as_view(), name="import-tumulos"),
    path("importacoes/sepultados/", ImportSepultadosAPIView.as_view(), name="import-sepultados"),

    # Aliases que o frontend usa
    path("importar/quadras/", ImportQuadrasAPIView.as_view(), name="importar-quadras"),
    path("importar/tumulos/", ImportTumulosAPIView.as_view(), name="importar-tumulos"),
    path("importar/sepultados/", ImportSepultadosAPIView.as_view(), name="importar-sepultados"),

    # CSRF helper
    path("csrf/", csrf_get, name="api_csrf"),
]
