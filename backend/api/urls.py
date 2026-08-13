from django.urls import path
from . import views


urlpatterns = [
    # Chat / Messaging
    path("my-messages/<user_id>/", views.MyInbox.as_view(), name="my-messages"),
    path(
        "get-messages/<sender_id>/<reciever_id>/",
        views.GetMessages.as_view(),
        name="get-messages",
    ),
    path(
        "send-messages/",
        views.SendMessages.as_view(),
        name="send-messages",
    ),

    # Profile
    path(
        "profile/<int:pk>/",
        views.ProfileDetail.as_view(),
        name="profile-detail",
    ),

    # User Search
    path(
        "search/<username>/",
        views.SearchUser.as_view(),
        name="search-user",
    ),
]