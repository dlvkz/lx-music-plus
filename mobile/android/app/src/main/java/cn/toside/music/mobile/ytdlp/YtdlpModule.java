package cn.toside.music.mobile.ytdlp;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * yt-dlp (youtubedl-android: python + yt-dlp bundled with the app) for the YouTube secondary source.
 * Android 7.0+ only (the library needs it). yt-dlp updates itself once a week (YouTube changes break
 * the old versions).
 */
public class YtdlpModule extends ReactContextBaseJavaModule {
  private static final String TAG = "LxYtdlp";
  private static final long UPDATE_INTERVAL = 7L * 24 * 60 * 60 * 1000;
  private static final ExecutorService executor = Executors.newFixedThreadPool(3);
  private static final Object initLock = new Object();
  private static boolean initialized = false;
  private static boolean updating = false;
  // the update replaces the files of yt-dlp: the runs wait for it
  private static final ReentrantReadWriteLock filesLock = new ReentrantReadWriteLock();

  YtdlpModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "YtdlpModule";
  }

  public static boolean isSupported() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N;
  }

  private void ensureInit() throws Exception {
    synchronized (initLock) {
      if (initialized) return;
      Context context = getReactApplicationContext().getApplicationContext();
      YoutubeDL.getInstance().init(context);
      initialized = true;
    }
    updateIfNeeded();
  }

  private void updateIfNeeded() {
    Context context = getReactApplicationContext().getApplicationContext();
    SharedPreferences prefs = context.getSharedPreferences("lx_ytdlp", Context.MODE_PRIVATE);
    long lastUpdate = prefs.getLong("last_update", 0);
    if (updating || System.currentTimeMillis() - lastUpdate < UPDATE_INTERVAL) return;
    updating = true;
    Runnable update = () -> {
      filesLock.writeLock().lock();
      try {
        YoutubeDL.UpdateStatus status = YoutubeDL.getInstance().updateYoutubeDL(context, YoutubeDL.UpdateChannel._STABLE);
        Log.i(TAG, "update: " + status);
        prefs.edit().putLong("last_update", System.currentTimeMillis()).apply();
      } catch (Exception e) {
        Log.w(TAG, "update failed", e);
      } finally {
        filesLock.writeLock().unlock();
        updating = false;
      }
    };
    // the yt-dlp of the library is older than the app: the first run waits for the update
    if (lastUpdate == 0) update.run();
    else executor.execute(update);
  }

  @ReactMethod
  public void isAvailable(Promise promise) {
    promise.resolve(isSupported());
  }

  /**
   * Run yt-dlp with these options and this url, resolves with what it prints
   */
  @ReactMethod
  public void run(String url, ReadableArray options, Promise promise) {
    if (!isSupported()) {
      promise.reject("unsupported", "yt-dlp needs Android 7.0");
      return;
    }
    List<String> args = new ArrayList<>();
    for (int i = 0; i < options.size(); i++) args.add(options.getString(i));
    executor.execute(() -> {
      try {
        ensureInit();
        YoutubeDLRequest request = new YoutubeDLRequest(url);
        request.addCommands(args);
        filesLock.readLock().lock();
        try {
          YoutubeDLResponse response = YoutubeDL.getInstance().execute(request);
          promise.resolve(response.getOut());
        } finally {
          filesLock.readLock().unlock();
        }
      } catch (Throwable e) {
        Log.w(TAG, "run failed", e);
        promise.reject("ytdlp_error", e.getMessage() == null ? e.toString() : e.getMessage());
      }
    });
  }
}
