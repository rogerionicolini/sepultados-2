from django.urls import path, include
from sepultados_gestao.views import selecionar_prefeitura_ativa, selecionar_cemiterio_ativo
from sepultados_gestao.admin import CustomAdminSite

custom_admin_site = CustomAdminSite(name='custom_admin')
custom_admin_site.register_models()

urlpatterns = [
    path('admin/selecionar-prefeitura/', selecionar_prefeitura_ativa, name='selecionar_prefeitura_ativa'),
    path('admin/selecionar-cemiterio/', selecionar_cemiterio_ativo, name='selecionar_cemiterio_ativo'),
    path('admin/', custom_admin_site.urls),
    path('', include('sepultados_gestao.urls')),
    path('admin/', include('sepultados_gestao.urls')),
]

from django.conf import settings
from django.conf.urls.static import static

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
