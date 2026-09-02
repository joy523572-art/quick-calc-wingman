package app.lovable.p68613b03b3b64425a13b90166423a9fb.core

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.Outcome
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.RemoteConfigDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Cache
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Url
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

interface AppApi {
    @GET
    suspend fun fetchRemoteConfig(@Url url: String): RemoteConfigDto

    @GET
    suspend fun head(@Url url: String): okhttp3.ResponseBody
}

/**
 * Owns the OkHttp/Retrofit stack: connectivity checks, retry with backoff,
 * disk caching and offline-friendly cache-control rewriting.
 */
class NetworkManager private constructor(
    private val appContext: Context,
    private val client: OkHttpClient,
    private val api: AppApi
) {

    fun isOnline(): Boolean {
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    suspend fun getRemoteConfig(url: String): Outcome<RemoteConfigDto> = withContext(Dispatchers.IO) {
        retrying(attempts = MAX_ATTEMPTS) {
            Outcome.Success(api.fetchRemoteConfig(url))
        }
    }

    suspend fun getRaw(url: String): Outcome<String> = withContext(Dispatchers.IO) {
        retrying(attempts = MAX_ATTEMPTS) {
            val request = Request.Builder().url(url).get().build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Outcome.Failure(IOException("HTTP ${response.code}"), response.code)
                } else {
                    Outcome.Success(response.body?.string().orEmpty())
                }
            }
        }
    }

    private suspend fun <T> retrying(
        attempts: Int,
        block: suspend () -> Outcome<T>
    ): Outcome<T> {
        var lastError: Throwable? = null
        var delayMs = INITIAL_BACKOFF_MS
        repeat(attempts) { attempt ->
            try {
                val result = block()
                if (result is Outcome.Success) return result
                lastError = (result as Outcome.Failure).error
            } catch (io: IOException) {
                lastError = io
            } catch (t: Throwable) {
                return Outcome.Failure(t)
            }
            if (attempt < attempts - 1) {
                kotlinx.coroutines.delay(delayMs)
                delayMs *= 2
            }
        }
        return Outcome.Failure(lastError ?: IOException("Unknown network failure"))
    }

    fun shutdown() {
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
        runCatching { client.cache?.flush() }
    }

    private class OfflineCacheInterceptor(
        private val online: () -> Boolean
    ) : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val builder = chain.request().newBuilder()
            if (!online()) {
                builder.header(
                    "Cache-Control",
                    "public, only-if-cached, max-stale=${MAX_STALE_SECONDS}"
                )
            }
            return chain.proceed(builder.build())
        }
    }

    private class UserAgentInterceptor(private val ua: String) : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response =
            chain.proceed(chain.request().newBuilder().header("User-Agent", ua).build())
    }

    companion object {
        private const val MAX_ATTEMPTS = 3
        private const val INITIAL_BACKOFF_MS = 400L
        private const val MAX_STALE_SECONDS = 60 * 60 * 24 * 7
        private const val CACHE_BYTES = 8L * 1024 * 1024
        private const val BASE_URL = "https://quick-calc-wingman.lovable.app/"

        @Volatile
        private var instance: NetworkManager? = null

        fun get(context: Context): NetworkManager = instance ?: synchronized(this) {
            instance ?: build(context.applicationContext).also { instance = it }
        }

        private fun build(appContext: Context): NetworkManager {
            val cacheDir = File(appContext.cacheDir, "http_cache")
            lateinit var manager: NetworkManager
            val client = OkHttpClient.Builder()
                .cache(Cache(cacheDir, CACHE_BYTES))
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .writeTimeout(20, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .addInterceptor(UserAgentInterceptor("SciCalc-Android"))
                .addInterceptor(OfflineCacheInterceptor { manager.isOnline() })
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            manager = NetworkManager(appContext, client, retrofit.create(AppApi::class.java))
            return manager
        }
    }
}
