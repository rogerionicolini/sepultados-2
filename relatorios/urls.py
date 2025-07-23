from django.urls import path
from . import views

app_name = "relatorios"

urlpatterns = [
    path("sepultados/", views.relatorio_sepultados, name="relatorio_sepultados"),
    path("sepultados/pdf/", views.relatorio_sepultados_pdf, name="relatorio_sepultados_pdf"),
    path("exumacoes/", views.relatorio_exumacoes, name="relatorio_exumacoes"),
    path("exumacoes/pdf/", views.relatorio_exumacoes_pdf, name="relatorio_exumacoes_pdf"),
]
