package app.lovable.p68613b03b3b64425a13b90166423a9fb.core

import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView

/**
 * Centralises WebView tuning and teardown so memory is released deterministically.
 */
object WebViewOptimizer {

    fun tune(webView: WebView) {
        webView.settings.apply {
            cacheMode = WebSettings.LOAD_DEFAULT
            domStorageEnabled = true
            setGeolocationEnabled(false)
            saveFormData = false
            mediaPlaybackRequiresUserGesture = true
            javaScriptCanOpenWindowsAutomatically = false
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
        }
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_NEVER
    }

    fun pause(webView: WebView?) {
        webView ?: return
        webView.onPause()
        webView.pauseTimers()
    }

    fun resume(webView: WebView?) {
        webView ?: return
        webView.resumeTimers()
        webView.onResume()
    }

    fun trim(webView: WebView?, level: Int, threshold: Int) {
        webView ?: return
        if (level >= threshold) {
            webView.clearCache(false)
            webView.freeMemory()
        }
    }

    fun destroy(webView: WebView?) {
        webView ?: return
        webView.loadUrl("about:blank")
        webView.stopLoading()
        webView.clearHistory()
        webView.clearFormData()
        webView.clearCache(true)
        webView.removeAllViews()
        (webView.parent as? android.view.ViewGroup)?.removeView(webView)
        webView.destroy()
    }
}
