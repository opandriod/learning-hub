Learning Hub APK Google Login Fix

Problem:
Google blocks OAuth sign-in inside Android WebView and shows Error 403: disallowed_useragent.

What was changed:
1. Android app now adds a user-agent marker: LearningHubAndroidApp.
2. Website login page detects Android WebView/app mode.
3. Inside the APK, the Google sign-in button is hidden.
4. The APK login page now shows a message telling users to use email/password.
5. Users who originally joined using Google on the website should tap Forgot password once and create a password for the same Gmail account.
6. Website/browser login still shows Google sign-in normally.

Important:
- Deploy the updated learning_hub_combined project to Vercel/Render.
- Rebuild the Android APK from the included LearningHubAndroidApp folder.
- Supabase SMTP must be working so Forgot Password emails can arrive.
