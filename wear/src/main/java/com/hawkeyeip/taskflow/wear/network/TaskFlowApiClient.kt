package com.hawkeyeip.taskflow.wear.network

import com.google.gson.Gson
import com.hawkeyeip.taskflow.wear.network.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

object TaskFlowApiClient {

    // Default development host: 10.0.2.2 maps to host localhost from Android Emulator
    // For physical watches, point to your Mac/PC local IP (e.g., http://192.168.1.X:3847)
    var baseUrl: String = "http://10.0.2.2:3847"

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    suspend fun fetchWearTasks(): List<WearTask> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/api/wear/tasks")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: return@withContext emptyList()
            val parsed = gson.fromJson(body, WearTaskListResponse::class.java)
            parsed.tasks
        }
    }

    suspend fun toggleTask(id: String): WearTask? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/api/wear/tasks/$id/toggle")
            .post("{}".toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext null
            val body = response.body?.string() ?: return@withContext null
            val parsed = gson.fromJson(body, WearTaskToggleResponse::class.java)
            parsed.task
        }
    }

    suspend fun quickAddTask(title: String, priority: String = "medium"): WearTask? = withContext(Dispatchers.IO) {
        val jsonPayload = gson.toJson(mapOf("title" to title, "priority" to priority))
        val request = Request.Builder()
            .url("$baseUrl/api/wear/tasks/quick-add")
            .post(jsonPayload.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext null
            val body = response.body?.string() ?: return@withContext null
            val parsed = gson.fromJson(body, WearTaskToggleResponse::class.java)
            parsed.task
        }
    }

    suspend fun fetchTileData(): WearTileResponse? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/api/wear/tile")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext null
            val body = response.body?.string() ?: return@withContext null
            gson.fromJson(body, WearTileResponse::class.java)
        }
    }
}
