from django.urls import path, include
from rest_framework import routers
from .views_api import (
    CemiterioViewSet,
    ConcessaoContratoViewSet,
    ExumacaoViewSet,
    QuadraViewSet,
    ReceitaViewSet,
    RegistroAuditoriaViewSet,
    SepultadoViewSet,
    TransladoViewSet,
    TumuloViewSet,
    RegistrarPrefeituraAPIView,
    ListaPlanosAPIView,
    licenca_da_prefeitura,
    verificar_email
)

router = routers.DefaultRouter()
router.register(r'cemiterios', CemiterioViewSet)
router.register(r'contratos', ConcessaoContratoViewSet)
router.register(r'exumacoes', ExumacaoViewSet)
router.register(r'quadras', QuadraViewSet)
router.register(r'receitas', ReceitaViewSet)
router.register(r'auditorias', RegistroAuditoriaViewSet)
router.register(r'sepultados', SepultadoViewSet)
router.register(r'traslados', TransladoViewSet)
router.register(r'tumulos', TumuloViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('registrar-prefeitura/', RegistrarPrefeituraAPIView.as_view(), name='registrar-prefeitura'),  # ✅ adicione aqui
    path("planos/", ListaPlanosAPIView.as_view(), name="listar-planos"),
    path("licenca/<int:prefeitura_id>/", licenca_da_prefeitura, name="licenca-da-prefeitura"),
    path("verificar-email/<uuid:token>/", verificar_email, name="verificar-email"),
]

