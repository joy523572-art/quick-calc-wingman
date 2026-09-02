# Smart Calc Pro

I want you to build a very standard Complete Scientific Calculator app for me.                Ensure it adheres to these Google play store policies below.                                                              This is Google play store rules regulations and guidelines for apps.

Ensure this web app is adherering to all the rules, regulations, and guildelines.



- *Privacy Policy*: A clear and comprehensive policy explaining data collection, usage, and sharing practices.

- *Data Safety Section*: Accurate disclosure of collected data, usage, and sharing practices.

- *Account Deletion*: Provide a way for users to request account deletion.

- *Content Guidelines*: Ensure content is suitable for the intended audience and complies with Google's policies.

- *Deceptive Behavior*: No misleading or false claims, including in the app's description or privacy policy.

- *Sensitive Permissions*: Declare and justify use of sensitive permissions (e.g., SMS, location).

- *API Level*: Target API level 26 (Android 8.0 Oreo) or higher for new submissions.

- *Photo and Video Permissions*: Access photos and videos only for purposes directly related to app functionality.

- *Data Protection*: Implement security measures to protect user data.

- *User Experience*: Provide a functional and respectful user experience.

- *Impersonation*: No impersonation of others or their apps.

- *Intellectual Property*: Respect intellectual property rights.

- *UI Polish*: Ensure a professional and intuitive user interface.

- *Stack*: Use approved technologies and frameworks.

- *Dark Mode*: Support dark mode if applicable.



1. Set minSdkVersion to 24 and targetSdkVersion to 35 in the Android project

2. Support Android 7.0 through Android 15, not just Android 15

3. Only enable edge-to-edge on SDK 35+ using a version check. Don't force it on older versions

4. Add WindowInsets handling so the status bar and nav bar don't cover UI elements on Android 15+

5. Keep backward compatibility - the app must run fine on Android 14, 13, 12, etc.

In android/app/build.gradle, set:

minSdkVersion 24

targetSdkVersion 35

compileSdkVersion 35



Do not set minSdkVersion to 35. That breaks support for 98% of Android devices.



Don't remove support for older Android versions. The app should work for all users, not just Android 15 users.

Remove resizability and orientation restrictions in this app to support large screen devices

From Android 16, Android will ignore resizability and orientation restrictions for large screen devices, such as foldables and tablets. This may lead to layout and 

usability issues for your users.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://quick-calc-wingman.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/68613b03-b3b6-4425-a13b-90166423a9fb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
