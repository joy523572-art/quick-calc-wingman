package app.lovable.p68613b03b3b64425a13b90166423a9fb.core

import android.content.Context
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.CacheDatabase
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.ErrorDao
import app.lovable.p68613b03b3b64425a13b90166423a9fb.data.ErrorRecord
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.io.PrintWriter
import java.io.StringWriter
import java.util.concurrent.TimeUnit

/**
 * Installs a global uncaught-exception handler. Fatal crashes are persisted
 * locally (Room) before delegating to the platform handler, and non-fatals
 * can be recorded from anywhere in the app.
 */
class ErrorHandler private constructor(
    private val dao: ErrorDao,
    private val analytics: AnalyticsManager
) : Thread.UncaughtExceptionHandler {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var delegate: Thread.UncaughtExceptionHandler? = null

    val coroutineHandler = CoroutineExceptionHandler { _, throwable ->
        recordNonFatal(throwable)
    }

    fun install() {
        if (delegate != null) return
        delegate = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler(this)
        scope.launch { runCatching { dao.purgeOlderThan(cutoff()) } }
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        runCatching {
            runBlocking { dao.insert(toRecord(thread, throwable, fatal = true)) }
            analytics.nonFatal(throwable.javaClass.simpleName)
        }
        delegate?.uncaughtException(thread, throwable)
    }

    fun recordNonFatal(throwable: Throwable) {
        scope.launch {
            runCatching {
                dao.insert(toRecord(Thread.currentThread(), throwable, fatal = false))
                analytics.nonFatal(throwable.javaClass.simpleName)
            }
        }
    }

    suspend fun recentErrors(limit: Int = 20): List<ErrorRecord> =
        runCatching { dao.recent(limit) }.getOrDefault(emptyList())

    private fun toRecord(thread: Thread, throwable: Throwable, fatal: Boolean) = ErrorRecord(
        threadName = thread.name,
        type = throwable.javaClass.name,
        message = throwable.message.orEmpty().take(512),
        stackTrace = stackTraceOf(throwable).take(8_000),
        fatal = fatal
    )

    private fun stackTraceOf(throwable: Throwable): String {
        val writer = StringWriter()
        PrintWriter(writer).use { throwable.printStackTrace(it) }
        return writer.toString()
    }

    private fun cutoff() = System.currentTimeMillis() - TimeUnit.DAYS.toMillis(14)

    companion object {
        @Volatile
        private var instance: ErrorHandler? = null

        fun get(context: Context): ErrorHandler = instance ?: synchronized(this) {
            instance ?: ErrorHandler(
                CacheDatabase.get(context).errorDao(),
                AnalyticsManager.get(context)
            ).also { instance = it }
        }
    }
}
