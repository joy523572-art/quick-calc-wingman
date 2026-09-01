# R8 full-mode rules for a Capacitor WebView app.
# Goal: maximum shrinking/obfuscation while keeping the JS bridge functional.

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

# Keep only what the WebView JS bridge reflects on
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { @com.getcapacitor.PluginMethod public <methods>; }
-keep class * extends com.getcapacitor.Plugin { @com.getcapacitor.PluginMethod public <methods>; }
-keep public class * extends android.app.Activity

# Cordova bridge (only present when Cordova plugins are installed)
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# Everything else may be renamed/removed
-dontwarn com.getcapacitor.**
-printmapping mapping.txt
