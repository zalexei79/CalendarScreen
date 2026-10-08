package com.dayris.calendar;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.Manifest;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;

/** Recognition runs in a microphone service; daily taps never launch the calendar. */
public class VoiceWidgetProvider extends AppWidgetProvider {
    static void update(Context context, String state, float level) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, VoiceWidgetProvider.class));
        for (int id : ids) manager.updateAppWidget(id, views(context, id, state, level));
    }
    private static RemoteViews views(Context context, int id, String state, float level) {
        boolean active = state.equals("listening") || state.equals("processing") || state.equals("saved");
        boolean configured = Build.VERSION.SDK_INT >= 23 && (active || new VoiceWidgetStore(context).grant() != null)
                && context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        Intent intent = configured ? new Intent(context, VoiceWidgetService.class).setAction(VoiceWidgetService.TOGGLE)
                : new Intent(context, VoiceWidgetSetupActivity.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent action = !configured ? PendingIntent.getActivity(context, id, intent, flags)
                : Build.VERSION.SDK_INT >= 26 ? PendingIntent.getForegroundService(context, id, intent, flags)
                : PendingIntent.getService(context, id, intent, flags);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.voice_widget);
        views.setImageViewBitmap(R.id.voice_widget_button, VoiceWidgetArt.draw(state, level));
        views.setViewVisibility(R.id.voice_widget_loading, state.equals("processing") ? View.VISIBLE : View.GONE);
        views.setContentDescription(R.id.voice_widget_button, context.getString(state.equals("listening") ? R.string.voice_widget_listening : R.string.voice_widget_action));
        views.setOnClickPendingIntent(R.id.voice_widget_button, action);
        return views;
    }
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        update(context, "idle", 0);
    }
    @Override public void onDisabled(Context context) {
        context.stopService(new Intent(context, VoiceWidgetService.class));
        VoiceWidgetStore store = new VoiceWidgetStore(context);
        JSONObject credential = store.grant(); store.clear();
        if (credential == null) return;
        final PendingResult result = goAsync();
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection)new URL(credential.getString("endpoint")).openConnection();
                connection.setRequestMethod("POST"); connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(3000); connection.setReadTimeout(3000);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Authorization", "Widget " + credential.getString("secret"));
                connection.setDoOutput(true);
                byte[] body = new JSONObject().put("action", "revoke").put("deviceId", credential.getString("id")).toString().getBytes("UTF-8");
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body); }
                connection.getResponseCode();
            } catch (Exception ignored) { /* Local credential is already erased. Server grant expires. */ }
            finally { if (connection != null) connection.disconnect(); result.finish(); }
        }, "dayris-widget-disconnect").start();
    }
}
