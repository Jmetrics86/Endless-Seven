package com.endlessseven.app

import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Locks launcher activity metadata that affects large-phone landscape UX
 * (orientation policy, rotation handling, IME resize).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MainActivityManifestTest {

    @Test
    fun mainActivity_isSensorLandscape() {
        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        val pkg = ctx.packageName
        val flags = PackageManager.GET_ACTIVITIES or PackageManager.GET_META_DATA
        val activities = ctx.packageManager.getPackageInfo(pkg, flags).activities
        val main = activities?.firstOrNull { it.name == MainActivity::class.java.name }
            ?: error("MainActivity not declared in merged manifest for tests")

        assertEquals(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE, main.screenOrientation)
    }

    @Test
    fun mainActivity_handlesOrientationAndScreenLayoutConfigChanges() {
        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        val pkg = ctx.packageName
        val flags = PackageManager.GET_ACTIVITIES or PackageManager.GET_META_DATA
        val activities = ctx.packageManager.getPackageInfo(pkg, flags).activities
        val main = activities?.firstOrNull { it.name == MainActivity::class.java.name }
            ?: error("MainActivity not declared in merged manifest for tests")

        val expectedMask =
            android.content.pm.ActivityInfo.CONFIG_ORIENTATION or
                android.content.pm.ActivityInfo.CONFIG_SCREEN_SIZE or
                android.content.pm.ActivityInfo.CONFIG_SCREEN_LAYOUT or
                android.content.pm.ActivityInfo.CONFIG_KEYBOARD_HIDDEN

        assertEquals(
            "MainActivity should declare orientation|screenSize|screenLayout|keyboardHidden in configChanges for stable WebView on rotation.",
            expectedMask,
            main.configChanges and expectedMask,
        )
    }

    @Test
    @Suppress("DEPRECATION")
    fun mainActivity_softInputModeIsAdjustResize() {
        val ctx = ApplicationProvider.getApplicationContext<android.content.Context>()
        val pkg = ctx.packageName
        val flags = PackageManager.GET_ACTIVITIES or PackageManager.GET_META_DATA
        val activities = ctx.packageManager.getPackageInfo(pkg, flags).activities
        val main = activities?.firstOrNull { it.name == MainActivity::class.java.name }
            ?: error("MainActivity not declared in merged manifest for tests")

        val mode = main.softInputMode and android.view.WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST
        assertEquals(
            android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,
            mode,
        )
    }
}
