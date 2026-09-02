package app.lovable.p68613b03b3b64425a13b90166423a9fb.core

import android.content.Context
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.CacheDao
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.CacheDatabase
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.CachedEntry
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.Outcome
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Room-backed cache for web payloads. Provides stale-while-revalidate reads
 * so the WebView content stays usable offline.
 */
class CacheManager private constructor(private val dao: CacheDao) {

    suspend fun put(
        key: String,
        payload: String,
        etag: String? = null,
        ttlMillis: Long = DEFAULT_TTL_MS
    ) = withContext(Dispatchers.IO) {
        dao.upsert(
            CachedEntry(
                cacheKey = key,
                payload = payload,
                etag = etag,
                expiresAt = if (ttlMillis > 0) System.currentTimeMillis() + ttlMillis else 0L
            )
        )
    }

    suspend fun get(key: String, allowStale: Boolean = true): CachedEntry? =
        withContext(Dispatchers.IO) {
            val entry = dao.find(key) ?: return@withContext null
            if (entry.isExpired && !allowStale) null else entry
        }

    fun observeRecent(limit: Int = 25): Flow<List<CachedEntry>> = dao.observeRecent(limit)

    /**
     * Returns cached data immediately when fresh, otherwise fetches and stores.
     */
    suspend fun getOrFetch(
        key: String,
        fetcher: suspend () -> Outcome<String>
    ): Outcome<String> = withContext(Dispatchers.IO) {
        val cached = dao.find(key)
        if (cached != null && !cached.isExpired) {
            return@withContext Outcome.Success(cached.payload, fromCache = true)
        }
        when (val fresh = fetcher()) {
            is Outcome.Success -> {
                put(key, fresh.value)
                fresh
            }
            is Outcome.Failure -> cached?.let { Outcome.Success(it.payload, fromCache = true) }
                ?: fresh
        }
    }

    suspend fun trim(): Int = withContext(Dispatchers.IO) {
        dao.purgeExpired(System.currentTimeMillis())
    }

    suspend fun size(): Int = withContext(Dispatchers.IO) { dao.count() }

    suspend fun clearAll() = withContext(Dispatchers.IO) { dao.clear() }

    companion object {
        private val DEFAULT_TTL_MS = TimeUnit.HOURS.toMillis(12)

        @Volatile
        private var instance: CacheManager? = null

        fun get(context: Context): CacheManager = instance ?: synchronized(this) {
            instance ?: CacheManager(CacheDatabase.get(context).cacheDao())
                .also { instance = it }
        }
    }
}
