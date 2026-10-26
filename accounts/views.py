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
from .serializers import MemberSerializer, ReceiptbookSerializer


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

from .models import Donation, DonationCategory, DonationYear, Receiptbook, UserProfile
from .permissions import AdminRoleOrAuthenticatedReadOnly, DonationRolePermission, IsAdminRole
from .serializers import (
    AdminCreateUserSerializer,
    DonationSerializer,
    DonationCategorySerializer,
    DonationYearSerializer,
    ReceiptbookGenerationSerializer,
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


class ReceiptbookListCreateView(generics.ListCreateAPIView):
    serializer_class = ReceiptbookSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Receiptbook.objects.all()

        # ✅ ১. চেক করবো ইউজার নিজের রিসিট চাইছে কিনা (for_me=true)
        for_me = self.request.query_params.get('for_me', None)
        if for_me == 'true':
            queryset = queryset.filter(for_user=user)

        # ✅ ২. চেক করবো নির্দিষ্ট কোনো স্ট্যাটাসের রিসিট চাইছে কিনা (status=unused)
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(receipt_status=status_param)

        return queryset.order_by('receipt_id')


class ReceiptbookDetailView(
    AdminOnlyCRUDViewMixin,
    generics.RetrieveUpdateAPIView,
):
    queryset = Receiptbook.objects.select_related("for_user", "entry_by").all()
    serializer_class = ReceiptbookGenerationSerializer
    lookup_field = "receipt_id"


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
        "receipt_id",           # ✅ যোগ করো (Receiptbook FK)
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
        "receip_id",
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


import random
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated # ✅ পারমিশন যোগ করা হলো
from .models import Receiptbook
from .serializers import ReceiptbookGenerationSerializer

class GenerateReceiptbookAPIView(APIView):
    # ✅ নিশ্চিত করা হলো যে ইউজার লগইন করা আছে (JWT Token ছাড়া কেউ হিট করতে পারবে না)
    permission_classes = [IsAuthenticated] 

    def post(self, request):
        serializer = ReceiptbookGenerationSerializer(data=request.data)
        
        if serializer.is_valid():
            data = serializer.validated_data
            
            start_num = data['start_number']
            end_num = data['end_number']
            prefix = data.get('prefix', 'RCP')
            for_user = data['for_user']
            receipt_status = data['receipt_status']
            description = data.get('description', '')
            
            # ৪ ডিজিটের একটি কমন বুক আইডি তৈরি (যেমন: 0013)
            book_id = random.randint(1, 9999)
            
            created_receipts = []
            
            try:
                # transaction.atomic() নিশ্চিত করে যে ১০০টির মধ্যে ১টি ফেইল করলে কোনো ডাটাই সেভ হবে না
                with transaction.atomic():
                    for num in range(start_num, end_num + 1):
                        # ফরম্যাট: 0013-RCP0001, 0013-RCP0002 ...
                        generated_receipt_id = f"{book_id:04d}-{prefix}{num:04d}"
                        
                        # ডুপ্লিকেট চেক
                        if not Receiptbook.objects.filter(receipt_id=generated_receipt_id).exists():
                            
                            receipt = Receiptbook.objects.create(
                                receipt_id=generated_receipt_id, 
                                for_user=for_user,
                                prefix=prefix,
                                start_number=start_num, 
                                end_number=end_num,     
                                receipt_status=receipt_status,
                                description=description,
                                entry_by=request.user if request.user.is_authenticated else None # ✅ সেফটি চেক
                            )
                            created_receipts.append(receipt)

                return Response(
                    {
                        "message": f"Successfully generated {len(created_receipts)} receipts.",
                        "batch_id": f"{book_id:04d}"
                    }, 
                    status=status.HTTP_201_CREATED
                )
                
            except Exception as e:
                return Response(
                    {"error": f"Something went wrong: {str(e)}"}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    
import random  # <-- ইম্পোর্ট নিশ্চিত করুন
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from .forms import ReceiptbookGenerationForm
from .models import Receiptbook

@login_required
def receiptbook_generate(request):
    user_profile = request.user.profile
    
    
    if request.method == 'POST':
        form = ReceiptbookGenerationForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            assigned_user = data['assigned_user']
            prefix = data['prefix'] or ''
            start = data['start_number']
            end = data['end_number']
            status = data['status']
            description = data['description']
            
            receiptbooks_created = []
            
            # ৪ ডিজিটের বুক আইডি তৈরি (যেমন: 0013)। 
            # চাইলে সরাসরি স্ট্রিংও দিতে পারেন: book_id = "0013"
            book_id = random.randint(1000, 9999) 
            
            for num in range(start, end + 1):
                # নতুন ফরম্যাট: 0013-RCP0001
                receipt_number = f"{book_id:04d}-{prefix}{num:04d}" 
                
                if not Receiptbook.objects.filter(receipt_number=receipt_number).exists():
                    receipt = Receiptbook.objects.create(
                        receipt_number=receipt_number,
                        assigned_user=assigned_user,
                        status=status,
                        description=description,
                        created_by=request.user
                    )
                    receiptbooks_created.append(receipt)
            
            count = len(receiptbooks_created)
            messages.success(
                request, 
                f'Successfully generated {count} receipt(s) for {assigned_user.username}!'
            )
            
            if count > 0:
                return redirect('receiptbook_list')
            else:
                messages.warning(request, 'No new receipts were created. All numbers may already exist.')
    else:
        form = ReceiptbookGenerationForm()
    
    context = {
        'form': form,
        'title': 'Generate Receiptbooks',
    }
    
    return render(request, 'receiptbook/receiptbook_generate.html', context)