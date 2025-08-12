from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from sepultados_gestao.views import selecionar_prefeitura_ativa, selecionar_cemiterio_ativo
from sepultados_gestao.admin import CustomAdminSite
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from aaa_usuarios.api import CustomTokenObtainPairView
from sepultados_gestao.views_api import ImportQuadrasAPIView, ImportTumulosAPIView, ImportSepultadosAPIView

custom_admin_site = CustomAdminSite(name='custom_admin')
custom_admin_site.register_models()

urlpatterns = [
    path('admin/selecionar-prefeitura/', selecionar_prefeitura_ativa, name='selecionar_prefeitura_ativa'),
    path('admin/selecionar-cemiterio/', selecionar_cemiterio_ativo, name='selecionar_cemiterio_ativo'),
    path('admin/', custom_admin_site.urls),
    path('', include('sepultados_gestao.urls')),
    path('relatorios/', include('relatorios.urls', namespace='relatorios')),
    path('api/', include('sepultados_gestao.urls_api')),
    path('api/relatorios/', include('relatorios.api_urls', namespace='relatorios_api')),
    path("api/usuarios/", include("aaa_usuarios.urls")),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("importar/quadras/", ImportQuadrasAPIView.as_view(), name="importar-quadras-legacy"),
    path("importar/tumulos/", ImportTumulosAPIView.as_view(), name="importar-tumulos-legacy"),
    path("importar/sepultados/", ImportSepultadosAPIView.as_view(), name="importar-sepultados-legacy"),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
