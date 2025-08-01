from django.urls import path
from . import views

app_name = "relatorios"

urlpatterns = [
    path("sepultados/", views.relatorio_sepultados, name="relatorio_sepultados"),
    path("sepultados/pdf/", views.relatorio_sepultados_pdf, name="relatorio_sepultados_pdf"),
    path("exumacoes/", views.relatorio_exumacoes, name="relatorio_exumacoes"),
    path("exumacoes/pdf/", views.relatorio_exumacoes_pdf, name="relatorio_exumacoes_pdf"),
    path("translados/", views.relatorio_translados, name="relatorio_translados"),
    path("translados/pdf/", views.relatorio_translados_pdf, name="relatorio_translados_pdf"),
    path("contratos/", views.relatorio_contratos, name="relatorio_contratos"),
    path("contratos/pdf/", views.relatorio_contratos_pdf, name="relatorio_contratos_pdf"),
    path("receitas/", views.relatorio_receitas, name="relatorio_receitas"),
    path("receitas/pdf/", views.relatorio_receitas_pdf, name="relatorio_receitas_pdf"),
    path("tumulos/", views.relatorio_tumulos, name="relatorio_tumulos"),
    path("tumulos/pdf/", views.relatorio_tumulos_pdf, name="relatorio_tumulos_pdf"),
]
