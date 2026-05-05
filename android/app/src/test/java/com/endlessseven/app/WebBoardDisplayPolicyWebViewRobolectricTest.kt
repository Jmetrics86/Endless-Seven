package com.endlessseven.app

import android.webkit.WebView
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Robolectric-backed checks for WebView display rules that matter on wide landscape canvases
 * (viewport fit, no zoom chrome, stable text zoom, no overscroll glow).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WebBoardDisplayPolicyWebViewRobolectricTest {

    @Test
    fun applyInGameWebViewDisplaySettings_setsViewportAndDisablesZoomChrome() {
        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        val webView = WebView(ctx)
        WebBoardDisplayPolicy.applyInGameWebViewDisplaySettings(webView)

        val s = webView.settings
        assertTrue(s.useWideViewPort)
        assertTrue(s.loadWithOverviewMode)
        assertFalse(s.builtInZoomControls)
        assertFalse(s.displayZoomControls)
        assertFalse(s.supportZoom())
        assertEquals(WebBoardDisplayPolicy.TEXT_ZOOM_DEFAULT_PERCENT, s.textZoom)
    }

    @Test
    fun applyInGameWebViewDisplaySettings_disablesScrollbarsAndOverscroll() {
        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        val webView = WebView(ctx)
        WebBoardDisplayPolicy.applyInGameWebViewDisplaySettings(webView)

        assertFalse(webView.isVerticalScrollBarEnabled)
        assertFalse(webView.isHorizontalScrollBarEnabled)
        assertEquals(android.webkit.WebView.OVER_SCROLL_NEVER, webView.overScrollMode)
    }
}
