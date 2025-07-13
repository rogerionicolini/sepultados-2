from django.contrib import admin
from django.contrib.auth.models import Group, User
from django.contrib.auth.admin import GroupAdmin, UserAdmin

# Protege contra erro se não estiver registrado ainda
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass

try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass

admin.site.register(User, UserAdmin)
admin.site.register(Group, GroupAdmin)
