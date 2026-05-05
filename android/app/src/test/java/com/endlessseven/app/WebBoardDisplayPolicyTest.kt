package com.endlessseven.app

import android.content.res.Configuration
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebBoardDisplayPolicyTest {

    @Test
    fun preferredWideLandscape_trueForGalaxyNoteLandscapeApprox() {
        val config = Configuration().apply {
            orientation = Configuration.ORIENTATION_LANDSCAPE
            screenWidthDp = 411
            screenHeightDp = 823
        }
        assertTrue(WebBoardDisplayPolicy.isPreferredWideLandscapeBoardConfiguration(config))
    }

    @Test
    fun preferredWideLandscape_falseWhenPortrait() {
        val config = Configuration().apply {
            orientation = Configuration.ORIENTATION_PORTRAIT
            screenWidthDp = 411
            screenHeightDp = 823
        }
        assertFalse(WebBoardDisplayPolicy.isPreferredWideLandscapeBoardConfiguration(config))
    }

    @Test
    fun preferredWideLandscape_falseWhenShortLongEdge() {
        val config = Configuration().apply {
            orientation = Configuration.ORIENTATION_LANDSCAPE
            screenWidthDp = 320
            screenHeightDp = 240
        }
        assertFalse(WebBoardDisplayPolicy.isPreferredWideLandscapeBoardConfiguration(config))
    }

    @Test
    fun gameUrlUsesAppAssetsHost() {
        assertTrue(
            WebBoardDisplayPolicy.GAME_URL.startsWith("https://appassets.androidplatform.net/"),
        )
    }
}
