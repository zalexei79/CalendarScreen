package com.dayris.calendar;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Started directly by a widget PendingIntent (Android's while-in-use exemption). */
public class VoiceWidgetService extends Service implements RecognitionListener {
    static final String TOGGLE = "com.dayris.calendar.WIDGET_MIC";
    static final String STOP = "com.dayris.calendar.WIDGET_STOP";
    private static final String CHANNEL = "dayris_voice_widget";
    private static final int NOTICE = 7201;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private VoiceWidgetStore store;
    private JSONObject grant;
    private SpeechRecognizer recognizer;
    private TextToSpeech speech;
    private boolean capturing, sending, destroyed, ttsReady, receiverRegistered;
    private String state = "idle", replyToken, pendingReply;
    private boolean continueAfterReply;
    private long lastFrame, lastTranscript;
    private float level;
    private Context localized;
    private final Runnable watchdog = () -> pause(R.string.voice_widget_paused);
    private final Runnable stopAfterReply = this::stopSelf;
    private final Runnable resumeAfterReply = this::listen;
    private final BroadcastReceiver screenOff = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { if (!sending) pause(R.string.voice_widget_paused); }
    };

    @Override public void onCreate() {
        super.onCreate(); store = new VoiceWidgetStore(this); localized = this;
        if (Build.VERSION.SDK_INT >= 26) ((NotificationManager)getSystemService(NOTIFICATION_SERVICE))
                .createNotificationChannel(new NotificationChannel(CHANNEL, getString(R.string.voice_widget_name), NotificationManager.IMPORTANCE_LOW));
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenOff, filter, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(screenOff, filter);
        receiverRegistered = true;
        speech = new TextToSpeech(this, status -> handler.post(() -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (pendingReply != null) { String text = pendingReply; pendingReply = null; speakReply(text, continueAfterReply); }
        }));
        speech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { handler.post(() -> replyDone(id)); }
            @Override public void onError(String id) { handler.post(() -> { if (id.equals(replyToken)) pause(R.string.voice_widget_paused); }); }
        });
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || STOP.equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        grant = store.grant();
        if (grant == null || Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            VoiceWidgetProvider.update(this, "error", 0); stopSelf(); return START_NOT_STICKY;
        }
        String language = grant.optString("locale", "ru"); Locale locale = Locale.forLanguageTag(language.equals("zh") ? "zh-CN" : language);
        Configuration configuration = new Configuration(getResources().getConfiguration()); configuration.setLocale(locale);
        localized = createConfigurationContext(configuration);
        try {
            Notification notice = notification(label(sending ? R.string.voice_widget_processing
                    : capturing ? R.string.voice_widget_listening : R.string.voice_widget_starting));
            if (Build.VERSION.SDK_INT >= 30) startForeground(NOTICE, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(NOTICE, notice);
        } catch (RuntimeException denied) { VoiceWidgetProvider.update(this, "error", 0); stopSelf(); return START_NOT_STICKY; }
        if (sending) return START_NOT_STICKY;
        handler.removeCallbacks(stopAfterReply); handler.removeCallbacks(resumeAfterReply);
        if (capturing) {
            recognizer.stopListening(); show("processing", label(R.string.voice_widget_processing)); armWatchdog(15000);
            return START_NOT_STICKY;
        }
        replyToken = null; pendingReply = null; speech.stop();
        JSONObject pending = store.pending();
        if (pending != null) send(pending); else listen();
        return START_NOT_STICKY;
    }
    private String label(int id) { return localized.getString(id); }
    private Notification notification(String text) {
        Intent stop = new Intent(this, VoiceWidgetService.class).setAction(STOP);
        PendingIntent action = PendingIntent.getService(this, 0, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        return builder.setSmallIcon(R.drawable.ic_voice_widget).setContentTitle(label(R.string.voice_widget_name))
                .setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text)).setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE).setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PRIVATE).addAction(android.R.drawable.ic_media_pause, label(R.string.voice_widget_stop), action).build();
    }
    private void show(String next, String text) {
        state = next; VoiceWidgetProvider.update(this, state, 0);
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(NOTICE, notification(text));
    }
    private void armWatchdog(long delay) { handler.removeCallbacks(watchdog); handler.postDelayed(watchdog, delay); }
    private void listen() {
        if (destroyed || sending) return;
        // A response can arrive after screen lock. Never resume capture there.
        if (!((PowerManager)getSystemService(POWER_SERVICE)).isInteractive()) { stopSelf(); return; }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { pause(R.string.voice_widget_no_recognizer); return; }
        if (recognizer == null) { recognizer = SpeechRecognizer.createSpeechRecognizer(this); recognizer.setRecognitionListener(this); }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, grant.optString("locale", "ru").equals("zh") ? "zh-CN" : grant.optString("locale", "ru"))
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        capturing = true; level = 0; show("listening", label(R.string.voice_widget_listening)); armWatchdog(30000);
        try { recognizer.startListening(intent); } catch (RuntimeException error) { capturing = false; pause(R.string.voice_widget_no_recognizer); }
    }
    @Override public void onReadyForSpeech(Bundle params) { if (capturing) show("listening", label(R.string.voice_widget_listening)); }
    @Override public void onBeginningOfSpeech() { if (capturing) armWatchdog(45000); }
    @Override public void onRmsChanged(float rms) {
        if (!capturing || !state.equals("listening")) return;
        float target = Math.max(0, Math.min(1, (rms + 2) / 12)); level = level * .65f + target * .35f;
        long now = android.os.SystemClock.elapsedRealtime();
        if (now - lastFrame >= 200) { lastFrame = now; VoiceWidgetProvider.update(this, "listening", level); }
    }
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() { if (capturing) { show("processing", label(R.string.voice_widget_processing)); armWatchdog(15000); } }
    @Override public void onError(int error) {
        if (!capturing) return;
        capturing = false;
        pause(error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? R.string.voice_widget_permission
                : error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ? R.string.voice_widget_network
                : R.string.voice_widget_no_speech);
    }
    @Override public void onResults(Bundle results) {
        if (!capturing) return;
        capturing = false; handler.removeCallbacks(watchdog);
        ArrayList<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (texts == null || texts.isEmpty() || texts.get(0).trim().isEmpty()) { pause(R.string.voice_widget_no_speech); return; }
        try {
            float[] scores = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
            JSONObject pending = new JSONObject().put("action", "turn").put("deviceId", grant.getString("id"))
                    .put("requestId", UUID.randomUUID().toString()).put("phrase", texts.get(0)).put("createdAt", System.currentTimeMillis())
                    .put("timezone", TimeZone.getDefault().getID())
                    .put("confidence", scores != null && scores.length > 0 && scores[0] > 0 ? scores[0] : 0);
            JSONArray alternatives = new JSONArray(); for (int i = 1; i < Math.min(texts.size(), 4); i++) alternatives.put(texts.get(i));
            pending.put("alternatives", alternatives);
            // Persist before the network call: a lost response uses this SAME ID on retry.
            store.setPending(pending); send(pending);
        } catch (Exception storageError) { pause(R.string.voice_widget_storage_error); }
    }
    @Override public void onPartialResults(Bundle results) {
        if (!capturing) return;
        ArrayList<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        long now = android.os.SystemClock.elapsedRealtime();
        if (texts != null && !texts.isEmpty() && now - lastTranscript > 500) {
            lastTranscript = now; ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(NOTICE, notification(texts.get(0)));
        }
    }
    @Override public void onEvent(int type, Bundle params) {}
    private void send(JSONObject pending) {
        sending = true; show("processing", label(R.string.voice_widget_processing)); handler.removeCallbacks(watchdog);
        final JSONObject credential = grant;
        network.execute(() -> {
            JSONObject reply = null; int status = 0;
            try {
                HttpURLConnection connection = (HttpURLConnection)new URL(credential.getString("endpoint")).openConnection();
                connection.setRequestMethod("POST"); connection.setConnectTimeout(10000); connection.setReadTimeout(20000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("Authorization", "Widget " + credential.getString("secret"));
                connection.setDoOutput(true); byte[] body = pending.toString().getBytes("UTF-8"); connection.setFixedLengthStreamingMode(body.length);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body); }
                status = connection.getResponseCode();
                try (InputStream input = status < 400 ? connection.getInputStream() : connection.getErrorStream()) {
                    if (input == null) throw new IllegalStateException();
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int count;
                    while ((count = input.read(buffer)) != -1) { bytes.write(buffer, 0, count); if (bytes.size() > 64000) throw new IllegalStateException(); }
                    reply = new JSONObject(bytes.toString("UTF-8"));
                } finally { connection.disconnect(); }
            } catch (Exception ignored) {}
            JSONObject value = reply; int code = status;
            handler.post(() -> {
                sending = false; if (destroyed) return;
                if (code == 401) { store.clear(); pause(R.string.voice_widget_expired); return; }
                if (code == 400 && value != null && "INVALID_REQUEST_TIMESTAMP".equals(value.optString("error"))) {
                    try { store.setPending(null); } catch (Exception ignored) {}
                    pause(R.string.voice_widget_old_request); return;
                }
                if (value == null || code != 200 || !value.has("reply")) {
                    pause(value != null && "TURN_CONFLICT".equals(value.optString("error")) ? R.string.voice_widget_conflict : R.string.voice_widget_network);
                    return;
                }
                try { store.setPending(null); } catch (Exception ignored) { pause(R.string.voice_widget_storage_error); return; }
                String response = value.optString("reply"); boolean again = value.optBoolean("listenAgain");
                show(value.optString("status").equals("saved") ? "saved" : "idle", response);
                Toast.makeText(this, response, Toast.LENGTH_LONG).show(); speakReply(value.optString("speech", response), again);
            });
        });
    }
    private void speakReply(String text, boolean again) {
        continueAfterReply = again;
        if (!ttsReady) {
            pendingReply = text; armWatchdog(4000); return;
        }
        Locale locale = Locale.forLanguageTag(grant.optString("locale", "ru").equals("zh") ? "zh-CN" : grant.optString("locale", "ru"));
        if (speech.setLanguage(locale) < TextToSpeech.LANG_AVAILABLE) { pause(R.string.voice_widget_paused); return; }
        handler.removeCallbacks(watchdog); replyToken = UUID.randomUUID().toString(); armWatchdog(30000);
        if (speech.speak(text, TextToSpeech.QUEUE_FLUSH, null, replyToken) == TextToSpeech.ERROR) pause(R.string.voice_widget_paused);
    }
    private void replyDone(String id) {
        if (destroyed || !id.equals(replyToken)) return;
        handler.removeCallbacks(watchdog); replyToken = null;
        if (continueAfterReply) handler.postDelayed(resumeAfterReply, 350); else handler.postDelayed(stopAfterReply, 1200);
    }
    private void pause(int reason) {
        capturing = false; if (recognizer != null) recognizer.cancel();
        handler.removeCallbacks(watchdog); handler.removeCallbacks(stopAfterReply); handler.removeCallbacks(resumeAfterReply);
        replyToken = null; pendingReply = null; if (speech != null) speech.stop();
        show("error", label(reason)); Toast.makeText(this, label(reason), Toast.LENGTH_LONG).show(); handler.postDelayed(stopAfterReply, 2000);
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() {
        destroyed = true; capturing = false; handler.removeCallbacksAndMessages(null);
        if (recognizer != null) { recognizer.cancel(); recognizer.destroy(); }
        if (speech != null) { speech.stop(); speech.shutdown(); }
        if (receiverRegistered) unregisterReceiver(screenOff);
        network.shutdown(); stopForeground(true); VoiceWidgetProvider.update(this, "idle", 0);
        super.onDestroy();
    }
}
