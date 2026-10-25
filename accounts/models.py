from django.conf import settings
from django.db import models, transaction

# Create your models here.

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class CommonModel(models.Model):
    entry_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_entries"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


from django.db import models, transaction
from django.db.models import Max


class Member(CommonModel):
    moholla_choice = [
        ('01', 'Fakirbari'),
        ('02', 'Borobari'),
        ('03', 'Horinatola'),
        ('04', 'Rosulpur'),
        ('05', 'Chanpur'),
    ]
    legacy_village_codes = {
        "fakirbari": "01",
        "borobari": "02",
        "horinatola": "03",
        "khalishpur": "04",
        "rosulpur": "04",
        "chanpur": "05",
    }

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="mosque_members"
    )
    member_picture = models.ImageField(
        upload_to="member_pictures/", blank=True, null=True
    )

    # 🔑 AutoField → CharField
    member_id = models.CharField(
        max_length=20,
        primary_key=True,
        unique=True,
        editable=False,
        blank=True,
    )

    member_name  = models.CharField(max_length=150)
    Father_name  = models.CharField(max_length=150)
    member_phone = models.CharField(max_length=20)
    village = models.CharField(
        max_length=150,
        choices=moholla_choice,
        default="01",
    )
    member_type = models.CharField(max_length=50)

    # ---------- ID generate ----------
    def generate_member_id(self):
        village_code = self.legacy_village_codes.get(
            self.village,
            self.village if self.village in dict(self.moholla_choice) else None,
        )
        if village_code is None:
            raise ValueError(f"Unsupported village value: {self.village!r}")

        village_values = [
            value
            for value, _label in self.moholla_choice
            if value == village_code
        ]
        village_values.extend(
            legacy_value
            for legacy_value, code in self.legacy_village_codes.items()
            if code == village_code
        )

        # টেবিল লক – concurrent save-এ duplicate হলে আটকাবে
        Member.objects.select_for_update().values_list('pk', flat=True).exists()

        total         = Member.objects.count() + 1
        village_total = Member.objects.filter(village__in=village_values).count() + 1

        return f"{total:05d}-{village_code}-{village_total:04d}"

    def save(self, *args, **kwargs):
        is_new = self._state.adding

        with transaction.atomic():
            if is_new and not self.member_id:
                self.member_id = self.generate_member_id()

            super().save(*args, **kwargs)

            if is_new:
                Member_profile.objects.create(member=self)

    def __str__(self):
        return self.member_name  

    
     
    


from django.db import models
from django.utils import timezone


class Donation(CommonModel):
    PAID_CHOICE = [
        ('cash',   'Cash'),
        ('bkash',  'Bkash'),
        ('nagad',  'Nagad'),
        ('rocket', 'Rocket'),
    ]

    donation_id = models.AutoField(primary_key=True)

    receit_id = models.ForeignKey(
    'Receitbook',
    on_delete=models.PROTECT,    # ✅ Receipt ব্যবহার হলে delete আটকাবে
    null=True,
    blank=False,
    related_name="donations",
    )
    member = models.ForeignKey(
        'Member', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="donations"
    )

    donation_category = models.ForeignKey(
        'DonationCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="donations",
    )

    donation_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
    )
    
    paid_by = models.CharField(
        max_length=10,
        choices=PAID_CHOICE,
        default='cash',
    )

    donation_date = models.DateField(default=timezone.localdate)

    year_id = models.ForeignKey(
        'DonationYear',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="donations",
    )

    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Donation #{self.donation_id} - {self.donation_amount} ({self.paid_by})"



class DonationCategory(CommonModel):
    category_id = models.AutoField(primary_key=True)
    category_name = models.CharField(max_length=150, unique=True)

    status = models.BooleanField(default=True)

    def __str__(self):
        return self.category_name

    class Meta:
        db_table = "donation_category"
        ordering = ["category_name"]


class DonationYear(CommonModel):
    year_id = models.AutoField(primary_key=True)
    year_name = models.CharField(max_length=50, unique=True)
    status = models.BooleanField(default=True)

    def __str__(self):
        return self.year_name

    class Meta:
        db_table = "donation_year"
        ordering = ["-year_name"] 



from django.db import models
from django.contrib.auth.models import User


class UserProfile(CommonModel):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("manager", "Manager"),
        ("assistance", "Assistance"),
        ("member", "Member"),
        ("viewer", "Viewer"),
    ]

    profile_id = models.AutoField(primary_key=True)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_profile"
    )
    member_profile = models.ForeignKey(
        "Member_profile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_profiles",
    )
    village_selected_id = models.JSONField(default=list, blank=True)
    user_picture = models.ImageField(
        upload_to="user_pictures/",
        blank=True,
        null=True
    )
    user_role = models.CharField(
        max_length=50,
        choices=ROLE_CHOICES,
        default="member"
    )

    status = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user} - {self.user_role}"

    class Meta:
        db_table = "user_profile"



from django.db import models
from datetime import date


class Member_profile(models.Model):

    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]

    MARITAL_STATUS_CHOICES = [
        ('unmarried', 'Unmarried'),
        ('married', 'Married'),
        ('divorced', 'Divorced'),
        ('widowed', 'Widowed'),
    ]

    PRESENT_STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    AGE_CHOICES = [
        ('adult', 'Adult'),
        ('senior', 'Senior'),
        ('old', 'Old'),
    ]

    member = models.ForeignKey(
        'member',
        on_delete=models.CASCADE,
        related_name='member_profiles'
    )

    village_selected_id = models.JSONField(default=list, blank=True)

    birth_date = models.DateField(blank=True, null=True)

    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,       
        default='male'
    )

    status = models.CharField(
        max_length=20,
        choices=PRESENT_STATUS_CHOICES,
        default='active'
    )

    age_status = models.CharField(
        max_length=20,
        choices=AGE_CHOICES,
        default='adult'
    )

    maritus_status = models.CharField(
        max_length=20,
        choices=MARITAL_STATUS_CHOICES,
        default='married'
    )

    def calculate_age(self):
        today = date.today()

        return (
            today.year - self.birth_date.year
            - (
                (today.month, today.day)
                < (self.birth_date.month, self.birth_date.day)
            )
        )

    def save(self, *args, **kwargs):
        if self.status == 'active' and self.birth_date is not None:
            age = self.calculate_age()

            if age >= 60:
                self.age_status = 'old'
            elif age >= 50:
                self.age_status = 'senior'
            else:
                self.age_status = 'adult'

        super().save(*args, **kwargs)

    def __str__(self):
        return str(self.member)





from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.db import IntegrityError


class Receitbook(CommonModel):  # ✅ এখানে CommonModel ইনহেরিট করুন
    recet_status_choices = [
        ('unused',   'Unused'),
        ('used',     'Used'),
        ('Rejected', 'Rejected'),
    ]

    prefix       = models.CharField(max_length=10, default='RCPT')
    start_number = models.PositiveIntegerField(default=1)
    end_number   = models.PositiveIntegerField(default=100)

    for_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=False,
        related_name="receitbooks",
    )

    receit_status = models.CharField(
        max_length=20,
        choices=recet_status_choices,
        default='unused',
    )

    receit_id = models.CharField(
        max_length=30,
        primary_key=True,
        unique=True,
        editable=False,
        blank=True,
    )

    description = models.TextField(blank=True, null=True)

    # ---------- helper ----------
    def generate_receit_id(self):
        """
        Format: {for_user.id:04d}-{prefix}{start_number:04d}-{end_number:04d}
        Example: 0005-RCPT0001-0100
        """
        if self.for_user_id is None:
            raise ValidationError(
                "`for_user` must be set before generating `receit_id`."
            )
        if self.start_number > self.end_number:
            raise ValidationError(
                "start_number cannot be greater than end_number."
            )

        return (
            f"{self.for_user_id:04d}-"
            f"{self.prefix}{self.start_number:04d}-"
            f"{self.end_number:04d}"
        )

    # ---------- clean ----------
    def clean(self):
        super().clean()
        if self.start_number > self.end_number:
            raise ValidationError(
                {"end_number": "end_number must be >= start_number."}
            )

    # ---------- save ----------
    def save(self, *args, **kwargs):
        is_new = self._state.adding

        with transaction.atomic():
            if is_new and not self.receit_id:
                self.receit_id = self.generate_receit_id()

            try:
                super().save(*args, **kwargs)
            except IntegrityError:
                raise ValidationError(
                    f"Receitbook with id {self.receit_id} already exists."
                )

    def __str__(self):
        return f"Receit {self.receit_id}"



















