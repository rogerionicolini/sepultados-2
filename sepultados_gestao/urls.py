from django.urls import path
from . import views
from . import views_backup  # ✅ certifique-se de importar corretamente o novo módulo
from . import views_reports

app_name = 'sepultados_gestao'

urlpatterns = [
    path('contrato/<int:contrato_id>/pdf/', views.gerar_contrato_pdf, name='gerar_contrato_pdf'),

    # Telas administrativas internas
    path('admin/selecionar-prefeitura/', views.selecionar_prefeitura_ativa, name='selecionar_prefeitura_ativa'),
    path('admin/quadras-do-cemiterio/', views.quadras_do_cemiterio, name='quadras_do_cemiterio'),
    path('admin/selecionar-cemiterio/', views.selecionar_cemiterio_ativo, name='selecionar_cemiterio_ativo'),

    # AJAX
    path('admin/obter-tumulo-origem/', views.obter_tumulo_origem, name='obter_tumulo_origem'),

    # Geração de PDFs
    path("pdf/exumacao/<int:pk>/", views.pdf_exumacao, name="pdf_exumacao"),
    path("translado/<int:pk>/guia/", views.pdf_translado, name="pdf_translado"),
    path('sepultado/<int:pk>/guia_sepultamento/', views.gerar_guia_sepultamento_pdf, name='gerar_guia_sepultamento_pdf'),
    path('tumulo/<int:pk>/pdf_sepultados/', views.gerar_pdf_sepultados_tumulo, name='gerar_pdf_sepultados_tumulo'),

    # Importação
    path("importar/quadras/", views.importar_quadras, name="importar_quadras"),
    path("importar/tumulos/", views.importar_tumulos, name="importar_tumulos"),
    path("importar/sepultados/", views.importar_sepultados, name="importar_sepultados"),

    # ✅ Backup
    path("backup/completo/", views_backup.backup_completo, name="backup_completo"),
    path("backup/prefeitura/", views_backup.backup_prefeitura_ativa, name="backup_prefeitura"),
    path("backup/", views_backup.backup_sistema, name="backup_sistema"),

    path("relatorios/auditorias/pdf/", views_reports.auditorias_pdf, name="auditorias_pdf"),
]
