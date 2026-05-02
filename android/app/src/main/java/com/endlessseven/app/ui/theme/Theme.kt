package com.endlessseven.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFE94560),
    onPrimary = Color.White,
    background = Color(0xFF1A1A2E),
    onBackground = Color(0xFFEAEAEA),
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFFC73E54),
    onPrimary = Color.White,
    background = Color(0xFFF5F5F7),
    onBackground = Color(0xFF1A1A2E),
)

@Composable
fun EndlessSevenTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content,
    )
}
