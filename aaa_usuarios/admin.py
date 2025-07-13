from django.contrib import admin
from django.contrib.auth.models import Group, User
from django.contrib.auth.admin import GroupAdmin, UserAdmin

# Remove os registros padrão
admin.site.unregister(User)
admin.site.unregister(Group)

# Registra novamente com o nome do novo app
admin.site.register(User, UserAdmin)
admin.site.register(Group, GroupAdmin)
