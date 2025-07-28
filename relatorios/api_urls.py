from django.urls import path
from . import api_views

app_name = 'relatorios_api'

urlpatterns = [
    path('sepultados/', api_views.relatorio_sepultados_api, name='relatorio_sepultados_api'),
    path('exumacoes/', api_views.relatorio_exumacoes_api, name='relatorio_exumacoes_api'),
    path('translados/', api_views.relatorio_translados_api, name='relatorio_translados_api'),
    path('contratos/', api_views.relatorio_contratos_api, name='relatorio_contratos_api'),
    path('receitas/', api_views.relatorio_receitas_api, name='relatorio_receitas_api'),
    path('tumulos/', api_views.relatorio_tumulos_api, name='relatorio_tumulos_api'),
]
