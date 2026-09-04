# Android Release Workflow

The workflow in `android-release.yml` builds a signed Android App Bundle (AAB) and the ProGuard/R8 deobfuscation `mapping.txt` file automatically on GitHub.

## Required GitHub Secrets

Go to **GitHub repository → Settings → Secrets and variables → Actions → New repository secret** and add these four secrets:

| Secret name | What it is | How to get it |
|-------------|------------|---------------|
| `KEYSTORE_BASE64` | Your upload keystore file, Base64-encoded | `base64 -i upload-keystore.jks -w 0` (Linux) or `base64 -i upload-keystore.jks` (Mac) |
| `KEYSTORE_PASSWORD` | Password for the keystore file | The password you chose when creating the keystore |
| `KEY_ALIAS` | Alias of the signing key inside the keystore | The alias you chose when creating the key |
| `KEY_PASSWORD` | Password for the signing key alias | Usually the same as `KEYSTORE_PASSWORD` |

## Creating an upload keystore (one-time)

If you do not have a keystore yet, generate one with Java's `keytool`:

```bash
keytool -genkey -v \
  -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD
```

When prompted, fill in your name/organization details. Use the same alias and passwords in the GitHub secrets above.

## Running the workflow

1. Push the workflow file to the `main` or `master` branch.
2. Go to **Actions → Build Android Release (AAB + Mapping)**.
3. Click **Run workflow**.
4. When the run finishes, download:
   - `app-release-aab` → upload this `.aab` to Google Play Console.
   - `mapping-release` → upload this `mapping.txt` to Play Console under **App bundle explorer → Downloads → ReTrace mapping file** to remove the deobfuscation warning.

## What the workflow does

1. Checks out the code.
2. Installs Node.js dependencies and builds the Vite web app into `dist/`.
3. Sets up JDK 17 and the Android SDK.
4. Runs `npx cap sync android` to copy the web build into the Android project.
5. Decodes your keystore from the `KEYSTORE_BASE64` secret.
6. Builds a signed release AAB with R8 full mode, code shrinking, and resource shrinking enabled.
7. Uploads the signed AAB and the `mapping.txt` file as workflow artifacts.
