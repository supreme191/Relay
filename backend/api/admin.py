from django.contrib import admin
from api.models import User, Profile, ChatMessage, Relationship, ConversationState


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


class ConversationStateAdmin(admin.ModelAdmin):
    list_display = ['user_a', 'user_b', 'chat_deleted_by_a', 'chat_deleted_by_b', 'sidebar_hidden_by_a', 'sidebar_hidden_by_b']
    readonly_fields = ['created_at', 'updated_at']


admin.site.register(User, UserAdmin)
admin.site.register(Profile, ProfileAdmin)
admin.site.register(ChatMessage, ChatMessageAdmin)
admin.site.register(Relationship, RelationshipAdmin)
admin.site.register(ConversationState, ConversationStateAdmin)