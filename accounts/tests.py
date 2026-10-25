from datetime import date

from django.contrib.auth.models import User
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory
from rest_framework.test import APITestCase

from .admin import Member_profileAdmin, MemberAdmin, MemberProfileInline
from .models import (
    Donation,
    DonationCategory,
    DonationYear,
    Member,
    Member_profile,
    Receitbook,
    UserProfile,
)


class MemberRoleAPITests(APITestCase):
    members_url = "/api/accounts/members/"

    def setUp(self):
        self.admin = self.create_user("admin", "admin")
        self.manager = self.create_user("manager", "manager")
        self.viewer = self.create_user("viewer", "member")
        self.member = Member.objects.create(
            member_name="Existing Member",
            member_phone="123456789",
            Father_name="Parent",
            village="fakirbari",
            member_type="General",
        )
        self.member_url = f"{self.members_url}{self.member.pk}/"

    def create_user(self, username, role):
        user = User.objects.create_user(username=username, password="test-password")
        UserProfile.objects.create(user=user, user_role=role)
        return user

    def set_role(self, user):
        self.client.force_authenticate(user=user)

    def test_all_authenticated_roles_can_view_members(self):
        for user in (self.admin, self.manager, self.viewer):
            with self.subTest(role=user.user_profile.user_role):
                self.set_role(user)
                response = self.client.get(self.members_url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data[0]["id"], self.member.pk)
                self.assertEqual(len(response.data[0]["member_profiles"]), 1)
                self.assertEqual(
                    set(response.data[0]["member_profiles"][0]),
                    {
                        "id",
                        "member",
                        "birth_date",
                        "age",
                        "gender",
                        "status",
                        "age_status",
                        "maritus_status",
                        "village_selected_id",
                    },
                )
                self.assertEqual(self.client.get(self.member_url).status_code, 200)

    def test_member_profile_response_includes_age_in_years(self):
        profile = self.member.member_profiles.get()
        self.set_role(self.admin)

        response = self.client.get(self.member_url)

        self.assertEqual(response.status_code, 200)
        profile_data = response.data["member_profiles"][0]
        self.assertIsNone(profile_data["age"])
        self.assertEqual(profile_data["member"], self.member.pk)

        profile.birth_date = date(1980, 1, 1)
        profile.save()
        response = self.client.get(self.member_url)
        self.assertEqual(
            response.data["member_profiles"][0]["age"],
            profile.calculate_age(),
        )

    def test_admin_and_manager_can_create_members(self):
        payload = {
            "name": "New Member",
            "mobile_no": "987654321",
            "Father_name": "Parent",
            "village": "fakirbari",
            "member_type": "General",
        }

        for user, expected_status in (
            (self.admin, 201),
            (self.manager, 201),
            (self.viewer, 403),
        ):
            with self.subTest(role=user.user_profile.user_role):
                self.set_role(user)
                response = self.client.post(self.members_url, payload)
                self.assertEqual(response.status_code, expected_status)
                if expected_status == 201:
                    created_member = Member.objects.get(pk=response.data["id"])
                    profile = Member_profile.objects.get(member=created_member)
                    self.assertIsNone(profile.birth_date)
                    self.assertEqual(profile.status, "active")

    def test_member_profile_is_not_duplicated_when_member_is_updated(self):
        self.set_role(self.admin)
        response = self.client.post(
            self.members_url,
            {
                "name": "Profile Test",
                "mobile_no": "987654321",
                "Father_name": "Parent",
                "village": "Village",
                "member_type": "General",
            },
        )
        self.assertEqual(response.status_code, 201)
        member_id = response.data["id"]

        response = self.client.patch(
            f"{self.members_url}{member_id}/",
            {"name": "Updated Profile Test"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Member_profile.objects.filter(member_id=member_id).count(), 1)

    def test_admin_and_manager_can_update_member_and_profile_together(self):
        profile = self.member.member_profiles.get()
        payload = {
            "name": "Updated Both Models",
            "member_profiles": [
                {
                    "id": profile.pk,
                    "birth_date": "1990-04-12",
                    "gender": "female",
                    "status": "inactive",
                    "age_status": "senior",
                    "maritus_status": "married",
                }
            ],
        }

        for user in (self.admin, self.manager):
            with self.subTest(role=user.user_profile.user_role):
                self.member.member_name = "Existing Member"
                self.member.save()
                profile.birth_date = None
                profile.status = "active"
                profile.age_status = "adult"
                profile.maritus_status = "unmarried"
                profile.gender = "male"
                profile.save()

                self.set_role(user)
                response = self.client.patch(
                    self.member_url,
                    payload,
                    format="json",
                )

                self.assertEqual(response.status_code, 200)
                self.member.refresh_from_db()
                profile.refresh_from_db()
                self.assertEqual(self.member.member_name, "Updated Both Models")
                self.assertEqual(profile.birth_date.isoformat(), "1990-04-12")
                self.assertEqual(profile.status, "inactive")
                self.assertEqual(profile.age_status, "senior")
                self.assertEqual(profile.maritus_status, "married")
                self.assertEqual(profile.gender, "female")

    def test_member_profile_can_be_added_from_member_detail_update(self):
        self.member.member_profiles.all().delete()
        self.set_role(self.manager)

        response = self.client.patch(
            self.member_url,
            {
                "member_profiles": [
                    {
                        "birth_date": "1985-06-20",
                        "gender": "male",
                        "status": "active",
                        "age_status": "adult",
                        "maritus_status": "married",
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        profiles = Member_profile.objects.filter(member=self.member)
        self.assertEqual(profiles.count(), 1)
        self.assertEqual(response.data["member_profiles"][0]["birth_date"], "1985-06-20")
        self.assertEqual(response.data["member_profiles"][0]["gender"], "male")
        self.assertEqual(response.data["member_profiles"][0]["maritus_status"], "married")

    def test_member_profile_update_rejects_profile_from_another_member(self):
        other_member = Member.objects.create(
            member_name="Other Member",
            member_phone="222222222",
            Father_name="Parent",
            village="fakirbari",
            member_type="General",
        )
        other_profile = other_member.member_profiles.get()
        self.set_role(self.admin)

        response = self.client.patch(
            self.member_url,
            {
                "member_profiles": [
                    {
                        "id": other_profile.pk,
                        "status": "inactive",
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_regular_member_cannot_update_profile_in_member_view(self):
        profile = self.member.member_profiles.get()
        self.set_role(self.viewer)

        response = self.client.patch(
            self.member_url,
            {
                "member_profiles": [
                    {
                        "id": profile.pk,
                        "status": "inactive",
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_creating_member_model_instance_creates_profile(self):
        member = Member.objects.create(
            member_name="Direct Model Member",
            member_phone="123456789",
            Father_name="Parent",
            village="fakirbari",
            member_type="General",
        )

        self.assertEqual(self.member.pk, "00001-01-0001")
        self.assertEqual(member.pk, "00002-01-0002")
        profile = Member_profile.objects.get(member=member)
        self.assertIsNone(profile.birth_date)
        self.assertEqual(profile.gender, "male")
        self.assertEqual(profile.status, "active")

    def test_admin_and_manager_can_update_members(self):
        payload = {"name": "Updated Member"}

        for user, expected_status in (
            (self.admin, 200),
            (self.manager, 200),
            (self.viewer, 403),
        ):
            with self.subTest(role=user.user_profile.user_role):
                self.member.refresh_from_db()
                self.member.member_name = "Existing Member"
                self.member.save()
                self.set_role(user)
                self.assertEqual(
                    self.client.patch(self.member_url, payload).status_code,
                    expected_status,
                )

    def test_only_admin_can_delete_members(self):
        for user, expected_status in (
            (self.manager, 403),
            (self.viewer, 403),
            (self.admin, 204),
        ):
            with self.subTest(role=user.user_profile.user_role):
                self.member = Member.objects.create(
                    member_name="Delete Test",
                    member_phone="123456789",
                    Father_name="Parent",
                    village="fakirbari",
                    member_type="General",
                )
                self.member_url = f"{self.members_url}{self.member.pk}/"
                self.set_role(user)
                self.assertEqual(
                    self.client.delete(self.member_url).status_code,
                    expected_status,
                )

    def test_profile_endpoint_includes_user_role(self):
        self.manager.user_profile.village_selected_id = ["fakirbari", "chanpur"]
        self.manager.user_profile.save(update_fields=["village_selected_id"])
        self.set_role(self.manager)
        response = self.client.get("/api/accounts/profile/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_role"], "manager")
        self.assertEqual(
            response.data["village_selected_id"],
            ["fakirbari", "chanpur"],
        )

    def test_user_profile_can_be_created_with_username(self):
        unprofiled_user = User.objects.create_user(
            username="profile-create-user",
            password="test-password",
        )
        self.set_role(self.admin)

        response = self.client.post(
            "/api/accounts/user-profiles/",
            {
                "user": unprofiled_user.username,
                "email": "profile-create@example.com",
                "user_role": "viewer",
                "status": True,
                "is_staff": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["username"], unprofiled_user.username)
        self.assertEqual(response.data["user"], unprofiled_user.pk)
        self.assertEqual(response.data["user_role"], "viewer")
        self.assertEqual(response.data["email"], "profile-create@example.com")
        self.assertTrue(response.data["is_staff"])
        unprofiled_user.refresh_from_db()
        self.assertTrue(unprofiled_user.is_staff)
        self.assertEqual(unprofiled_user.email, "profile-create@example.com")

    def test_user_profile_rejects_unknown_username_with_clear_error(self):
        self.set_role(self.admin)

        response = self.client.post(
            "/api/accounts/user-profiles/",
            {
                "user": "missing-account",
                "user_role": "viewer",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(
            'No user with username "missing-account" exists.',
            response.data["user"][0],
        )

    def test_admin_can_create_user_and_profile_together(self):
        self.set_role(self.admin)

        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "new-profile-user",
                "password": "Complex-passphrase-927!",
                "email": "new-profile-user@example.com",
                "user_role": "viewer",
                "status": True,
                "is_staff": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created_user = User.objects.get(username="new-profile-user")
        self.assertTrue(created_user.check_password("Complex-passphrase-927!"))
        self.assertFalse(created_user.is_staff)
        self.assertEqual(created_user.email, "new-profile-user@example.com")
        self.assertEqual(response.data["user"], created_user.pk)
        self.assertEqual(response.data["user_role"], "viewer")
        self.assertEqual(UserProfile.objects.filter(user=created_user).count(), 1)

    def test_non_admin_cannot_create_user_and_profile(self):
        self.set_role(self.manager)

        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "blocked-created-user",
                "password": "Complex-passphrase-927!",
                "user_role": "viewer",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username="blocked-created-user").exists())

    def test_user_profile_can_be_updated_from_edit_form(self):
        self.set_role(self.admin)

        response = self.client.patch(
            f"/api/accounts/user-profiles/{self.admin.user_profile.profile_id}/",
            {
                "user": self.admin.username,
                "email": "updated-admin@example.com",
                "user_role": "manager",
                "status": False,
                "is_staff": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"], self.admin.pk)
        self.assertEqual(response.data["email"], "updated-admin@example.com")
        self.assertEqual(response.data["user_role"], "manager")
        self.assertFalse(response.data["status"])
        self.assertTrue(response.data["is_staff"])
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_staff)
        self.assertEqual(self.admin.email, "updated-admin@example.com")

        response = self.client.patch(
            f"/api/accounts/user-profiles/{self.admin.user_profile.profile_id}/",
            {"email": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "")
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.email, "")

    def test_member_admin_view_and_edit_permissions_follow_user_role(self):
        member_admin = MemberAdmin(Member, AdminSite())
        member_profile_admin = Member_profileAdmin(Member_profile, AdminSite())
        member_inline = MemberProfileInline(Member, AdminSite())
        request_factory = RequestFactory()

        for user, can_edit, can_delete in (
            (self.admin, True, True),
            (self.manager, True, False),
            (self.viewer, False, False),
        ):
            with self.subTest(role=user.user_profile.user_role):
                request = request_factory.get("/admin/accounts/member/")
                request.user = user

                self.assertTrue(member_admin.has_module_permission(request))
                self.assertTrue(member_admin.has_view_permission(request))
                self.assertEqual(
                    member_admin.has_add_permission(request),
                    can_edit,
                )
                self.assertEqual(
                    member_admin.has_change_permission(request),
                    can_edit,
                )
                self.assertEqual(
                    member_admin.has_delete_permission(request),
                    can_delete,
                )
                self.assertTrue(member_inline.has_view_permission(request))
                self.assertEqual(
                    member_inline.has_add_permission(request),
                    can_edit,
                )
                self.assertEqual(
                    member_inline.has_change_permission(request),
                    can_edit,
                )
                self.assertEqual(
                    member_inline.has_delete_permission(request),
                    can_delete,
                )
                self.assertEqual(
                    member_profile_admin.has_module_permission(request),
                    user.user_profile.status,
                )
                self.assertEqual(
                    member_profile_admin.has_view_permission(request),
                    user.user_profile.status,
                )
                self.assertEqual(
                    member_profile_admin.has_add_permission(request),
                    can_edit,
                )
                self.assertEqual(
                    member_profile_admin.has_change_permission(request),
                    can_edit,
                )
                self.assertEqual(
                    member_profile_admin.has_delete_permission(request),
                    can_delete,
                )
                if not can_edit:
                    self.assertEqual(
                        set(member_admin.get_readonly_fields(request)),
                        {field.name for field in Member._meta.fields},
                    )


class VillageAssignmentAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="village-admin",
            password="test-password",
        )
        UserProfile.objects.create(user=self.admin, user_role="admin")
        self.member = Member.objects.create(
            member_name="Village Member",
            member_phone="123456789",
            Father_name="Parent",
            village="fakirbari",
            member_type="General",
        )
        self.member_profile = self.member.member_profiles.get()
        self.client.force_authenticate(user=self.admin)

    def test_add_user_can_assign_member_profile_and_multiple_villages(self):
        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "village-user",
                "password": "Different-village-password-482!",
                "user_role": "viewer",
                "member_profile": self.member_profile.pk,
                "village_selected_id": ["fakirbari", "chanpur"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.member_profile.refresh_from_db()
        profile = UserProfile.objects.get(user__username="village-user")
        self.assertEqual(profile.member_profile, self.member_profile)
        self.assertEqual(
            self.member_profile.village_selected_id,
            ["fakirbari", "chanpur"],
        )
        self.assertEqual(
            profile.village_selected_id,
            ["fakirbari", "chanpur"],
        )
        self.assertEqual(
            response.data["village_selected_id"],
            ["fakirbari", "chanpur"],
        )

    def test_user_profile_update_links_auth_user_member_and_village_selection(self):
        user = User.objects.create_user(
            username="existing-village-user",
            password="test-password",
        )
        self.member.user = user
        self.member.save(update_fields=["user"])
        user_profile = UserProfile.objects.create(user=user)
        response = self.client.patch(
            f"/api/accounts/user-profiles/{user_profile.profile_id}/",
            {
                "village_selected_id": ["borobari", "khalishpur"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.member_profile.refresh_from_db()
        user_profile.refresh_from_db()
        self.assertEqual(user_profile.member_profile, self.member_profile)
        self.assertEqual(
            self.member_profile.village_selected_id,
            ["borobari", "khalishpur"],
        )
        self.assertEqual(
            user_profile.village_selected_id,
            ["borobari", "khalishpur"],
        )
        self.assertEqual(
            response.data["village_selected_id"],
            ["borobari", "khalishpur"],
        )

    def test_village_access_auto_links_member_profile_for_same_user(self):
        member_profile = self.member_profile
        member_profile.member.user = self.admin
        member_profile.member.save(update_fields=["user"])
        response = self.client.get("/api/accounts/user-profiles/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data[0]["member_profile"],
            member_profile.pk,
        )

        response = self.client.patch(
            f"/api/accounts/user-profiles/{self.admin.user_profile.profile_id}/",
            {"village_selected_id": ["chanpur"]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        member_profile.refresh_from_db()
        self.admin.user_profile.refresh_from_db()
        self.assertEqual(self.admin.user_profile.member_profile, member_profile)
        self.assertEqual(member_profile.village_selected_id, ["chanpur"])
        self.assertEqual(response.data["member_profile"], member_profile.pk)
        self.assertEqual(response.data["village_selected_id"], ["chanpur"])
        self.assertEqual(self.admin.user_profile.village_selected_id, ["chanpur"])

    def test_member_profile_endpoint_returns_village_selection(self):
        self.member_profile.village_selected_id = ["fakirbari", "chanpur"]
        self.member_profile.save(update_fields=["village_selected_id"])

        response = self.client.get(f"/api/accounts/members/{self.member.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["member_profiles"][0]["village_selected_id"],
            ["fakirbari", "chanpur"],
        )

    def test_user_can_be_assigned_every_village(self):
        villages = [value for value, _label in Member.moholla_choice]
        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "all-villages-user",
                "password": "Different-village-password-692!",
                "user_role": "viewer",
                "member_profile": self.member_profile.pk,
                "village_selected_id": villages,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.member_profile.refresh_from_db()
        self.assertEqual(self.member_profile.village_selected_id, villages)
        profile = UserProfile.objects.get(user__username="all-villages-user")
        self.assertEqual(profile.village_selected_id, villages)

    def test_village_assignment_without_member_profile_is_saved_on_user_profile(self):
        response = self.client.post(
            "/api/accounts/users/",
            {
                "username": "missing-member-profile",
                "password": "Different-village-password-721!",
                "user_role": "viewer",
                "village_selected_id": ["fakirbari"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        profile = UserProfile.objects.get(
            user__username="missing-member-profile"
        )
        self.assertIsNone(profile.member_profile)
        self.assertEqual(profile.village_selected_id, ["fakirbari"])
        self.assertEqual(response.data["village_selected_id"], ["fakirbari"])

    def test_user_profile_village_access_can_be_edited_without_member_profile(self):
        user = User.objects.create_user(
            username="no-member-link-user",
        )
        profile = UserProfile.objects.create(user=user)

        response = self.client.patch(
            f"/api/accounts/user-profiles/{profile.profile_id}/",
            {"village_selected_id": ["borobari", "chanpur"]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        profile.refresh_from_db()
        self.assertIsNone(profile.member_profile_id)
        self.assertEqual(profile.village_selected_id, ["borobari", "chanpur"])
        self.assertEqual(
            response.data["village_selected_id"],
            ["borobari", "chanpur"],
        )

    def test_profile_update_ignores_stale_member_profile_id(self):
        user = User.objects.create_user(
            username="stale-member-link-user",
            password="test-password",
        )
        user_profile = UserProfile.objects.create(user=user)

        response = self.client.patch(
            f"/api/accounts/user-profiles/{user_profile.profile_id}/",
            {
                "member_profile": 1,
                "email": "updated@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user_profile.refresh_from_db()
        self.assertIsNone(user_profile.member_profile_id)
        self.assertEqual(response.data["email"], "updated@example.com")


class DonationRoleAPITests(APITestCase):
    donations_url = "/api/accounts/donations/"
    donation_members_url = "/api/accounts/donation-members/"

    def setUp(self):
        self.users = {
            role: self.create_user(role, role)
            for role in ("admin", "manager", "assistance", "member", "viewer")
        }
        self.member = Member.objects.create(
            member_name="Donation Member",
            member_phone="123456789",
            Father_name="Parent",
            village="fakirbari",
            member_type="General",
        )
        for user in self.users.values():
            user.user_profile.village_selected_id = ["fakirbari"]
            user.user_profile.save(update_fields=["village_selected_id"])
        self.category = DonationCategory.objects.create(
            category_name="General Donation"
        )
        self.year = DonationYear.objects.create(year_name="2026")
        self.donation = Donation.objects.create(
            member_id=self.member,
            donation_category=self.category,
            donation_amount="25.00",
            donation_date=date(2026, 10, 24),
            year_id=self.year,
            description="Existing donation",
        )

    def create_user(self, username, role):
        user = User.objects.create_user(username=username, password="test-password")
        UserProfile.objects.create(user=user, user_role=role)
        return user

    def test_all_authenticated_roles_can_view_donations_and_lookup_choices(self):
        for role, user in self.users.items():
            with self.subTest(role=role):
                self.client.force_authenticate(user=user)
                response = self.client.get(self.donations_url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data[0]["donation_id"], self.donation.pk)
                self.assertEqual(response.data[0]["member_name"], "Donation Member")
                self.assertEqual(
                    self.client.get("/api/accounts/donation-categories/").status_code,
                    200,
                )
                self.assertEqual(
                    self.client.get("/api/accounts/donation-years/").status_code,
                    200,
                )

    def test_active_only_donation_year_lookup_excludes_inactive_years(self):
        inactive_year = DonationYear.objects.create(
            year_name="2025",
            status=False,
        )
        self.client.force_authenticate(user=self.users["admin"])

        response = self.client.get(
            "/api/accounts/donation-years/?active_only=true"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [year["year_id"] for year in response.data],
            [self.year.year_id],
        )
        self.assertNotIn(
            inactive_year.year_id,
            [year["year_id"] for year in response.data],
        )

    def test_donation_member_choices_follow_logged_in_user_village_access(self):
        user = self.users["manager"]
        user.user_profile.village_selected_id = ["chanpur", "fakirbari"]
        user.user_profile.save(update_fields=["village_selected_id"])
        allowed_member = Member.objects.create(
            member_name="Allowed Village Member",
            member_phone="123456780",
            Father_name="Parent",
            village="chanpur",
            member_type="General",
        )
        Member.objects.create(
            member_name="Other Village Member",
            member_phone="123456781",
            Father_name="Parent",
            village="borobari",
            member_type="General",
        )

        self.client.force_authenticate(user=user)
        response = self.client.get(self.donation_members_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {member["id"] for member in response.data},
            {self.member.pk, allowed_member.pk},
        )

    def test_donation_member_choices_are_empty_without_village_access(self):
        profile = self.users["viewer"].user_profile
        profile.village_selected_id = []
        profile.save(update_fields=["village_selected_id"])
        self.client.force_authenticate(user=self.users["viewer"])

        response = self.client.get(self.donation_members_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_all_active_roles_can_create_donations(self):
        payload = {
            "member_id": self.member.pk,
            "donation_category": self.category.pk,
            "donation_amount": "50.00",
            "donation_date": "2026-10-24",
            "year_id": self.year.pk,
            "description": "New donation",
        }

        for role, user in self.users.items():
            with self.subTest(role=role):
                self.client.force_authenticate(user=user)
                response = self.client.post(
                    self.donations_url,
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, 201)
                created = Donation.objects.get(pk=response.data["donation_id"])
                self.assertEqual(created.entry_by, user)
                self.assertEqual(created.description, "New donation")

    def test_only_admin_can_update_and_no_role_can_delete_donations(self):
        detail_url = f"{self.donations_url}{self.donation.pk}/"
        for role, user in self.users.items():
            with self.subTest(role=role):
                self.client.force_authenticate(user=user)
                response = self.client.patch(
                    detail_url,
                    {"description": f"Updated by {role}"},
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    200 if role == "admin" else 403,
                )

                response = self.client.delete(detail_url)
                self.assertEqual(response.status_code, 403)


class ReceitbookRoleAPITests(APITestCase):
    receitbooks_url = "/api/accounts/receitbooks/"

    def setUp(self):
        self.admin = self.create_user("admin", "admin")
        self.member = self.create_user("member", "member")
        self.receitbook = Receitbook.objects.create(
            for_user=self.admin,
            prefix="RCPT",
            start_number=1,
            end_number=100,
            description="Existing range",
        )

    def create_user(self, username, role):
        user = User.objects.create_user(username=username, password="test-password")
        UserProfile.objects.create(user=user, user_role=role)
        return user

    def test_admin_can_create_view_and_edit_receitbooks(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.receitbooks_url,
            {
                "for_user": self.admin.pk,
                "prefix": "MOS",
                "start_number": 101,
                "end_number": 200,
                "receit_status": "unused",
                "description": "Second range",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        receit_id = response.data["receit_id"]
        self.assertEqual(response.data["for_user_username"], "admin")
        self.assertEqual(response.data["entry_by"], self.admin.pk)
        self.assertTrue(Receitbook.objects.filter(pk=receit_id).exists())

        detail_url = f"{self.receitbooks_url}{receit_id}/"
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["description"], "Second range")

        response = self.client.patch(
            detail_url,
            {"receit_status": "used", "description": "Updated range"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.receitbook.refresh_from_db()
        updated = Receitbook.objects.get(pk=receit_id)
        self.assertEqual(updated.receit_status, "used")
        self.assertEqual(updated.description, "Updated range")

    def test_receitbook_range_must_be_valid_on_create_and_update(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.receitbooks_url,
            {
                "for_user": self.admin.pk,
                "prefix": "BAD",
                "start_number": 200,
                "end_number": 100,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_number", response.data)

        response = self.client.patch(
            f"{self.receitbooks_url}{self.receitbook.pk}/",
            {"start_number": 101},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_number", response.data)

    def test_non_admin_cannot_view_create_or_edit_receitbooks(self):
        self.client.force_authenticate(user=self.member)

        self.assertEqual(self.client.get(self.receitbooks_url).status_code, 403)
        self.assertEqual(
            self.client.post(
                self.receitbooks_url,
                {
                    "for_user": self.member.pk,
                    "prefix": "RCPT",
                    "start_number": 1,
                    "end_number": 100,
                },
                format="json",
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                f"{self.receitbooks_url}{self.receitbook.pk}/"
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.patch(
                f"{self.receitbooks_url}{self.receitbook.pk}/",
                {"description": "Not allowed"},
                format="json",
            ).status_code,
            403,
        )

    def test_receitbook_endpoint_does_not_allow_deletion(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(
            f"{self.receitbooks_url}{self.receitbook.pk}/"
        )
        self.assertEqual(response.status_code, 405)
