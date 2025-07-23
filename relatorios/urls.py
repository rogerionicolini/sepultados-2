from django.urls import path
from . import views

app_name = "relatorios"

urlpatterns = [
    path("sepultados/", views.relatorio_sepultados, name="relatorio_sepultados"),
    path("sepultados/pdf/", views.relatorio_sepultados_pdf, name="relatorio_sepultados_pdf"),
]
