from django.urls import path
from . import views

app_name = 'sepultados_gestao'

urlpatterns = [
    path('contrato/<int:contrato_id>/pdf/', views.gerar_contrato_pdf, name='gerar_contrato_pdf'),
    
    # Telas administrativas internas
    path('admin/selecionar-prefeitura/', views.selecionar_prefeitura_ativa, name='selecionar_prefeitura_ativa'),
    path('admin/quadras-do-cemiterio/', views.quadras_do_cemiterio, name='quadras_do_cemiterio'),
    path('admin/selecionar-cemiterio/', views.selecionar_cemiterio_ativo, name='selecionar_cemiterio_ativo'),
    
    # AJAX
    path('admin/obter-tumulo-origem/', views.obter_tumulo_origem, name='obter_tumulo_origem'),

    # Geração de PDFs para exumação e translado
    path("pdf/exumacao/<int:pk>/", views.pdf_exumacao, name="pdf_exumacao"),
    path("pdf/translado/<int:pk>/", views.pdf_translado, name="pdf_translado"),
    path('sepultado/<int:pk>/guia_sepultamento/', views.gerar_guia_sepultamento_pdf, name='gerar_guia_sepultamento_pdf'),
]
