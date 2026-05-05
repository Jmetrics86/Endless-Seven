package com.endlessseven.app

import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.endlessseven.app.ui.theme.EndlessSevenTheme

class MainActivity : ComponentActivity() {
    /** Paused/resumed with activity; cleared in [AndroidView] onRelease. */
    private var webViewHolder: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val isDebuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        if (isDebuggable) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
        enableEdgeToEdge()
        setContent {
            EndlessSevenTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    EndlessSevenWebBoard(
                        onWebViewAttached = { w -> webViewHolder = w },
                        onWebViewReleased = { webViewHolder = null },
                    )
                }
            }
        }
    }

    override fun onPause() {
        webViewHolder?.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webViewHolder?.onResume()
    }
}

/**
 * Loads the game from packaged assets via [WebViewAssetLoader].
 *
 * Android UX notes:
 * - Activity [onPause]/[onResume] pair with [WebView.onPause]/[onResume] (audio, JS timers, WebGL).
 * - [textZoom] 100 avoids OEM font scaling breaking the fixed HUD layout vs Chrome.
 * - Hardware layer is a common smoothness hint for WebGL-heavy pages.
 */
@Composable
private fun EndlessSevenWebBoard(
    onWebViewAttached: (WebView) -> Unit,
    onWebViewReleased: () -> Unit,
) {
    val appContext = LocalContext.current.applicationContext
    val assetLoader = remember(appContext) {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(appContext))
            .build()
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            WebView(context).apply {
                onWebViewAttached(this)
                WebBoardDisplayPolicy.applyInGameWebViewDisplaySettings(this)

                webChromeClient = WebChromeClient()
                webViewClient = object : WebViewClientCompat() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest,
                    ): WebResourceResponse? {
                        return assetLoader.shouldInterceptRequest(request.url)
                    }

                    @Deprecated("Deprecated in Java")
                    override fun shouldInterceptRequest(
                        view: WebView,
                        url: String,
                    ): WebResourceResponse? {
                        return assetLoader.shouldInterceptRequest(Uri.parse(url))
                    }
                }

                loadUrl(WebBoardDisplayPolicy.GAME_URL)
            }
        },
        onRelease = { webView ->
            onWebViewReleased()
            webView.apply {
                stopLoading()
                loadUrl(WebBoardDisplayPolicy.BLANK_PAGE)
                clearHistory()
                removeAllViews()
                destroy()
            }
        },
    )
}

