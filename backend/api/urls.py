from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # ---- Auth ----
    path("register/", views.RegisterView.as_view(), name="register"),
    path("token/", views.MyTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # ---- Messages (existing) ----
    path("my-messages/<user_id>/", views.MyInbox.as_view(), name="my-messages"),
    path("get-messages/<sender_id>/<reciever_id>/", views.GetMessages.as_view(), name="get-messages"),
    path("send-messages/", views.SendMessages.as_view(), name="send-messages"),
    path("messages/read/<int:other_user_id>/", views.MarkAsRead.as_view(), name="mark-as-read"),

    # ---- Profile / Search (existing) ----
    path("profile/<int:pk>/", views.ProfileDetail.as_view(), name="profile-detail"),
    path("search/<username>/", views.SearchUser.as_view(), name="search-user"),

    # ---- Relationships (new) ----
    path("relationship/<int:other_user_id>/", views.RelationshipStatus.as_view(), name="relationship-status"),
    path("relationship/request/", views.SendChatRequest.as_view(), name="send-chat-request"),
    path("relationship/requests/incoming/", views.IncomingRequests.as_view(), name="incoming-requests"),
    path("relationship/<int:relationship_id>/accept/", views.AcceptRequest.as_view(), name="accept-request"),
    path("relationship/block/", views.BlockUser.as_view(), name="block-user"),
    path("relationship/unblock/", views.UnblockUser.as_view(), name="unblock-user"),
    path("relationship/blocked/", views.BlockedUsers.as_view(), name="blocked-users"),
]