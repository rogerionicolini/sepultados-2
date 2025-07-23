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
]
