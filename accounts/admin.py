
from django.contrib import admin
from django.contrib import messages
from django.shortcuts import redirect
from django.urls import reverse
from .models import Member, Member_profile, UserProfile


def _member_admin_role(user):
    if user.is_superuser:
        return "admin"

    try:
        profile = user.user_profile
    except UserProfile.DoesNotExist:
        return None

    return profile.user_role if profile.status else None


@admin.register(Member_profile)
class Member_profileAdmin(admin.ModelAdmin):

    def has_module_permission(self, request):
        return _member_admin_role(request.user) is not None

    def has_view_permission(self, request, obj=None):
        return _member_admin_role(request.user) is not None

    def has_add_permission(self, request):
        return _member_admin_role(request.user) in ("admin", "manager")

    def has_change_permission(self, request, obj=None):
        return _member_admin_role(request.user) in ("admin", "manager")

    def has_delete_permission(self, request, obj=None):
        return _member_admin_role(request.user) == "admin"

    @admin.display(description="Profile ID", ordering="pk")
    def profile_id(self, obj):
        return obj.pk

    list_display = (
        "profile_id",
        "member",
        "birth_date",
        "status",
        "age_status",
        "maritus_status",
    )

    list_select_related = ("member",)
    search_fields = ("member__member_name",)
    autocomplete_fields = ("member",)
    ordering = ("pk",)


class MemberProfileInline(admin.StackedInline):
    model = Member_profile
    extra = 0

    def has_view_permission(self, request, obj=None):
        return _member_admin_role(request.user) is not None

    def has_add_permission(self, request, obj=None):
        return _member_admin_role(request.user) in ("admin", "manager")

    def has_change_permission(self, request, obj=None):
        return _member_admin_role(request.user) in ("admin", "manager")

    def has_delete_permission(self, request, obj=None):
        return _member_admin_role(request.user) == "admin"


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    fields = (
        "member_id",
        "member_name",
        "Father_name",
        "member_phone",
        "village",
        "member_type",
        "member_picture",
        "user",
        "entry_by",
        "created_at",
        "updated_at",
    )
    list_display = (
        "member_id",
        "member_name",
        "member_phone",
    )
    list_display_links = ("member_name",)
    search_fields = (
        "member_name",
        "Father_name",
        "member_phone",
    )
    ordering = ("member_id",)
    list_per_page = 25
    readonly_fields = ("member_id", "entry_by", "created_at", "updated_at")
    inlines = (MemberProfileInline,)
    actions = ("view_member_details",)

    @admin.action(description="ViewModel")
    def view_member_details(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                "Select exactly one member to view its details.",
                level=messages.WARNING,
            )
            return

        member = queryset.first()
        return redirect(
            reverse("admin:accounts_member_change", args=(member.pk,))
        )

    def has_module_permission(self, request):
        return _member_admin_role(request.user) is not None

    def has_view_permission(self, request, obj=None):
        return _member_admin_role(request.user) is not None

    def has_add_permission(self, request):
        return _member_admin_role(request.user) in ("admin", "manager")

    def has_change_permission(self, request, obj=None):
        return _member_admin_role(request.user) in ("admin", "manager")

    def has_delete_permission(self, request, obj=None):
        return _member_admin_role(request.user) == "admin"

    def get_readonly_fields(self, request, obj=None):
        if self.has_change_permission(request, obj):
            return self.readonly_fields
        return tuple(field.name for field in self.model._meta.fields)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "user_role",
        "status",
        "village_selected_id",
    )
    search_fields = ("user__username",)
    ordering = ("user__username",)
    list_per_page = 25
    readonly_fields = ("user",)

    def has_module_permission(self, request):
        return _member_admin_role(request.user) is not None

    def has_view_permission(self, request, obj=None):
        return _member_admin_role(request.user) is not None

    def has_add_permission(self, request):
        return _member_admin_role(request.user) == "admin"

    def has_change_permission(self, request, obj=None):
        return _member_admin_role(request.user) in ("admin", "manager")

    def has_delete_permission(self, request, obj=None):
        return _member_admin_role(request.user) == "admin"