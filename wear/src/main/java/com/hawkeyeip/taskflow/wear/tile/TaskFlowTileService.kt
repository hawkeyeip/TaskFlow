package com.hawkeyeip.taskflow.wear.tile

import androidx.wear.protolayout.*
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.wrap
import androidx.wear.protolayout.LayoutElementBuilders.*
import androidx.wear.protolayout.ModifiersBuilders.*
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.TimelineBuilders.TimelineEntry
import androidx.wear.tiles.RequestBuilders.ResourcesRequest
import androidx.wear.tiles.RequestBuilders.TileRequest
import androidx.wear.tiles.ResourceBuilders.Resources
import androidx.wear.tiles.TileBuilders.Tile
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.hawkeyeip.taskflow.wear.MainActivity
import com.hawkeyeip.taskflow.wear.network.TaskFlowApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.guava.future

class TaskFlowTileService : TileService() {

    private val serviceScope = CoroutineScope(Dispatchers.IO)

    override fun onTileRequest(requestParams: TileRequest): ListenableFuture<Tile> =
        serviceScope.future {
            val tileData = TaskFlowApiClient.fetchTileData()
            val pendingCount = tileData?.pendingCount ?: 0
            val topTasks = tileData?.tasks ?: emptyList()

            val openAppClick = Clickable.Builder()
                .setOnClick(
                    ActionBuilders.LaunchAction.Builder()
                        .setAndroidActivity(
                            ActionBuilders.AndroidActivity.Builder()
                                .setClassName(MainActivity::class.java.name)
                                .setPackageName(packageName)
                                .build()
                        )
                        .build()
                )
                .build()

            val columnBuilder = Column.Builder()
                .setWidth(expand())
                .setHeight(expand())
                .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
                .setModifiers(
                    Modifiers.Builder()
                        .setClickable(openAppClick)
                        .setPadding(Padding.Builder().setAll(dp(12f)).build())
                        .build()
                )

            // Header: "⚡ TASKFLOW"
            columnBuilder.addContent(
                Text.Builder()
                    .setText("⚡ TASKFLOW")
                    .setFontStyle(
                        FontStyle.Builder()
                            .setColor(argb(0xFF00F0FF.toInt()))
                            .setSize(DimensionBuilders.sp(12f))
                            .setWeight(FontStyle.FONT_WEIGHT_BOLD)
                            .build()
                    )
                    .build()
            )

            // Subtitle: "X Pending Duties"
            columnBuilder.addContent(
                Text.Builder()
                    .setText("$pendingCount Pending Duties")
                    .setFontStyle(
                        FontStyle.Builder()
                            .setColor(argb(0xFFB347FF.toInt()))
                            .setSize(DimensionBuilders.sp(10f))
                            .build()
                    )
                    .build()
            )

            columnBuilder.addContent(Spacer.Builder().setHeight(dp(6f)).build())

            // Top items list
            if (topTasks.isEmpty()) {
                columnBuilder.addContent(
                    Text.Builder()
                        .setText("All caught up! ✨")
                        .setFontStyle(
                            FontStyle.Builder()
                                .setColor(argb(0xFF00FF88.toInt()))
                                .setSize(DimensionBuilders.sp(11f))
                                .build()
                        )
                        .build()
                )
            } else {
                topTasks.take(2).forEach { t ->
                    val row = Row.Builder()
                        .setWidth(wrap())
                        .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
                        .addContent(
                            Text.Builder()
                                .setText("• ${t.title}")
                                .setMaxLines(1)
                                .setFontStyle(
                                    FontStyle.Builder()
                                        .setColor(argb(0xFFFFFFFF.toInt()))
                                        .setSize(DimensionBuilders.sp(10f))
                                        .build()
                                )
                                .build()
                        )
                        .build()
                    columnBuilder.addContent(row)
                }
            }

            val layout = Layout.Builder()
                .setRoot(columnBuilder.build())
                .build()

            val timeline = Timeline.Builder()
                .addTimelineEntry(
                    TimelineEntry.Builder()
                        .setLayout(layout)
                        .build()
                )
                .build()

            Tile.Builder()
                .setTimeline(timeline)
                .setFreshnessIntervalMillis(60000) // Refresh every 1 min
                .build()
        }

    override fun onResourcesRequest(requestParams: ResourcesRequest): ListenableFuture<Resources> =
        Futures.immediateFuture(
            Resources.Builder()
                .setVersion("1")
                .build()
        )
}
