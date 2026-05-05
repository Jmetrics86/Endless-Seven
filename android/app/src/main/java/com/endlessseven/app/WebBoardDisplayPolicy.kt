package com.endlessseven.app

import android.content.res.Configuration
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import kotlin.math.max

/**
 * Central place for WebView + shell display rules used by the packaged Three.js board.
 *
 * Large phones (e.g. Galaxy Note-class) in **landscape** are the primary wide-canvas target;
 * tests lock these expectations so OEM font scaling, zoom chrome, and scroll jitter do not regress.
 */
object WebBoardDisplayPolicy {

    const val GAME_URL = "https://appassets.androidplatform.net/assets/web/index.html"
    const val BLANK_PAGE = "about:blank"
    const val TEXT_ZOOM_DEFAULT_PERCENT = 100

    /** Minimum long-edge dp treated as a comfortable “phablet / Note in landscape” board width. */
    const val MIN_LONG_EDGE_DP_FOR_WIDE_BOARD = 700

    /**
     * Returns true when the configuration matches how we expect the shell to run in production
     * (landscape + enough horizontal room). Pure JVM / Robolectric friendly.
     */
    fun isPreferredWideLandscapeBoardConfiguration(config: Configuration): Boolean {
        if (config.orientation != Configuration.ORIENTATION_LANDSCAPE) return false
        val longEdgeDp = max(config.screenWidthDp, config.screenHeightDp)
        return longEdgeDp >= MIN_LONG_EDGE_DP_FOR_WIDE_BOARD
    }

    /**
     * Applies layout, overscroll, zoom, and viewport settings shared by the in-game WebView.
     * Does not attach [android.webkit.WebViewClient] / load URLs — callers own navigation.
     */
    fun applyInGameWebViewDisplaySettings(webView: WebView) {
        webView.apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(Color.BLACK)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            overScrollMode = WebView.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            isFocusable = true
            isFocusableInTouchMode = true
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                allowFileAccess = true
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                useWideViewPort = true
                loadWithOverviewMode = true
                builtInZoomControls = false
                displayZoomControls = false
                setSupportZoom(false)
                textZoom = TEXT_ZOOM_DEFAULT_PERCENT
            }
        }
    }
}
