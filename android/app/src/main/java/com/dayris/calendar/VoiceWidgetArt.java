package com.dayris.calendar;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

final class VoiceWidgetArt {
    static Bitmap draw(String state, float level) {
        Bitmap bitmap = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap); Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        boolean listening = state.equals("listening"), saved = state.equals("saved"), error = state.equals("error");
        int accent = Color.parseColor(saved ? "#78CEAE" : error ? "#DB9A84" : "#DBC58A");
        level = Math.max(0, Math.min(1, level));
        paint.setColor(Color.parseColor("#181A1E")); canvas.drawCircle(96, 96, 88, paint);
        paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(listening ? 2 + level * 4 : 2);
        paint.setColor(accent); paint.setAlpha(listening ? 160 + (int)(level * 95) : 130);
        canvas.drawCircle(96, 96, listening ? 85 + level * 5 : 88, paint);
        paint.setAlpha(255); paint.setStrokeWidth(6); paint.setStrokeCap(Paint.Cap.ROUND); paint.setStrokeJoin(Paint.Join.ROUND);
        if (saved) {
            Path path = new Path(); path.moveTo(64, 98); path.lineTo(86, 120); path.lineTo(130, 74); canvas.drawPath(path, paint);
        } else if (error) {
            canvas.drawLine(96, 63, 96, 105, paint); canvas.drawPoint(96, 124, paint);
        } else {
            canvas.save(); float scale = listening ? 1 + level * .035f : 1; canvas.scale(scale, scale, 96, 96);
            canvas.drawRoundRect(new RectF(82, 59, 110, 109), 14, 14, paint);
            Path path = new Path(); path.moveTo(73, 91); path.lineTo(73, 100); path.cubicTo(73, 131, 119, 131, 119, 100); path.lineTo(119, 91);
            canvas.drawPath(path, paint); canvas.drawLine(96, 123, 96, 139, paint); canvas.drawLine(82, 139, 110, 139, paint); canvas.restore();
        }
        return bitmap;
    }
}
