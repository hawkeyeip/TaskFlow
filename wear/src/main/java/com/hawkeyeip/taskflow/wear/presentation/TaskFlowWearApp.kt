package com.hawkeyeip.taskflow.wear.presentation

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.hawkeyeip.taskflow.wear.network.TaskFlowApiClient
import com.hawkeyeip.taskflow.wear.network.models.WearTask
import com.hawkeyeip.taskflow.wear.presentation.theme.*
import kotlinx.coroutines.launch

@Composable
fun TaskFlowWearApp() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val listState = rememberScalingLazyListState()

    var tasks by remember { mutableStateOf<List<WearTask>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    // Speech-to-text launcher for wrist quick-add
    val speechLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spokenText = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
            if (!spokenText.isNullOrBlank()) {
                coroutineScope.launch {
                    TaskFlowApiClient.quickAddTask(spokenText)
                    tasks = TaskFlowApiClient.fetchWearTasks()
                }
            }
        }
    }

    fun triggerHaptic() {
        val vibrator = context.getSystemService(Vibrator::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            vibrator?.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(50)
        }
    }

    LaunchedEffect(Unit) {
        tasks = TaskFlowApiClient.fetchWearTasks()
        isLoading = false
    }

    TaskFlowWearTheme {
        Scaffold(
            timeText = { TimeText() },
            vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) }
        ) {
            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(indicatorColor = NeonCyan)
                }
            } else {
                ScalingLazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    state = listState,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // App Header
                    item {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "TASKFLOW",
                                color = NeonCyan,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Text(
                                text = "${tasks.count { !it.completed }} duties left",
                                color = TextMuted,
                                fontSize = 10.sp
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                        }
                    }

                    // Voice Capture Button
                    item {
                        CompactChip(
                            onClick = {
                                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                    putExtra(
                                        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                                    )
                                    putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak task title...")
                                }
                                speechLauncher.launch(intent)
                            },
                            label = { Text("🎙️ Quick Dictate", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                            colors = ChipDefaults.chipColors(
                                backgroundColor = NeonPurple.copy(alpha = 0.2f),
                                contentColor = NeonPurple
                            ),
                            modifier = Modifier.fillMaxWidth(0.9f)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    // Empty state
                    if (tasks.isEmpty()) {
                        item {
                            Text(
                                text = "All duties done! ✨",
                                color = NeonGreen,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }

                    // Task List
                    items(tasks, key = { it.id }) { task ->
                        val priorityColor = when (task.priority) {
                            "critical" -> NeonRed
                            "high" -> NeonOrange
                            "medium" -> NeonCyan
                            else -> Color.Gray
                        }

                        ToggleChip(
                            checked = task.completed,
                            onCheckedChange = {
                                triggerHaptic()
                                coroutineScope.launch {
                                    val updated = TaskFlowApiClient.toggleTask(task.id)
                                    if (updated != null) {
                                        tasks = tasks.map { if (it.id == task.id) updated else it }
                                    }
                                }
                            },
                            label = {
                                Text(
                                    text = task.title,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                    fontSize = 11.sp,
                                    textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None
                                )
                            },
                            secondaryLabel = {
                                if (task.isOverdue) {
                                    Text("⚠️ Overdue", color = NeonRed, fontSize = 9.sp)
                                } else if (task.dueDate != null) {
                                    Text("📅 ${task.dueDate}", color = TextMuted, fontSize = 9.sp)
                                }
                            },
                            appIcon = {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .background(priorityColor, CircleShape)
                                )
                            },
                            toggleControl = {
                                Checkbox(checked = task.completed)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}
