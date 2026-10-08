package com.dayris.calendar;

import android.Manifest;
import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import org.json.JSONObject;
import java.util.UUID;

/** One-time configuration. Only a validated DAYRIS origin can supply a device grant. */
public class VoiceWidgetSetupActivity extends Activity {
    private static final String COMPLETE = "com.dayris.calendar.WIDGET_CONNECTED";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String nonce = UUID.randomUUID().toString();
    private int widgetId;
    private Uri origin;
    private CustomTabsSession session;
    private CustomTabsServiceConnection connection;
    private boolean bound, validated, navigationFinished, channelRequested, paired;
    private TextView status;
    private final Runnable closeBrowser = () -> startActivity(new Intent(this, VoiceWidgetSetupActivity.class).setAction(COMPLETE)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
    private final Runnable hello = new Runnable() {
        @Override public void run() {
            if (session == null || paired) return;
            try { session.postMessage(new JSONObject().put("type", "dayris.widget.hello").put("nonce", nonce).toString(), null); } catch (Exception ignored) {}
            handler.postDelayed(this, 2000);
        }
    };

    @Override protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        setResult(RESULT_CANCELED);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
        if (info == null || !info.provider.equals(new ComponentName(this, VoiceWidgetProvider.class))) { finish(); return; }
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL); layout.setPadding(32, 70, 32, 32); layout.setBackgroundColor(0xFF191B1F);
        status = new TextView(this); status.setTextColor(0xFFF4F1E9); status.setTextSize(19); status.setText(R.string.voice_widget_setup);
        layout.addView(status);
        Button retry = new Button(this); retry.setText(R.string.voice_widget_connect); retry.setOnClickListener(view -> begin());
        layout.addView(retry); setContentView(layout);
        if (Build.VERSION.SDK_INT < 23) { status.setText(R.string.voice_widget_unsupported); return; }
        if (new VoiceWidgetStore(this).grant() != null && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { finishConfigured(); return; }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 40);
        else begin();
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 40 && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) begin();
        else { status.setText(R.string.voice_widget_permission); VoiceWidgetProvider.update(this, "idle", 0); }
    }
    private void begin() {
        if (Build.VERSION.SDK_INT < 23) return;
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 40); return;
        }
        if (new VoiceWidgetStore(this).grant() != null) { finishConfigured(); return; }
        if (bound) { unbindService(connection); bound = false; }
        handler.removeCallbacks(hello); validated = false; navigationFinished = false; channelRequested = false;
        origin = Uri.parse(getString(R.string.launchUrl)).buildUpon().path("").clearQuery().fragment(null).build();
        String provider = CustomTabsClient.getPackageName(this, null);
        if (provider == null) { status.setText(R.string.voice_widget_browser); return; }
        connection = new CustomTabsServiceConnection() {
            @Override public void onCustomTabsServiceConnected(ComponentName name, CustomTabsClient client) {
                client.warmup(0); session = client.newSession(callback);
                if (session == null) { status.setText(R.string.voice_widget_browser); return; }
                session.validateRelationship(CustomTabsService.RELATION_USE_AS_ORIGIN, origin, null);
                Uri url = Uri.parse(getString(R.string.launchUrl)).buildUpon().appendQueryParameter("widgetSetup", "1").build();
                new TrustedWebActivityIntentBuilder(url).build(session).launchTrustedWebActivity(VoiceWidgetSetupActivity.this);
            }
            @Override public void onServiceDisconnected(ComponentName name) { session = null; handler.removeCallbacks(hello); }
        };
        bound = CustomTabsClient.bindCustomTabsService(this, provider, connection);
        if (!bound) status.setText(R.string.voice_widget_browser);
    }
    private void requestChannel() {
        if (session != null && validated && navigationFinished && !channelRequested) {
            channelRequested = session.requestPostMessageChannel(origin, origin, new Bundle());
        }
    }
    private final CustomTabsCallback callback = new CustomTabsCallback() {
        @Override public void onRelationshipValidationResult(int relation, Uri requestedOrigin, boolean result, Bundle extras) {
            if (relation != CustomTabsService.RELATION_USE_AS_ORIGIN || !origin.equals(requestedOrigin)) return;
            handler.post(() -> { validated = result; if (!result) status.setText(R.string.voice_widget_pair_error); requestChannel(); });
        }
        @Override public void onNavigationEvent(int event, Bundle extras) {
            if (event == NAVIGATION_STARTED) handler.post(() -> { navigationFinished = false; channelRequested = false; handler.removeCallbacks(hello); });
            if (event == NAVIGATION_FINISHED) handler.post(() -> { navigationFinished = true; requestChannel(); });
        }
        @Override public void onMessageChannelReady(Bundle extras) { handler.post(() -> { handler.removeCallbacks(hello); hello.run(); }); }
        @Override public void onPostMessage(String message, Bundle extras) {
            handler.post(() -> {
                if (!validated || message.length() > 5000) return;
                try {
                    JSONObject payload = new JSONObject(message);
                    if (paired && "dayris.widget.finish".equals(payload.optString("type")) && nonce.equals(payload.optString("nonce"))) { closeBrowser.run(); return; }
                    if (paired) return;
                    if (!"dayris.widget.paired".equals(payload.optString("type")) || !nonce.equals(payload.optString("nonce"))) return;
                    JSONObject grant = payload.getJSONObject("grant"); Uri endpoint = Uri.parse(grant.getString("endpoint"));
                    if (!"https".equals(endpoint.getScheme()) || endpoint.getHost() == null || !"/functions/v1/widget-voice".equals(endpoint.getPath()) || endpoint.getUserInfo() != null || endpoint.getQuery() != null) throw new IllegalArgumentException();
                    if (!grant.getString("id").matches("[a-fA-F0-9-]{36}") || !grant.getString("secret").matches("[a-f0-9]{64}")) throw new IllegalArgumentException();
                    new VoiceWidgetStore(VoiceWidgetSetupActivity.this).setGrant(grant);
                    paired = true; handler.removeCallbacks(hello); VoiceWidgetProvider.update(VoiceWidgetSetupActivity.this, "idle", 0);
                    handler.postDelayed(closeBrowser, 1800);
                    if (session != null) session.postMessage(new JSONObject().put("type", "dayris.widget.confirmed").put("nonce", nonce).toString(), null);
                } catch (Exception ignored) { status.setText(R.string.voice_widget_pair_error); }
            });
        }
    };
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); if (paired && COMPLETE.equals(intent.getAction())) finishConfigured(); }
    private void finishConfigured() {
        VoiceWidgetProvider.update(this, "idle", 0);
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        finish();
    }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); if (bound) unbindService(connection); super.onDestroy(); }
}
