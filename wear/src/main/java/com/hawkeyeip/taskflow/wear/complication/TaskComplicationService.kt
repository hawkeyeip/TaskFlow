package com.hawkeyeip.taskflow.wear.complication

import android.app.PendingIntent
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.wear.watchface.complications.data.*
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.hawkeyeip.taskflow.wear.MainActivity
import com.hawkeyeip.taskflow.wear.R
import com.hawkeyeip.taskflow.wear.network.TaskFlowApiClient

class TaskComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder("3").build(),
            contentDescription = PlainComplicationText.Builder("3 tasks pending").build()
        )
            .setTitle(PlainComplicationText.Builder("Tasks").build())
            .setMonochromaticImage(
                MonochromaticImage.Builder(
                    Icon.createWithResource(this, R.drawable.ic_taskflow_logo)
                ).build()
            )
            .build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null

        val tileData = TaskFlowApiClient.fetchTileData()
        val pendingCount = tileData?.pendingCount ?: 0

        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder("$pendingCount").build(),
            contentDescription = PlainComplicationText.Builder("$pendingCount tasks in TaskFlow").build()
        )
            .setTitle(PlainComplicationText.Builder("Tasks").build())
            .setMonochromaticImage(
                MonochromaticImage.Builder(
                    Icon.createWithResource(this, R.drawable.ic_taskflow_logo)
                ).build()
            )
            .setTapAction(pendingIntent)
            .build()
    }
}
