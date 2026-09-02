package app.lovable.p68613b03b3b64425a13b90166423a9fb.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName

/** Cached web payload / calculation history row persisted by Room. */
@Entity(tableName = "cached_entries")
data class CachedEntry(
    @PrimaryKey @ColumnInfo(name = "cache_key") val cacheKey: String,
    @ColumnInfo(name = "payload") val payload: String,
    @ColumnInfo(name = "etag") val etag: String? = null,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "expires_at") val expiresAt: Long = 0L
) {
    val isExpired: Boolean
        get() = expiresAt in 1..System.currentTimeMillis()
}

/** Persisted crash / non-fatal record written by ErrorHandler. */
@Entity(tableName = "error_records")
data class ErrorRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "thread_name") val threadName: String,
    @ColumnInfo(name = "type") val type: String,
    @ColumnInfo(name = "message") val message: String,
    @ColumnInfo(name = "stack_trace") val stackTrace: String,
    @ColumnInfo(name = "fatal") val fatal: Boolean,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis()
)

/** Remote config DTO fetched over Retrofit; field names are stable for Gson. */
data class RemoteConfigDto(
    @SerializedName("version") val version: String? = null,
    @SerializedName("min_supported_version") val minSupportedVersion: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("features") val features: Map<String, Boolean>? = null
)

/** Generic result wrapper used across the native module. */
sealed class Outcome<out T> {
    data class Success<T>(val value: T, val fromCache: Boolean = false) : Outcome<T>()
    data class Failure(val error: Throwable, val code: Int? = null) : Outcome<Nothing>()

    inline fun <R> map(transform: (T) -> R): Outcome<R> = when (this) {
        is Success -> Success(transform(value), fromCache)
        is Failure -> this
    }

    fun getOrNull(): T? = (this as? Success)?.value
}
