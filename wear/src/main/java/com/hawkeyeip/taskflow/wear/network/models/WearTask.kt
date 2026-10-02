package com.hawkeyeip.taskflow.wear.network.models

import com.google.gson.annotations.SerializedName

data class WearTask(
    val id: String,
    val title: String,
    val status: String,
    val priority: String,
    val completed: Boolean = false,
    @SerializedName("due_date") val dueDate: String? = null,
    @SerializedName("is_overdue") val isOverdue: Boolean = false,
    val tags: List<String> = emptyList()
)

data class WearTaskListResponse(
    val success: Boolean,
    val timestamp: String,
    val tasks: List<WearTask>
)

data class WearTaskToggleResponse(
    val success: Boolean,
    val task: WearTask,
    val stats: WearStats? = null
)

data class WearStats(
    val todo: Int = 0,
    @SerializedName("in_progress") val inProgress: Int = 0,
    val done: Int = 0
)

data class WearTileResponse(
    val success: Boolean,
    val tileTitle: String,
    val pendingCount: Int,
    val overdueCount: Int,
    val criticalCount: Int,
    val tasks: List<WearTask>,
    val timestamp: String
)
