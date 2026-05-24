Staff rewards/profile photo sync update

Changes:
- Admin, instructor, and sub-admin rewards stay fully unlocked by default.
- Daily streak is now counted/displayed only for student accounts.
- Staff accounts no longer show a daily streak badge in Rewards.
- Reward profile photo uploads now sync through the backend users.profile_photo column.
- /auth/me automatically adds users.profile_photo if missing, returns it, and accepts profile_photo updates.

Note:
- Old profile photos saved only in one browser/device localStorage will not automatically appear on other devices.
- After deploying this update, upload the profile photo once again from Rewards and it will sync to other devices.
