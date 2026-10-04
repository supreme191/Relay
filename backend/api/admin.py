from django.contrib import admin
from api.models import User, Profile, ChatMessage, Relationship


class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email']


class ProfileAdmin(admin.ModelAdmin):
    list_editable = ['verified']
    list_display = ['user', 'full_name', 'verified']


class ChatMessageAdmin(admin.ModelAdmin):
    list_editable = ['is_read', 'message']
    list_display = ['user', 'sender', 'reciever', 'is_read', 'message']


class RelationshipAdmin(admin.ModelAdmin):
    list_display = ['user_a', 'user_b', 'status', 'requested_by', 'blocked_by', 'created_at']
    list_filter = ['status']
    readonly_fields = ['created_at', 'updated_at']


admin.site.register(User, UserAdmin)
admin.site.register(Profile, ProfileAdmin)
admin.site.register(ChatMessage, ChatMessageAdmin)
admin.site.register(Relationship, RelationshipAdmin)