import json

from django.db import transaction
from rest_framework import serializers

from .models import (
    Donation,
    DonationCategory,
    DonationYear,
    Member,
    Member_profile,
    Receitbook,
    UserProfile,
)


VILLAGE_SELECTION_CHOICES = [
    *Member.moholla_choice,
    ("fakirbari", "Fakirbari"),
    ("borobari", "Borobari"),
    ("horinatola", "Horinatola"),
    ("khalishpur", "Rosulpur"),
    ("chanpur", "Chanpur"),
]


def get_user_village_access(user):
    try:
        return user.user_profile.village_selected_id
    except UserProfile.DoesNotExist:
        return []


class MemberProfileSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    member = serializers.CharField(source="member_id", read_only=True)
    age = serializers.SerializerMethodField()
    village_selected_id = serializers.ListField(
        child=serializers.ChoiceField(choices=VILLAGE_SELECTION_CHOICES),
        required=False,
    )

    class Meta:
        model = Member_profile
        fields = [
            "id",
            "member",
            "birth_date",
            "age",
            "gender",
            "status",
            "age_status",
            "maritus_status",
            "village_selected_id",
        ]

    def get_age(self, obj):
        return obj.calculate_age() if obj.birth_date else None


class MemberSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="member_id", read_only=True)
    user_id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(source="member_name")
    mobile_no = serializers.CharField(source="member_phone")
    village = serializers.ChoiceField(choices=VILLAGE_SELECTION_CHOICES)
    member_profiles = MemberProfileSerializer(many=True, required=False)

    class Meta:
        model = Member
        fields = [
            "id",
            "user_id",
            "member_picture",
            "name",
            "mobile_no",
            "Father_name",
            "village",
            "member_type",
            "entry_by",
            "created_at",
            "updated_at",
            "member_profiles",
        ]
        read_only_fields = [
            "id",
            "user_id",
            "entry_by",
            "created_at",
            "updated_at",
        ]

    @transaction.atomic
    def create(self, validated_data):
        profiles_data = validated_data.pop("member_profiles", [])
        member = super().create(validated_data)
        profiles = list(member.member_profiles.all())

        for index, profile_data in enumerate(profiles_data):
            profile_id = profile_data.pop("id", None)
            if profile_id is not None:
                raise serializers.ValidationError(
                    {"member_profiles": "Profile IDs cannot be supplied when creating a member."}
                )
            if index == 0 and profiles:
                profile = profiles[0]
                for field, value in profile_data.items():
                    setattr(profile, field, value)
                profile.save()
            else:
                Member_profile.objects.create(member=member, **profile_data)

        return member

    @transaction.atomic
    def update(self, instance, validated_data):
        profiles_data = validated_data.pop("member_profiles", None)
        member = super().update(instance, validated_data)

        if profiles_data is None:
            return member

        existing_profiles = {
            profile.pk: profile
            for profile in member.member_profiles.all()
        }
        for profile_data in profiles_data:
            profile_id = profile_data.pop("id", None)
            if profile_id is None:
                Member_profile.objects.create(member=member, **profile_data)
                continue

            profile = existing_profiles.get(profile_id)
            if profile is None:
                raise serializers.ValidationError(
                    {
                        "member_profiles": (
                            f"Profile {profile_id} does not belong to member {member.pk}."
                        )
                    }
                )
            for field, value in profile_data.items():
                setattr(profile, field, value)
            profile.save()

        return member


from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

class DonationCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DonationCategory
        fields = [
            "category_id",
            "category_name",
            "status",
            "entry_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["category_id", "entry_by", "created_at", "updated_at"]


class DonationYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonationYear
        fields = [
            "year_id",
            "year_name",
            "status",
            "entry_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["year_id", "entry_by", "created_at", "updated_at"]


class ReceitbookSerializer(serializers.ModelSerializer):
    for_user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    for_user_username = serializers.CharField(
        source="for_user.username",
        read_only=True,
    )

    class Meta:
        model = Receitbook
        fields = [
            "receit_id",
            "for_user",
            "for_user_username",
            "prefix",
            "start_number",
            "end_number",
            "receit_status",
            "description",
            "entry_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "receit_id",
            "for_user_username",
            "entry_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        start_number = attrs.get(
            "start_number",
            self.instance.start_number if self.instance else None,
        )
        end_number = attrs.get(
            "end_number",
            self.instance.end_number if self.instance else None,
        )
        if (
            start_number is not None
            and end_number is not None
            and start_number > end_number
        ):
            raise serializers.ValidationError(
                {"end_number": "end_number must be >= start_number."}
            )
        return attrs


# accounts/serializers.py
from rest_framework import serializers
from .models import Donation

class DonationSerializer(serializers.ModelSerializer):
    # ✅ নামগুলো রিটার্ন করার জন্য এই লাইনগুলো যোগ করুন
    category_name = serializers.CharField(source='donation_category.category_name', read_only=True)
    year_name = serializers.CharField(source='year_id.year_name', read_only=True)
    member_name = serializers.CharField(source='member.member_name', read_only=True)   
    

    class Meta:
        model = Donation
        fields = '__all__'


class UserIdOrUsernameField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if isinstance(data, str) and not data.isdecimal():
            try:
                return self.get_queryset().get(username=data)
            except User.DoesNotExist as error:
                raise serializers.ValidationError(
                    f'No user with username "{data}" exists. Register or create '
                    "the user account before adding its profile."
                ) from error

        return super().to_internal_value(data)


class UserIsStaffField(serializers.Field):
    def get_attribute(self, instance):
        return instance.user

    def to_representation(self, user):
        return user.is_staff

    def to_internal_value(self, data):
        return serializers.BooleanField().run_validation(data)


class UserEmailField(serializers.Field):
    def get_attribute(self, instance):
        return instance.user

    def get_value(self, dictionary):
        if self.field_name in dictionary:
            return dictionary.get(self.field_name)
        return super().get_value(dictionary)

    def to_representation(self, user):
        return user.email

    def to_internal_value(self, data):
        return serializers.EmailField(allow_blank=True).run_validation(data)


class UserProfileVillageSelectionField(serializers.Field):
    def get_attribute(self, instance):
        return instance

    def to_representation(self, profile):
        return profile.village_selected_id

    def to_internal_value(self, data):
        if isinstance(data, str):
            if not data:
                return []
            try:
                data = json.loads(data)
            except json.JSONDecodeError as error:
                raise serializers.ValidationError(
                    "Village selections must be a JSON list."
                ) from error
        return serializers.ListField(
            child=serializers.ChoiceField(choices=VILLAGE_SELECTION_CHOICES)
        ).run_validation(data)


def get_user_member_profile(profile):
    if profile.member_profile_id:
        return profile.member_profile

    for member in sorted(profile.user.mosque_members.all(), key=lambda item: item.pk):
        member_profiles = sorted(member.member_profiles.all(), key=lambda item: item.pk)
        if member_profiles:
            return member_profiles[0]
    return None


class UserProfileMemberProfileField(serializers.PrimaryKeyRelatedField):
    def get_attribute(self, instance):
        return instance

    def to_representation(self, profile):
        member_profile = get_user_member_profile(profile)
        return member_profile.pk if member_profile else None


class MemberProfileSelectionField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if data == "":
            return None
        return super().to_internal_value(data)


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = UserEmailField(required=False)
    is_staff = UserIsStaffField(required=False)
    member_profile = UserProfileMemberProfileField(read_only=True)
    village_selected_id = UserProfileVillageSelectionField(required=False)

    # Use an existing Django User's ID when creating/updating a profile.
    user = UserIdOrUsernameField(queryset=User.objects.all())

    class Meta:
        model = UserProfile
        fields = [
            "profile_id",
            "user",
            "username",
            "email",
            "is_staff",
            "user_picture",
            "user_role",
            "status",
            "member_profile",
            "village_selected_id",
            "entry_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "profile_id",
            "member_profile",
            "entry_by",
            "created_at",
            "updated_at",
        ]

    @transaction.atomic
    def create(self, validated_data):
        is_staff = validated_data.pop("is_staff", None)
        email = validated_data.pop("email", None)
        village_selected_id = validated_data.pop(
            "village_selected_id", serializers.empty
        )
        profile = super().create(validated_data)
        if village_selected_id is not serializers.empty:
            profile.village_selected_id = village_selected_id
            profile.save(update_fields=["village_selected_id"])
            member_profile = get_user_member_profile(profile)
            if member_profile is not None:
                if profile.member_profile_id is None:
                    profile.member_profile = member_profile
                    profile.save(update_fields=["member_profile"])
                member_profile.village_selected_id = village_selected_id
                member_profile.save(update_fields=["village_selected_id"])
        user_fields = []
        if is_staff is not None and profile.user.is_staff != is_staff:
            profile.user.is_staff = is_staff
            user_fields.append("is_staff")
        if email is not None and profile.user.email != email:
            profile.user.email = email
            user_fields.append("email")
        if user_fields:
            profile.user.save(update_fields=user_fields)
        return profile

    @transaction.atomic
    def update(self, instance, validated_data):
        is_staff = validated_data.pop("is_staff", None)
        email = validated_data.pop("email", None)
        village_selected_id = validated_data.pop(
            "village_selected_id", serializers.empty
        )
        profile = super().update(instance, validated_data)
        if village_selected_id is not serializers.empty:
            profile.village_selected_id = village_selected_id
            profile.save(update_fields=["village_selected_id"])
            member_profile = get_user_member_profile(profile)
            if member_profile is not None:
                if profile.member_profile_id is None:
                    profile.member_profile = member_profile
                    profile.save(update_fields=["member_profile"])
                member_profile.village_selected_id = village_selected_id
                member_profile.save(update_fields=["village_selected_id"])
        user_fields = []
        if is_staff is not None and profile.user.is_staff != is_staff:
            profile.user.is_staff = is_staff
            user_fields.append("is_staff")
        if email is not None and profile.user.email != email:
            profile.user.email = email
            user_fields.append("email")
        if user_fields:
            profile.user.save(update_fields=user_fields)
        return profile


class AdminCreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)
    user_role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES)
    status = serializers.BooleanField(default=True)
    is_staff = serializers.BooleanField(default=False)
    member_profile = MemberProfileSelectionField(
        queryset=Member_profile.objects.all(),
        allow_null=True,
        required=False,
    )
    village_selected_id = serializers.ListField(
        child=serializers.ChoiceField(choices=VILLAGE_SELECTION_CHOICES),
        required=False,
    )

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error
        return value

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        user_role = validated_data.pop("user_role")
        status = validated_data.pop("status")
        is_staff = validated_data.pop("is_staff")
        member_profile = validated_data.pop("member_profile", None)
        village_selected_id = validated_data.pop("village_selected_id", None)
        user = User.objects.create_user(password=password, **validated_data)
        user.is_staff = is_staff
        user.save(update_fields=["is_staff"])
        profile = UserProfile.objects.create(
            user=user,
            user_role=user_role,
            status=status,
            member_profile=member_profile,
            village_selected_id=village_selected_id or [],
            entry_by=self.context["request"].user,
        )
        if village_selected_id and member_profile is not None:
            member_profile.village_selected_id = village_selected_id
            member_profile.save(update_fields=["village_selected_id"])
        return profile


from rest_framework import serializers


class ProfileSerializer(serializers.ModelSerializer):
    user_role = serializers.SerializerMethodField()
    profile_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "user_role", "profile_status"]

    def get_user_role(self, obj):
        if obj.is_superuser:
            return "admin"

        try:
            return obj.user_profile.user_role
        except UserProfile.DoesNotExist:
            return None

    def get_profile_status(self, obj):
        if obj.is_superuser:
            return True

        try:
            return obj.user_profile.status
        except UserProfile.DoesNotExist:
            return False
