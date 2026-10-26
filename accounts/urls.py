

from django.urls import path
from .views import (
    RegisterView,
    ProfileView,
    MemberListCreateView,
    MemberDetailView,
    DonationCategoryListCreateView,
    DonationCategoryDetailView,
    DonationYearListCreateView,
    DonationYearDetailView,
    ReceiptbookListCreateView,
    ReceiptbookDetailView,
    DonationMemberListView,
    DonationListCreateView,
    DonationDetailView,
    UserProfileListCreateView,
    UserProfileDetailView,
    AdminCreateUserView,
    GenerateReceiptbookAPIView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("profile/", ProfileView.as_view(), name="profile"),

    path("members/", MemberListCreateView.as_view(), name="member-list-create"),
    path("members/<str:pk>/", MemberDetailView.as_view(), name="member-detail"),

    path("donation-categories/", DonationCategoryListCreateView.as_view(), name="donation-category-list-create"),
    path("donation-categories/<int:category_id>/", DonationCategoryDetailView.as_view(), name="donation-category-detail"),
    
    path("donation-years/", DonationYearListCreateView.as_view(), name="donation-year-list-create"),
    path("donation-years/<int:year_id>/", DonationYearDetailView.as_view(), name="donation-year-detail"),

    # ==========================================
    # ✅ Receiptbook URLs
    # ==========================================
    
    # ১. ডাটা দেখার এবং সাধারণ তৈরি করার জন্য
    path("receiptbooks/", ReceiptbookListCreateView.as_view(), name="receiptbook-list-create"),
    
    # ২. ১০০টি রিসিট জেনারেট করার জন্য
    path("receiptbooks/generate/", GenerateReceiptbookAPIView.as_view(), name="receiptbook-generate"),
    
    # ৩. নির্দিষ্ট কোনো একটি রিসিটের ডিটেইলস দেখার জন্য
    # ✅ এখানে <str:pk> এর জায়গায় <str:receipt_id> করতে হবে
    path("receiptbooks/<str:receipt_id>/", ReceiptbookDetailView.as_view(), name="receiptbook-detail"),

    # ==========================================

    path("donation-members/", DonationMemberListView.as_view(), name="donation-member-list"),
    path("donations/", DonationListCreateView.as_view(), name="donation-list-create"),
    path("donations/<int:donation_id>/", DonationDetailView.as_view(), name="donation-detail"),
    
    path("user-profiles/", UserProfileListCreateView.as_view(), name="user-profile-list-create"),
    path("users/", AdminCreateUserView.as_view(), name="admin-user-create"),
    path("user-profiles/<int:profile_id>/", UserProfileDetailView.as_view(), name="user-profile-detail"),
]