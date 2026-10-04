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
    user_a.id < user_b.id is enforced at both the application layer
    (canonical_pair helper) and the database layer (CheckConstraint).

    Status lifecycle:
        none    (no record exists)
        pending -> accepted
        pending -> blocked   (only the RECIPIENT may block a pending request)
        accepted -> blocked  (either participant may block)
        none -> blocked      (proactive block of a stranger)
        blocked -> none      (unblock: only blocked_by may call; record deleted)
    """

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_BLOCKED = "blocked"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_BLOCKED, "Blocked"),
    ]

    # Canonical ordering: user_a.id < user_b.id (enforced by app + DB constraint)
    user_a = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="relationships_as_a",
    )
    user_b = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="relationships_as_b",
    )

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )

    # The user who sent the original chat request.
    # For proactive blocks (NONE -> BLOCKED) this is the blocker.
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_requests",
    )

    # The initial message sent with the request.
    # Stored here; copied into ChatMessage on accept (exactly once).
    request_message = models.TextField(blank=True, default="")

    # Set when status=blocked; null otherwise.
    blocked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="blocks_initiated",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Application-enforced: canonical_pair() always places lower id in user_a.
        # DB-enforced uniqueness: only one record per unordered pair.
        unique_together = [("user_a", "user_b")]
        # DB-level check: user_a_id must be strictly less than user_b_id.
        # Supported on MySQL >= 8.0.16 and all modern Postgres/SQLite versions.
        constraints = [
            models.CheckConstraint(
                condition=models.Q(user_a_id__lt=models.F("user_b_id")),
                name="relationship_user_a_lt_user_b",
            )
        ]
        verbose_name_plural = "Relationships"

    def __str__(self):
        return f"{self.user_a} <-> {self.user_b} [{self.status}]"

    # ------------------------------------------------------------------
    # Class-level helpers
    # ------------------------------------------------------------------

    @classmethod
    def canonical_pair(cls, user_x, user_y):
        """Return (user_a, user_b) with lower id first."""
        if user_x.id < user_y.id:
            return user_x, user_y
        return user_y, user_x

    @classmethod
    def get_for_users(cls, user_x, user_y):
        """Return the Relationship between user_x and user_y, or None."""
        a, b = cls.canonical_pair(user_x, user_y)
        try:
            return cls.objects.get(user_a=a, user_b=b)
        except cls.DoesNotExist:
            return None