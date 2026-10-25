
from rest_framework.permissions import BasePermission

from .models import UserProfile


class IsAdminRole(BasePermission):
    """
    Allow only Django superusers or users whose UserProfile role is admin.
    """

    message = "Only Admin users can manage this resource."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        try:
            return (
                user.user_profile.user_role == "admin"
                and user.user_profile.status is True
            )
        except Exception:
            return False


class MemberRolePermission(BasePermission):
    message = "Your role does not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        if user.is_superuser:
            return True

        try:
            profile = user.user_profile
        except UserProfile.DoesNotExist:
            return False

        if not profile.status:
            return False

        if profile.user_role == "admin":
            return True

        return (
            profile.user_role == "manager"
            and request.method in ("POST", "PUT", "PATCH")
        )


class DonationRolePermission(BasePermission):
    message = "Your role does not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        if user.is_superuser:
            return request.method in ("POST", "PUT", "PATCH")

        try:
            profile = user.user_profile
        except UserProfile.DoesNotExist:
            return False

        if not profile.status:
            return False

        if profile.user_role == "admin":
            return request.method in ("POST", "PUT", "PATCH")

        return request.method == "POST"


class AdminRoleOrAuthenticatedReadOnly(BasePermission):
    message = "Only Admin users can modify this resource."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        return IsAdminRole().has_permission(request, view)
