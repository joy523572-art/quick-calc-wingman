# R8 full-mode rules for a hybrid native + WebView app.
# Goal: maximum shrinking/obfuscation while keeping the JS bridge functional.
# No blanket `-keep class **` rules anywhere in this file.

-optimizationpasses 5
-allowaccessmodification
-repackageclasses ''
-overloadaggressively

# Strip logging from release builds
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# --- The only bridge surface that must survive renaming ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { @com.getcapacitor.PluginMethod public <methods>; }
-keep class * extends com.getcapacitor.Plugin { @com.getcapacitor.PluginMethod public <methods>; }
-keep public class * extends android.app.Activity

# Cordova bridge (only present when Cordova plugins are installed)
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# --- Reflection-sensitive members only (classes themselves stay obfuscated) ---
# Gson models: keep field names of our DTOs, allow class renaming.
-keepclassmembers class app.lovable.p68613b03b3b64425a13b90166423a9fb.data.** {
    <fields>;
}
-keepattributes Signature, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, AnnotationDefault

# Retrofit: generic signatures of service methods
-keepclassmembers,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn retrofit2.**
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn kotlinx.coroutines.**
-dontwarn com.getcapacitor.**

-printmapping mapping.txt
-printusage usage.txt
