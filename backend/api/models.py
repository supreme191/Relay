from django.db import models
from django.db.models.signals import post_save
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    username = models.CharField(max_length=100)
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def profile(self):
        profile = Profile.objects.get(user=self)


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=1000)
    bio = models.CharField(max_length=100)
    image = models.ImageField(upload_to="user_images", default="default.jpg")
    verified = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self.full_name == "" or self.full_name is None:
            self.full_name = self.user.username
        super(Profile, self).save(*args, **kwargs)


def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()

post_save.connect(create_user_profile, sender=User)
post_save.connect(save_user_profile, sender=User)


# ---------------------------------------------------------------------------
# Chat message (existing - unchanged)
# ---------------------------------------------------------------------------

class ChatMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="user")
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="sender")
    reciever = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="reciever")

    message = models.TextField()
    is_read = models.BooleanField(default=False)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']
        verbose_name_plural = "Message"

    def __str__(self):
        return f"{self.sender} - {self.reciever}"

    @property
    def sender_profile(self):
        return Profile.objects.get(user=self.sender)

    @property
    def reciever_profile(self):
        return Profile.objects.get(user=self.reciever)


# ---------------------------------------------------------------------------
# Relationship
# ---------------------------------------------------------------------------

class Relationship(models.Model):
    """
    One record per unordered user pair.
    user_a.id < user_b.id enforced at app layer (canonical_pair) and DB level.
    """

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_BLOCKED = "blocked"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_BLOCKED, "Blocked"),
    ]

    user_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name="relationships_as_a")
    user_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name="relationships_as_b")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_requests")
    request_message = models.TextField(blank=True, default="")
    blocked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="blocks_initiated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user_a", "user_b")]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(user_a_id__lt=models.F("user_b_id")),
                name="relationship_user_a_lt_user_b",
            )
        ]
        verbose_name_plural = "Relationships"

    def __str__(self):
        return f"{self.user_a} <-> {self.user_b} [{self.status}]"

    @classmethod
    def canonical_pair(cls, user_x, user_y):
        if user_x.id < user_y.id:
            return user_x, user_y
        return user_y, user_x

    @classmethod
    def get_for_users(cls, user_x, user_y):
        a, b = cls.canonical_pair(user_x, user_y)
        try:
            return cls.objects.get(user_a=a, user_b=b)
        except cls.DoesNotExist:
            return None


# ---------------------------------------------------------------------------
# ConversationState  (new)
# ---------------------------------------------------------------------------

class ConversationState(models.Model):
    """
    Per-user conversation preferences for an unordered user pair.
    Canonical ordering: user_a.id < user_b.id (same convention as Relationship).

    This record is independent of Relationship — it persists across unblock
    cycles and does not have a FK to Relationship.

    Flags (all per-user, tracked for each side independently):
      chat_deleted_by_a   — user_a has "deleted" the chat (no longer sees messages)
      chat_deleted_by_b   — user_b has "deleted" the chat
      sidebar_hidden_by_a — user_a has hidden this conversation from their sidebar
      sidebar_hidden_by_b — user_b has hidden this conversation from their sidebar

    When both chat_deleted_by_a and chat_deleted_by_b are True, all ChatMessage
    records for the pair should be permanently deleted by the calling view.
    """

    user_a = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversation_states_as_a",
    )
    user_b = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversation_states_as_b",
    )

    chat_deleted_by_a = models.BooleanField(default=False)
    chat_deleted_by_b = models.BooleanField(default=False)

    sidebar_hidden_by_a = models.BooleanField(default=False)
    sidebar_hidden_by_b = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user_a", "user_b")]
        verbose_name_plural = "Conversation States"

    def __str__(self):
        return f"ConvState({self.user_a_id}, {self.user_b_id})"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @classmethod
    def canonical_pair(cls, user_x, user_y):
        """Return (user_a, user_b) with lower id first."""
        if user_x.id < user_y.id:
            return user_x, user_y
        return user_y, user_x

    @classmethod
    def get_or_create_for_users(cls, user_x, user_y):
        """Return (ConversationState, created) for the pair."""
        a, b = cls.canonical_pair(user_x, user_y)
        return cls.objects.get_or_create(user_a=a, user_b=b)

    @classmethod
    def get_for_users(cls, user_x, user_y):
        """Return the ConversationState or None."""
        a, b = cls.canonical_pair(user_x, user_y)
        try:
            return cls.objects.get(user_a=a, user_b=b)
        except cls.DoesNotExist:
            return None

    def chat_deleted_for(self, user):
        """Return True if this user has deleted the chat."""
        if user.id == self.user_a_id:
            return self.chat_deleted_by_a
        return self.chat_deleted_by_b

    def sidebar_hidden_for(self, user):
        """Return True if this user has hidden this conversation from sidebar."""
        if user.id == self.user_a_id:
            return self.sidebar_hidden_by_a
        return self.sidebar_hidden_by_b

    def set_chat_deleted_for(self, user, value=True):
        """Mark the chat as deleted for the given user and save."""
        if user.id == self.user_a_id:
            self.chat_deleted_by_a = value
        else:
            self.chat_deleted_by_b = value
        self.save(update_fields=[
            "chat_deleted_by_a" if user.id == self.user_a_id else "chat_deleted_by_b",
            "updated_at",
        ])

    def set_sidebar_hidden_for(self, user, value=True):
        """Mark the sidebar as hidden for the given user and save."""
        if user.id == self.user_a_id:
            self.sidebar_hidden_by_a = value
        else:
            self.sidebar_hidden_by_b = value
        self.save(update_fields=[
            "sidebar_hidden_by_a" if user.id == self.user_a_id else "sidebar_hidden_by_b",
            "updated_at",
        ])