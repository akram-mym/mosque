from django.shortcuts import render

# Create your views here.

from django.contrib.auth.models import User
from rest_framework import generics, serializers
from rest_framework.permissions import AllowAny


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = UserProfile.objects.filter(user=request.user).first()
        user_picture = None
        user_role = "admin" if request.user.is_superuser else None
        if user_profile and user_profile.user_picture:
            user_picture = request.build_absolute_uri(user_profile.user_picture.url)
        if user_profile and user_profile.status and not request.user.is_superuser:
            user_role = user_profile.user_role

        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "user_picture": user_picture,
            "user_role": user_role,
            "is_superuser": request.user.is_superuser,
            "village_selected_id": (
                user_profile.village_selected_id if user_profile else []
            ),
            "message": "Authenticated successfully!",
        })



from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Member
from .permissions import MemberRolePermission
from .serializers import MemberSerializer


class MemberListCreateView(generics.ListCreateAPIView):
    queryset = Member.objects.prefetch_related("member_profiles").all().order_by("-created_at")
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated, MemberRolePermission]

    def perform_create(self, serializer):
        serializer.save(entry_by=self.request.user)


class MemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Member.objects.prefetch_related("member_profiles").all()
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated, MemberRolePermission]




from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Donation, DonationCategory, DonationYear, Receitbook, UserProfile
from .permissions import AdminRoleOrAuthenticatedReadOnly, DonationRolePermission, IsAdminRole
from .serializers import (
    AdminCreateUserSerializer,
    DonationSerializer,
    DonationCategorySerializer,
    DonationYearSerializer,
    ReceitbookSerializer,
    UserProfileSerializer,
    get_user_village_access,
)


class AdminOnlyCRUDViewMixin:
    permission_classes = [IsAuthenticated, IsAdminRole]


class AdminManageReadAuthenticatedMixin:
    permission_classes = [IsAuthenticated, AdminRoleOrAuthenticatedReadOnly]


class DonationCategoryListCreateView(
    AdminManageReadAuthenticatedMixin,
    generics.ListCreateAPIView,
):
    queryset = DonationCategory.objects.all()
    serializer_class = DonationCategorySerializer

    def perform_create(self, serializer):
        serializer.save(entry_by=self.request.user)


class DonationCategoryDetailView(
    AdminManageReadAuthenticatedMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    queryset = DonationCategory.objects.all()
    serializer_class = DonationCategorySerializer
    lookup_field = "category_id"


class DonationYearListCreateView(
    AdminManageReadAuthenticatedMixin,
    generics.ListCreateAPIView,
):
    queryset = DonationYear.objects.all()
    serializer_class = DonationYearSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        active_only = self.request.query_params.get("active_only") == "true"
        if self.request.method == "GET" and active_only:
            return queryset.filter(status=True)
        return queryset

    def perform_create(self, serializer):
        serializer.save(entry_by=self.request.user)


class DonationYearDetailView(
    AdminManageReadAuthenticatedMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    queryset = DonationYear.objects.all()
    serializer_class = DonationYearSerializer
    lookup_field = "year_id"


class ReceitbookListCreateView(
    AdminOnlyCRUDViewMixin,
    generics.ListCreateAPIView,
):
    queryset = Receitbook.objects.select_related("for_user", "entry_by").all()
    serializer_class = ReceitbookSerializer

    def perform_create(self, serializer):
        serializer.save(entry_by=self.request.user)


class ReceitbookDetailView(
    AdminOnlyCRUDViewMixin,
    generics.RetrieveUpdateAPIView,
):
    queryset = Receitbook.objects.select_related("for_user", "entry_by").all()
    serializer_class = ReceitbookSerializer
    lookup_field = "receit_id"


class DonationMemberListView(generics.ListAPIView):
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        village_access = get_user_village_access(self.request.user)
        return (
            Member.objects.prefetch_related("member_profiles")
            .filter(village__in=village_access)
            .order_by("-created_at")
        )


class DonationListCreateView(generics.ListCreateAPIView):
    queryset = Donation.objects.select_related(
        "receit_id",           # ✅ যোগ করো (Receitbook FK)
        "member",
        "donation_category",   # ✅
        "year_id",             # ✅
        "entry_by",            # ✅ (CommonModel-এ আছে ধরে নিলাম)
    ).all()
    serializer_class = DonationSerializer
    permission_classes = [IsAuthenticated, DonationRolePermission]

    def perform_create(self, serializer):
        serializer.save(entry_by=self.request.user)


class DonationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Donation.objects.select_related(
        "receit_id",
        "member",
        "donation_category",
        "year_id",
        "entry_by",
    ).all()
    serializer_class = DonationSerializer
    permission_classes = [IsAuthenticated, DonationRolePermission]
    lookup_field = "donation_id"


class UserProfileListCreateView(
    AdminOnlyCRUDViewMixin,
    generics.ListCreateAPIView,
):
    queryset = (
        UserProfile.objects.select_related("user", "member_profile")
        .prefetch_related("user__mosque_members__member_profiles")
        .all()
    )
    serializer_class = UserProfileSerializer

    def perform_create(self, serializer):
        serializer.save(entry_by=self.request.user)


class AdminCreateUserView(AdminOnlyCRUDViewMixin, generics.GenericAPIView):
    serializer_class = AdminCreateUserSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(
            UserProfileSerializer(profile, context=self.get_serializer_context()).data,
            status=201,
        )


class UserProfileDetailView(
    AdminOnlyCRUDViewMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    queryset = (
        UserProfile.objects.select_related("user", "member_profile")
        .prefetch_related("user__mosque_members__member_profiles")
        .all()
    )
    serializer_class = UserProfileSerializer
    lookup_field = "profile_id"
