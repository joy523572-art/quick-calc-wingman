package app.lovable.p68613b03b3b64425a13b90166423a9fb.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Dao
interface CacheDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: CachedEntry)

    @Query("SELECT * FROM cached_entries WHERE cache_key = :key LIMIT 1")
    suspend fun find(key: String): CachedEntry?

    @Query("SELECT * FROM cached_entries ORDER BY created_at DESC LIMIT :limit")
    fun observeRecent(limit: Int): Flow<List<CachedEntry>>

    @Query("DELETE FROM cached_entries WHERE expires_at > 0 AND expires_at < :now")
    suspend fun purgeExpired(now: Long): Int

    @Query("DELETE FROM cached_entries")
    suspend fun clear()

    @Query("SELECT COUNT(*) FROM cached_entries")
    suspend fun count(): Int
}

@Dao
interface ErrorDao {

    @Insert
    suspend fun insert(record: ErrorRecord): Long

    @Query("SELECT * FROM error_records ORDER BY created_at DESC LIMIT :limit")
    suspend fun recent(limit: Int): List<ErrorRecord>

    @Query("DELETE FROM error_records WHERE created_at < :cutoff")
    suspend fun purgeOlderThan(cutoff: Long): Int

    @Query("DELETE FROM error_records")
    suspend fun clear()
}

@Database(
    entities = [CachedEntry::class, ErrorRecord::class],
    version = 1,
    exportSchema = true
)
abstract class CacheDatabase : RoomDatabase() {

    abstract fun cacheDao(): CacheDao
    abstract fun errorDao(): ErrorDao

    companion object {
        @Volatile
        private var instance: CacheDatabase? = null

        fun get(context: Context): CacheDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                CacheDatabase::class.java,
                "app_cache.db"
            )
                .fallbackToDestructiveMigration()
                .build()
                .also { instance = it }
        }
    }
}
