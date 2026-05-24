# Profile photo server sync fix

- Rewards/Achievements page now fetches `/auth/me` so profile_photo saved on the backend loads on every device.
- Removed old logo-as-profile fallback behavior. If no photo exists, user initials are shown instead.
- Daily streak remains hidden for admin, instructor, and sub_admin roles.

After deploy, upload the profile photo once. Then refresh/login on another device to see it.
