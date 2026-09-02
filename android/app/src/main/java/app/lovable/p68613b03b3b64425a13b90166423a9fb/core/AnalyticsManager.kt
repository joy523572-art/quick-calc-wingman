package app.lovable.p68613b03b3b64425a13b90166423a9fb.core

import android.content.Context
import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.ktx.Firebase

/**
 * Thin, privacy-conscious wrapper over Firebase Analytics.
 * Only non-personal, app-lifecycle events are logged. No user content,
 * no calculation input and no identifiers are ever attached.
 */
class AnalyticsManager private constructor(private val analytics: FirebaseAnalytics?) {

    fun setEnabled(enabled: Boolean) {
        analytics?.setAnalyticsCollectionEnabled(enabled)
    }

    fun screenView(screenName: String) {
        log(FirebaseAnalytics.Event.SCREEN_VIEW) {
            putString(FirebaseAnalytics.Param.SCREEN_NAME, screenName)
            putString(FirebaseAnalytics.Param.SCREEN_CLASS, screenName)
        }
    }

    fun appStart(coldStart: Boolean, durationMs: Long) {
        log(EVENT_APP_START) {
            putBoolean("cold_start", coldStart)
            putLong("duration_ms", durationMs)
        }
    }

    fun webViewLoaded(success: Boolean, durationMs: Long) {
        log(EVENT_WEBVIEW_LOADED) {
            putBoolean("success", success)
            putLong("duration_ms", durationMs)
        }
    }

    fun cacheHit(key: String, hit: Boolean) {
        log(EVENT_CACHE) {
            putString("bucket", key.take(40))
            putBoolean("hit", hit)
        }
    }

    fun connectivity(online: Boolean) {
        log(EVENT_CONNECTIVITY) { putBoolean("online", online) }
    }

    fun nonFatal(type: String) {
        log(EVENT_NON_FATAL) { putString("type", type.take(60)) }
    }

    private inline fun log(name: String, build: Bundle.() -> Unit = {}) {
        val a = analytics ?: return
        runCatching { a.logEvent(name, Bundle().apply(build)) }
    }

    companion object {
        private const val EVENT_APP_START = "app_start"
        private const val EVENT_WEBVIEW_LOADED = "webview_loaded"
        private const val EVENT_CACHE = "cache_access"
        private const val EVENT_CONNECTIVITY = "connectivity_change"
        private const val EVENT_NON_FATAL = "non_fatal_error"

        @Volatile
        private var instance: AnalyticsManager? = null

        fun get(context: Context): AnalyticsManager = instance ?: synchronized(this) {
            instance ?: AnalyticsManager(
                // Firebase is absent until google-services.json is added: degrade to no-op.
                runCatching { Firebase.analytics }.getOrNull()
            ).also {
                instance = it
                it.setEnabled(true)
            }
        }
    }
}
